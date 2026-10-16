// Event proposals: a priced offer + contract made from an event inquiry.
// The admin Events inbox creates them, the client opens /proposal/[token]
// to sign, then pays the deposit through Stripe. Safe to import from the
// browser: nothing here touches the database or secrets.

import {
  MAX_CUSTOM_LINES,
  findPackage,
  proposalMath,
  type CustomLine,
  type EventPackage,
  type ProposalMath,
} from "./event-packages";

export type ProposalStatus = "draft" | "sent" | "signed" | "deposit_paid";

// Keep in sync with the check constraint in supabase/migrations/016_venues.sql
export const PROPOSAL_STATUSES: { id: ProposalStatus; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "sent", label: "Sent" },
  { id: "signed", label: "Signed" },
  { id: "deposit_paid", label: "Deposit paid" },
];

export function proposalStatusLabel(s: ProposalStatus): string {
  return PROPOSAL_STATUSES.find((x) => x.id === s)?.label ?? s;
}

/** Stripe metadata.kind on deposit payments, so the webhook never mistakes one for a pizza order. */
export const EVENT_DEPOSIT_KIND = "event_deposit";

/** 32 random bytes in base64url is 43 characters. */
export const TOKEN_RE = /^[A-Za-z0-9_-]{43,64}$/;

export interface ProposalRow {
  id: string;
  inquiry_id: string | null;
  token: string;
  status: ProposalStatus;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  package: string;
  guests: number;
  event_date: string; // YYYY-MM-DD
  start_time: string | null; // HH:MM or HH:MM:SS
  end_time: string | null;
  location: string;
  gluten_free_count: number;
  custom_lines: CustomLine[];
  dietary_notes: string | null;
  deposit_pct: number;
  per_guest_cents: number; // package price when saved
  minimum_cents: number;
  total_cents: number;
  deposit_cents: number;
  sent_at: string | null;
  signed_name: string | null;
  signed_at: string | null;
  signed_ip: string | null;
  signed_user_agent: string | null;
  signed_contract: unknown;
  deposit_paid_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Everything the admin inbox needs (the frozen contract is only read by the print view). */
export const PROPOSAL_ADMIN_COLUMNS =
  "id, inquiry_id, token, status, client_name, client_email, client_phone, package, guests, event_date, start_time, end_time, " +
  "location, gluten_free_count, custom_lines, dietary_notes, deposit_pct, per_guest_cents, minimum_cents, total_cents, " +
  "deposit_cents, sent_at, signed_name, " +
  "signed_at, signed_ip, signed_user_agent, deposit_paid_at, created_at, updated_at";

export type AdminProposal = Omit<ProposalRow, "signed_contract">;

/** Errors that mean 016_venues.sql hasn't been run yet. */
export function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return !!error && ["42P01", "PGRST205", "PGRST204", "42703"].includes(error.code ?? "");
}

export type MathFields = Pick<
  ProposalRow,
  "package" | "guests" | "gluten_free_count" | "custom_lines" | "deposit_pct" | "per_guest_cents" | "minimum_cents"
>;

/**
 * The math for a saved proposal, worked out again from its inputs, using the
 * package price and minimum stored on the proposal (not today's prices).
 */
export function mathForRow(row: MathFields): { pkg: EventPackage; math: ProposalMath } | null {
  const current = findPackage(row.package);
  if (!current) return null;
  const pkg: EventPackage = { ...current, perGuest: row.per_guest_cents / 100, minimum: row.minimum_cents / 100 };
  const math = proposalMath(pkg, {
    guests: row.guests,
    glutenFree: row.gluten_free_count,
    customLines: Array.isArray(row.custom_lines) ? row.custom_lines : [],
    depositPct: row.deposit_pct,
  });
  return { pkg, math };
}

