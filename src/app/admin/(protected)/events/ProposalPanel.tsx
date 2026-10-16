"use client";

import { useState } from "react";
import {
  DEFAULT_DEPOSIT_PCT,
  EVENT_PACKAGES,
  MAX_CUSTOM_LINES,
  explainProposalSteps,
  findPackage,
  moneyCents,
  proposalMath,
  type CustomLine,
} from "@/lib/event-packages";
import { mathForRow, proposalStatusLabel, type AdminProposal, type ProposalStatus } from "@/lib/event-proposals";
import type { InquiryRow } from "./EventsClient";

const STATUS_COLOR: Record<ProposalStatus, { bg: string; fg: string }> = {
  draft: { bg: "#F8EAD522", fg: "#F8EAD5" },
  sent: { bg: "#E8C24A", fg: "#2C2F33" },
  signed: { bg: "#F8EAD5", fg: "#2C2F33" },
  deposit_paid: { bg: "#2F7D4F", fg: "#F8EAD5" },
};

// The form keeps what's typed as text; the server checks it and works out the money
interface Form {
  id: string | null;
  client_name: string;
  client_email: string;
  client_phone: string;
  package: string;
  guests: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location: string;
  gluten_free_count: string;
  custom_lines: { label: string; amount: string }[];
  dietary_notes: string;
  deposit_pct: string;
}

function formFromInquiry(r: InquiryRow): Form {
  return {
    id: null,
    client_name: r.name,
    client_email: r.email,
    client_phone: r.phone ?? "",
    package: findPackage(r.package)?.id ?? "amori",
    guests: String(r.guest_count),
    event_date: r.event_date,
    start_time: "",
    end_time: "",
    location: r.location,
    gluten_free_count: "0",
    custom_lines: [],
    dietary_notes: r.dietary_notes ?? "",
    deposit_pct: String(DEFAULT_DEPOSIT_PCT),
  };
}

function formFromProposal(p: AdminProposal): Form {
  return {
    id: p.id,
    client_name: p.client_name,
    client_email: p.client_email,
    client_phone: p.client_phone ?? "",
    package: p.package,
    guests: String(p.guests),
    event_date: p.event_date,
    start_time: p.start_time?.slice(0, 5) ?? "",
    end_time: p.end_time?.slice(0, 5) ?? "",
    location: p.location,
    gluten_free_count: String(p.gluten_free_count),
    custom_lines: (p.custom_lines ?? []).map((l) => ({ label: l.label, amount: String(l.amount_cents / 100) })),
    dietary_notes: p.dietary_notes ?? "",
    deposit_pct: String(p.deposit_pct),
  };
}

/** Live preview of the math while typing. Only a preview: the server works it out again on save. */
function previewSteps(f: Form): string[] | null {
  const pkg = findPackage(f.package);
  const guests = Number(f.guests);
  const glutenFree = Number(f.gluten_free_count || 0);
  const depositPct = Number(f.deposit_pct);
  if (!pkg || !Number.isInteger(guests) || guests < 1 || !Number.isInteger(glutenFree) || glutenFree < 0) return null;
  if (!Number.isInteger(depositPct) || depositPct < 1 || depositPct > 100) return null;
  const customLines: CustomLine[] = f.custom_lines
    .filter((l) => l.label.trim() && Number.isFinite(Number(l.amount)) && Number(l.amount) !== 0)
    .map((l) => ({ label: l.label.trim(), amount_cents: Math.round(Number(l.amount) * 100) }));
  return explainProposalSteps(proposalMath(pkg, { guests, glutenFree, customLines, depositPct }));
}

function stamp(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
}

