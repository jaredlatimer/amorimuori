import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Referral tables are server-only (RLS on, no policies), so this page reads with the service role.
// The admin layout has already checked that someone is signed in.

interface Code { code: string; email: string; name: string }
interface GuestOrder { id: string; customer_name: string; referral_code: string; status: string; placed_at: string }
interface Reward { id: string; referrer_email: string; friend_name: string; earned_at: string; expires_at: string; redeemed_at: string | null }

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
}

export default async function RewardsPage() {
  const supabase = await createServiceClient();
  const [{ data: codes }, { data: guestOrders }, { data: rewards }] = await Promise.all([
    supabase.from("referral_codes").select("code, email, name"),
    supabase
      .from("orders")
      .select("id, customer_name, referral_code, status, placed_at")
      .eq("referral_kind", "friend")
      .in("status", ["new", "making", "ready", "picked_up"])
      .order("placed_at", { ascending: false }),
    supabase.from("referral_rewards").select("id, referrer_email, friend_name, earned_at, expires_at, redeemed_at"),
  ]);

  const allCodes = (codes ?? []) as Code[];
  const guests = (guestOrders ?? []) as GuestOrder[];
  const allRewards = (rewards ?? []) as Reward[];
  const now = Date.now();

  const isOpen = (r: Reward) => !r.redeemed_at && new Date(r.expires_at).getTime() > now;
  const openCount = allRewards.filter(isOpen).length;
  const redeemedCount = allRewards.filter((r) => r.redeemed_at).length;
  const waitingOnPickup = guests.filter((g) => g.status !== "picked_up").length;

  const rows = allCodes
    .map((c) => {
      const theirGuests = guests.filter((g) => g.referral_code === c.code);
      const theirRewards = allRewards.filter((r) => r.referrer_email === c.email);
      return {
        ...c,
        guests: theirGuests,
        open: theirRewards.filter(isOpen),
        redeemed: theirRewards.filter((r) => r.redeemed_at).length,
        expired: theirRewards.filter((r) => !r.redeemed_at && new Date(r.expires_at).getTime() <= now).length,
      };
    })
    .filter((r) => r.guests.length > 0 || r.open.length > 0 || r.redeemed > 0)
    .sort((a, b) => b.open.length - a.open.length || b.guests.length - a.guests.length);
  const quiet = allCodes.length - rows.length;

  const stat = (label: string, value: number, note: string, gold = false) => (
    <div className="rw-stat">
      <small>{label}</small>
      <b style={gold ? { color: "#E8C24A" } : undefined}>{value}</b>
      <em>{note}</em>
    </div>
  );

  return (
    <div style={{ paddingTop: 32, maxWidth: 900 }}>
      <style>{CSS}</style>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 900, margin: "0 0 6px" }}>Rewards</h1>
      <p style={{ fontSize: 14, color: "#F8EAD577", margin: "0 0 22px", maxWidth: 640 }}>
        Every customer has a code to give a guest. A guest&apos;s first order gets the cheaper of two pizzas free. Once that
        order is marked picked up, the customer earns the same reward for a later order, good for 60 days.
      </p>

      <div className="rw-stats">
        {stat("Customers with codes", allCodes.length, "one code each")}
        {stat("Guests who ordered", guests.length, waitingOnPickup > 0 ? `${waitingOnPickup} not picked up yet` : "all picked up")}
        {stat("Free pizzas owed", openCount, "rewards not used yet", openCount > 0)}
        {stat("Rewards used", redeemedCount, "on a later order")}
      </div>

      <section className="rw-card">
        {rows.length === 0 ? (
          <p className="rw-empty">No guests have used a code yet. When one does, their customer shows up here.</p>
        ) : (
          rows.map((r) => (
            <div key={r.code} className="rw-row">
              <span className="rw-code">{r.code}</span>
              <div className="rw-who">
                <b>{r.name || r.email}</b>
                <small>
                  {r.guests.length === 0
                    ? "No guests yet"
                    : `Guests: ${r.guests.map((g) => `${g.customer_name.split(" ")[0]} (${shortDate(g.placed_at)}${g.status === "picked_up" ? "" : ", not picked up"})`).join(", ")}`}
                </small>
              </div>
              <div className="rw-end">
                {r.open.length > 0 ? (
                  <span className="rw-owed">
                    Owed {r.open.length} · until {shortDate(r.open.map((o) => o.expires_at).sort()[0])}
                  </span>
                ) : (
                  <span className="rw-muted">Nothing owed</span>
                )}
                {(r.redeemed > 0 || r.expired > 0) && (
                  <small className="rw-muted">
                    {r.redeemed > 0 ? `${r.redeemed} used` : ""}
                    {r.redeemed > 0 && r.expired > 0 ? " · " : ""}
                    {r.expired > 0 ? `${r.expired} expired` : ""}
                  </small>
                )}
              </div>
            </div>
          ))
        )}
        {quiet > 0 && rows.length > 0 && (
          <p className="rw-foot">{quiet} other customers have a code that no guest has used yet.</p>
        )}
      </section>
    </div>
  );
}

const CSS = `
.rw-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 20px; }
.rw-stat { background: #484D52; border: 1px solid #F8EAD510; border-radius: 16px; padding: 14px 16px; display: grid; gap: 2px; }
.rw-stat small { font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #F8EAD566; }
.rw-stat b { font-family: var(--font-fraunces), serif; font-weight: 900; font-size: 30px; line-height: 1.1; font-variant-numeric: tabular-nums; }
.rw-stat em { font-style: normal; font-size: 12px; color: #F8EAD599; }
.rw-card { background: #484D52; border: 1px solid #F8EAD510; border-radius: 22px; padding: 4px 18px; }
.rw-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 13px 0; border-top: 1px solid #F8EAD512; }
.rw-row:first-child { border-top: 0; }
.rw-code { font-family: ui-monospace, Menlo, monospace; font-weight: 700; font-size: 12px; background: #E8C24A22; color: #E8C24A; border-radius: 8px; padding: 3px 8px; }
.rw-who { display: grid; gap: 2px; min-width: 0; }
.rw-who small { color: #F8EAD588; font-size: 12px; }
.rw-end { display: grid; gap: 2px; justify-items: end; text-align: right; }
.rw-owed { background: #C9A227; color: #2E3236; font-weight: 800; font-size: 12px; border-radius: 10px; padding: 4px 10px; white-space: nowrap; }
.rw-muted { color: #F8EAD566; font-size: 12px; }
.rw-empty, .rw-foot { color: #F8EAD577; font-size: 14px; padding: 14px 0; margin: 0; }
.rw-foot { border-top: 1px solid #F8EAD512; font-size: 13px; }
@media (max-width: 600px) {
  .rw-row { grid-template-columns: minmax(0, 1fr) auto; }
  .rw-code { grid-column: 1 / -1; justify-self: start; }
}
`;