export function formatEventDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, "0")} ${suffix}` : `${hour} ${suffix}`;
}

/** "5 PM to 8 PM", "from 5 PM", or "time to be confirmed". */
export function formatTimeWindow(start: string | null, end: string | null): string {
  if (start && end) return `${formatTime(start)} to ${formatTime(end)}`;
  if (start) return `from ${formatTime(start)}`;
  return "time to be confirmed";
}

// ── Validating what the owner types into the proposal form ──

export interface ProposalInput {
  client_name: string;
  client_email: string;
  client_phone: string | null;
  package: string;
  guests: number;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string;
  gluten_free_count: number;
  custom_lines: CustomLine[];
  dietary_notes: string | null;
  deposit_pct: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_GUESTS = 1000;
const MAX_LINE_CENTS = 50_000_00; // $50,000 either way

function clean(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/**
 * Checks the form and turns custom line amounts from dollars into cents.
 * Prices are never read from the request: the totals come from proposalMath.
 */
export function parseProposalInput(body: Record<string, unknown>): { ok: true; value: ProposalInput } | { ok: false; error: string } {
  const client_name = clean(body.client_name, 120);
  const client_email = clean(body.client_email, 200);
  const client_phone = clean(body.client_phone, 40) || null;
  const pkg = findPackage(clean(body.package, 40));
  const guests = Number(body.guests);
  const event_date = clean(body.event_date, 10);
  const start_time = clean(body.start_time, 5) || null;
  const end_time = clean(body.end_time, 5) || null;
  const location = clean(body.location, 300);
  const gluten_free_count = Number(body.gluten_free_count ?? 0);
  const dietary_notes = clean(body.dietary_notes, 2000) || null;
  const deposit_pct = Number(body.deposit_pct);

  const rawLines = Array.isArray(body.custom_lines) ? body.custom_lines : [];
  if (rawLines.length > MAX_CUSTOM_LINES) return { ok: false, error: `At most ${MAX_CUSTOM_LINES} custom lines.` };
  const custom_lines: CustomLine[] = [];
  for (const l of rawLines) {
    const line = (l ?? {}) as Record<string, unknown>;
    const label = clean(line.label, 80);
    const dollars = Number(line.amount);
    if (!label && (line.amount === "" || line.amount == null)) continue; // empty row
    if (!label) return { ok: false, error: "Each custom line needs a description." };
    if (!Number.isFinite(dollars) || dollars === 0) return { ok: false, error: `Add an amount for "${label}".` };
    const amount_cents = Math.round(dollars * 100);
    if (Math.abs(amount_cents) > MAX_LINE_CENTS) return { ok: false, error: `"${label}" is too large.` };
    custom_lines.push({ label, amount_cents });
  }

  const problem =
    !client_name ? "Add the client's name." :
    !EMAIL_RE.test(client_email) ? "Check the client's email." :
    !pkg ? "Pick a package." :
    !Number.isInteger(guests) || guests < 1 || guests > MAX_GUESTS ? `Guests must be a whole number from 1 to ${MAX_GUESTS}.` :
    !DATE_RE.test(event_date) || Number.isNaN(Date.parse(event_date)) ? "Pick the event date." :
    (start_time && !TIME_RE.test(start_time)) || (end_time && !TIME_RE.test(end_time)) ? "Check the start and end times." :
    start_time && end_time && end_time <= start_time ? "The end time must be after the start time." :
    !location ? "Add the location." :
    !Number.isInteger(gluten_free_count) || gluten_free_count < 0 || gluten_free_count > MAX_GUESTS * 3 ? "Gluten free must be a whole number, 0 or more." :
    !Number.isInteger(deposit_pct) || deposit_pct < 1 || deposit_pct > 100 ? "Deposit percent must be a whole number from 1 to 100." :
    null;
  if (problem || !pkg) return { ok: false, error: problem ?? "Pick a package." };

  const math = proposalMath(pkg, { guests, glutenFree: gluten_free_count, customLines: custom_lines, depositPct: deposit_pct });
  if (math.totalCents <= 0) return { ok: false, error: "The total has to be more than $0." };
  // Stripe won't take a card payment under 50 cents
  if (math.depositCents < 50) return { ok: false, error: "The deposit has to be at least $0.50." };

  return {
    ok: true,
    value: {
      client_name, client_email, client_phone, package: pkg.id, guests, event_date, start_time, end_time,
      location, gluten_free_count, custom_lines, dietary_notes, deposit_pct,
    },
  };
}
