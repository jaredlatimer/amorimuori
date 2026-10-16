// Private event packages, all priced per guest. The public /events page, the
// inquiry email and the admin Events inbox all read these, so a price change
// here shows up everywhere at once.

export type EventPackageId = "classico" | "amori" | "gran_festa" | "celebrazione";

export interface EventPackage {
  id: EventPackageId;
  name: string;
  perGuest: number; // dollars
  minimum: number; // dollars, for the whole event
  tag?: string; // small badge on the card
  priceNote?: string; // line under the price
  includes: string[];
}

export const EVENT_PACKAGES: EventPackage[] = [
  {
    id: "classico",
    name: "Classico",
    perGuest: 22,
    minimum: 1000,
    includes: ["1 pizza per guest", "Choose 2 pizzas from the menu", "2 hours of service"],
  },
  {
    id: "amori",
    name: "Amori",
    perGuest: 28,
    minimum: 1000,
    tag: "Most popular",
    includes: ["1.5 pizzas per guest", "Choose 3, including a specialty", "2.5 hours of service"],
  },
  {
    id: "gran_festa",
    name: "Gran Festa",
    perGuest: 36,
    minimum: 1000,
    includes: ["2 pizzas per guest", "Choose 4, plus a dessert pizza", "3 hours of service"],
  },
  {
    id: "celebrazione",
    name: "Celebrazione",
    perGuest: 55,
    minimum: 2500,
    tag: "Weddings",
    priceNote: "Tax and service included",
    includes: [
      "Everything in Gran Festa",
      "Arugula and shaved Parmigiano salad",
      "Italian sodas and sparkling lemonade",
      "A tasting for the couple",
      "3.5 hours of service",
    ],
  },
];

/** Half the total holds the date. */
export const DEPOSIT_SHARE = 0.5;

/** Gluten free pizzas bake in their own separate oven, so they cost a little more at events. */
export const GLUTEN_FREE_EXTRA = 3;

/** The minimum for every package except Celebrazione. */
export const STANDARD_MINIMUM = 1000;

export function findPackage(id: string | null | undefined): EventPackage | undefined {
  return EVENT_PACKAGES.find((p) => p.id === id);
}

export function money(dollars: number): string {
  return `$${Math.round(dollars).toLocaleString("en-US")}`;
}

export interface EventEstimate {
  guests: number;
  raw: number; // guests × per-guest price
  total: number; // raw, or the minimum if that is higher
  deposit: number;
  underMinimum: boolean;
}

export function estimateEvent(pkg: EventPackage, guests: number): EventEstimate {
  const raw = guests * pkg.perGuest;
  const underMinimum = raw < pkg.minimum;
  const total = underMinimum ? pkg.minimum : raw;
  return { guests, raw, total, deposit: Math.round(total * DEPOSIT_SHARE), underMinimum };
}

/**
 * The math as one plain sentence, e.g.
 * "50 guests × $28 = $1,400. Deposit to hold the date: half, so $700."
 */
export function explainEstimate(pkg: EventPackage, guests: number): string {
  const e = estimateEvent(pkg, guests);
  const product = `${guests} guests × ${money(pkg.perGuest)} = ${money(e.raw)}`;
  const deposit = `Deposit to hold the date: half, so ${money(e.deposit)}.`;
  return e.underMinimum
    ? `${product}, which is under the ${money(pkg.minimum)} minimum, so the event is ${money(e.total)}. ${deposit}`
    : `${product}. ${deposit}`;
}

/** The short form for admin, e.g. "50 × $28 = $1,400, deposit $700". */
export function shortEstimate(pkg: EventPackage, guests: number): string {
  const e = estimateEvent(pkg, guests);
  const product = `${guests} × ${money(pkg.perGuest)} = ${money(e.raw)}`;
  return e.underMinimum
    ? `${product}, under the ${money(pkg.minimum)} minimum, so ${money(e.total)}, deposit ${money(e.deposit)}`
    : `${product}, deposit ${money(e.deposit)}`;
}

// ── Booking form choices ─────────────────────────────────────

export const EVENT_KINDS = [
  "Birthday or backyard party",
  "Office or holiday party",
  "Wedding or rehearsal dinner",
  "School or team event",
  "Something else",
] as const;

/** Stored as null in catering_inquiries.package. */
export const PACKAGE_NOT_SURE = "not_sure";

// ── Admin inbox status ───────────────────────────────────────

export type InquiryStatus = "new" | "proposal_sent" | "booked" | "lost";

// Keep in sync with the check constraint in supabase/migrations/011_events.sql
export const INQUIRY_STATUSES: { id: InquiryStatus; label: string }[] = [
  { id: "new", label: "New" },
  { id: "proposal_sent", label: "Proposal sent" },
  { id: "booked", label: "Booked" },
  { id: "lost", label: "Lost" },
];