export function ProposalPanel({
  inquiry,
  proposals,
  enabled,
  onSaved,
}: {
  inquiry: InquiryRow;
  proposals: AdminProposal[];
  enabled: boolean;
  onSaved: (p: AdminProposal, inquiryStatus?: InquiryRow["status"]) => void;
}) {
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const setLine = (i: number, k: "label" | "amount", v: string) =>
    setForm((f) => (f ? { ...f, custom_lines: f.custom_lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)) } : f));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    setBusy("save");
    try {
      const res = await fetch("/api/admin/event-proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, inquiryId: inquiry.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      onSaved(json.proposal as AdminProposal);
      setForm(null);
      setFlash(form.id ? "Proposal saved." : "Proposal created as a Draft. Copy the link or email it to the client when you're ready.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(null);
    }
  }

  async function send(p: AdminProposal, via: "email" | "link") {
    setError(null);
    setFlash(null);
    const url = `${window.location.origin}/proposal/${p.token}`;
    if (via === "email" && !window.confirm(`Email this proposal to ${p.client_email} now?`)) return;
    if (via === "link") {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        window.prompt("Copy this link:", url);
      }
    }
    setBusy(`${via}:${p.id}`);
    try {
      const res = await fetch("/api/admin/event-proposals/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: p.id, via }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Failed");
      onSaved(json.proposal as AdminProposal, inquiry.status === "new" ? "proposal_sent" : undefined);
      setFlash(via === "email" ? `Emailed to ${p.client_email}.` : "Link copied. Paste it into a text or email to the client.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  const steps = form ? previewSteps(form) : null;

  return (
    <div className="ev-pr">
      {proposals.map((p) => {
        const calc = mathForRow(p);
        const locked = p.status === "signed" || p.status === "deposit_paid";
        return (
          <div key={p.id} className="ev-pr-row">
            <div className="ev-pr-head">
              <span className="ev-pr-pill" style={{ background: STATUS_COLOR[p.status].bg, color: STATUS_COLOR[p.status].fg }}>
                {proposalStatusLabel(p.status)}
              </span>
              <b>
                {calc ? calc.pkg.name : p.package} · {p.guests} guests · total {moneyCents(p.total_cents)}, deposit {moneyCents(p.deposit_cents)}
              </b>
            </div>
            {calc && (
              <ol className="ev-pr-steps">
                {explainProposalSteps(calc.math).map((s) => <li key={s}>{s}</li>)}
              </ol>
            )}
            <small className="ev-pr-meta">
              Created {stamp(p.created_at)}
              {p.sent_at && ` · sent ${stamp(p.sent_at)}`}
              {p.signed_at && ` · signed by ${p.signed_name} ${stamp(p.signed_at)}${p.signed_ip ? ` from IP ${p.signed_ip}` : ""}`}
              {p.deposit_paid_at && ` · deposit paid ${stamp(p.deposit_paid_at)}`}
            </small>
            <div className="ev-pr-actions">
              <button type="button" disabled={!!busy} onClick={() => send(p, "link")}>Copy link</button>
              <button type="button" disabled={!!busy} onClick={() => send(p, "email")}>
                {busy === `email:${p.id}` ? "Sending…" : "Email to client"}
              </button>
              <a href={`/proposal/${p.token}`} target="_blank" rel="noreferrer">Open client page</a>
              {!locked && <button type="button" disabled={!!busy} onClick={() => { setFlash(null); setForm(formFromProposal(p)); }}>Edit</button>}
              {locked && <a href={`/admin/events/proposals/${p.id}/print`} target="_blank" rel="noreferrer">Print signed contract</a>}
            </div>
          </div>
        );
      })}

      {!form && (
        <div>
          <button
            type="button"
            className="ev-pr-create"
            disabled={!enabled}
            title={enabled ? undefined : "Run migration 016_venues.sql first"}
            onClick={() => { setFlash(null); setForm(formFromInquiry(inquiry)); }}
          >
            {proposals.length ? "Create another proposal" : "Create proposal"}
          </button>
        </div>
      )}

      {flash && <p className="ev-pr-flash">{flash}</p>}
      {error && <p className="ev-in-note" role="alert" style={{ margin: 0 }}>{error}</p>}

      {form && (
        <form onSubmit={save} className="ev-pr-form">
          <b>{form.id ? "Edit proposal" : "New proposal"}</b>
          <div className="ev-pr-grid">
            <label>Client name<input required value={form.client_name} onChange={(e) => set("client_name", e.target.value)} /></label>
            <label>Client email<input required type="email" value={form.client_email} onChange={(e) => set("client_email", e.target.value)} /></label>
            <label>Client phone<input type="tel" value={form.client_phone} onChange={(e) => set("client_phone", e.target.value)} /></label>
            <label>
              Package
              <select value={form.package} onChange={(e) => set("package", e.target.value)}>
                {EVENT_PACKAGES.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}: {moneyCents(p.perGuest * 100)} a guest, {moneyCents(p.minimum * 100)} minimum</option>
                ))}
              </select>
            </label>
            <label>Guests<input required type="number" min={1} max={1000} step={1} value={form.guests} onChange={(e) => set("guests", e.target.value)} /></label>
            <label>Date<input required type="date" value={form.event_date} onChange={(e) => set("event_date", e.target.value)} /></label>
            <label>
              Serving starts
              <input type="time" value={form.start_time} onChange={(e) => set("start_time", e.target.value)} />
              {inquiry.serving_window && <small>They asked for: {inquiry.serving_window}</small>}
            </label>
            <label>Serving ends<input type="time" value={form.end_time} onChange={(e) => set("end_time", e.target.value)} /></label>
            <label className="wide">Location<input required value={form.location} onChange={(e) => set("location", e.target.value)} /></label>
            <label>
              Gluten free pizzas
              <input type="number" min={0} step={1} value={form.gluten_free_count} onChange={(e) => set("gluten_free_count", e.target.value)} />
              <small>$3 extra each</small>
            </label>
            <label>
              Deposit percent
              <input required type="number" min={1} max={100} step={1} value={form.deposit_pct} onChange={(e) => set("deposit_pct", e.target.value)} />
              <small>Usually {DEFAULT_DEPOSIT_PCT}</small>
            </label>
            <label className="wide">
              Dietary and allergy notes (shown in the contract)
              <textarea rows={2} value={form.dietary_notes} onChange={(e) => set("dietary_notes", e.target.value)} />
            </label>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <span className="ev-pr-label">Custom lines (use a minus amount for a discount)</span>
            {form.custom_lines.map((l, i) => (
              <div key={i} className="ev-pr-line">
                <input placeholder="e.g. Extra hour of service" value={l.label} onChange={(e) => setLine(i, "label", e.target.value)} aria-label="Description" />
                <input placeholder="$" type="number" step="0.01" value={l.amount} onChange={(e) => setLine(i, "amount", e.target.value)} aria-label="Amount in dollars" />
                <button type="button" onClick={() => set("custom_lines", form.custom_lines.filter((_, j) => j !== i))} aria-label="Remove line">×</button>
              </div>
            ))}
            {form.custom_lines.length < MAX_CUSTOM_LINES && (
              <button type="button" className="ev-pr-add" onClick={() => set("custom_lines", [...form.custom_lines, { label: "", amount: "" }])}>
                + Add a line
              </button>
            )}
          </div>

          <div className="ev-pr-preview">
            <span className="ev-pr-label">The math</span>
            {steps ? (
              <ol className="ev-pr-steps">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
            ) : (
              <p style={{ margin: 0, color: "#F8EAD577" }}>Fill in the package, guests and deposit to see the total.</p>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="ev-pr-create" disabled={busy === "save"}>{busy === "save" ? "Saving…" : form.id ? "Save changes" : "Create draft"}</button>
            <button type="button" className="ev-pr-cancel" onClick={() => { setForm(null); setError(null); }}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

export const PROPOSAL_CSS = `
.ev-pr { display: grid; gap: 10px; border-top: 1px solid #F8EAD514; padding-top: 12px; }
.ev-pr-row { background: #3A3E43; border-radius: 16px; padding: 12px 14px; display: grid; gap: 8px; }
.ev-pr-head { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-size: 14px; font-variant-numeric: tabular-nums; }
.ev-pr-pill { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 100px; }
.ev-pr-steps { margin: 0; padding-left: 20px; font-size: 13.5px; line-height: 1.6; font-variant-numeric: tabular-nums; color: #F8EAD5dd; }
.ev-pr-meta { color: #F8EAD577; font-size: 12px; overflow-wrap: anywhere; }
.ev-pr-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.ev-pr-actions button, .ev-pr-actions a, .ev-pr-cancel, .ev-pr-add, .ev-pr-line button { font: 700 13px var(--font-archivo), sans-serif; padding: 6px 12px; border-radius: 100px; border: 1px solid #F8EAD520; background: transparent; color: #F8EAD5cc; cursor: pointer; text-decoration: none; }
.ev-pr-add { justify-self: start; }
.ev-pr-create { font: 700 13px var(--font-archivo), sans-serif; padding: 8px 16px; border-radius: 100px; border: none; background: #2F7D4F; color: #F8EAD5; cursor: pointer; }
.ev-pr button:disabled { opacity: .5; cursor: default; }
.ev-pr button:focus-visible, .ev-pr a:focus-visible { outline: 2px solid #E8C24A; outline-offset: 2px; }
.ev-pr-flash { margin: 0; font-size: 13.5px; color: #8FD3A8; }
.ev-pr-form { background: #3A3E43; border: 1px solid #E8C24A55; border-radius: 16px; padding: 14px; display: grid; gap: 14px; }
.ev-pr-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px 14px; }
.ev-pr-grid label, .ev-pr-label { display: grid; gap: 4px; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #F8EAD599; }
.ev-pr-grid label.wide { grid-column: 1 / -1; }
.ev-pr-grid small { font-size: 12px; font-weight: 400; letter-spacing: 0; text-transform: none; color: #F8EAD577; }
.ev-pr-form input, .ev-pr-form select, .ev-pr-form textarea { font: 400 14px var(--font-archivo), sans-serif; letter-spacing: 0; text-transform: none; color: #F8EAD5; background: #484D52; border: 1px solid #F8EAD522; border-radius: 10px; padding: 8px 10px; min-width: 0; }
.ev-pr-form input:focus, .ev-pr-form select:focus, .ev-pr-form textarea:focus { outline: 2px solid #E8C24A; outline-offset: 1px; }
.ev-pr-line { display: grid; grid-template-columns: 1fr 110px auto; gap: 8px; }
.ev-pr-preview { display: grid; gap: 6px; background: #484D52; border-radius: 12px; padding: 10px 12px; }
`;
