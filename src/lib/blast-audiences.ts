// Who each Blast audience reaches. Shared by the Blast page (counts and explanations)
// and /api/admin/send-blast (the actual send), so what the owner sees is what gets sent.
//
// A customer is one email address, or one phone number when the order has no email,
// the same way the Customers page groups them. Only paid orders count. Recipients are
// always customers with an email who haven't unsubscribed, so every audience here is a
// slice of "All customers", never wider.

export type PastAudience = "past" | "lapsed" | "once";

export const PAID_STATUSES = ["new", "making", "ready", "picked_up"] as const;

export const LAPSED_DAYS = 42;

export interface AudienceOrder {
  customer_email: string | null;
  customer_phone: string | null;
  placed_at: string;
}

export interface AudienceSummary {
  recipients: string[]; // lower-cased emails that will get the email
  matched: number; // customers who fit the rule, before removing unsubscribes and missing emails
  unsubscribed: number;
  noEmail: number;
}

export interface BlastAudiences {
  totalCustomers: number;
  cutoffDate: string; // "YYYY-MM-DD": last order on or before this day counts as 6+ weeks ago
  audiences: Record<PastAudience, AudienceSummary>;
}

function etDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function minusDays(ymd: string, days: number): string {
  const d = new Date(ymd + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function buildBlastAudiences(orders: AudienceOrder[], unsubSet: Set<string>, todayET: string): BlastAudiences {
  const cutoffDate = minusDays(todayET, LAPSED_DAYS);
  const customers = new Map<string, { email: string; orders: number; lastDate: string }>();
  for (const o of orders) {
    const email = (o.customer_email ?? "").trim().toLowerCase();
    const key = email || `phone:${o.customer_phone ?? ""}`;
    const day = etDate(o.placed_at);
    const c = customers.get(key);
    if (!c) customers.set(key, { email, orders: 1, lastDate: day });
    else {
      c.orders += 1;
      if (day > c.lastDate) c.lastDate = day;
    }
  }

  const all = [...customers.values()];
  const summarize = (fits: (c: { orders: number; lastDate: string }) => boolean): AudienceSummary => {
    const matched = all.filter(fits);
    const noEmail = matched.filter((c) => !c.email).length;
    const unsubscribed = matched.filter((c) => c.email && unsubSet.has(c.email)).length;
    const recipients = matched.filter((c) => c.email && !unsubSet.has(c.email)).map((c) => c.email);
    return { recipients, matched: matched.length, unsubscribed, noEmail };
  };

  return {
    totalCustomers: all.length,
    cutoffDate,
    audiences: {
      past: summarize(() => true),
      lapsed: summarize((c) => c.lastDate <= cutoffDate),
      once: summarize((c) => c.orders === 1),
    },
  };
}
