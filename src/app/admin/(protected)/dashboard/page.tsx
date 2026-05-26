import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: night } = await supabase
    .from("service_nights")
    .select("id, service_date, nightly_total")
    .eq("is_enabled", true)
    .order("service_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!night) {
    return (
      <div style={{ paddingTop: 60, textAlign: "center", color: "#F8EAD566" }}>
        <p>No upcoming service night. Enable one in Settings.</p>
      </div>
    );
  }

  const n = night as { id: string; service_date: string; nightly_total: number };

  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, subtotal_cents, tip_cents, total_cents")
    .eq("service_night_id", n.id)
    .neq("status", "pending_payment");

  const os = (orders ?? []) as { id: string; status: string; subtotal_cents: number; tip_cents: number; total_cents: number }[];

  const confirmed = os.filter((o) => o.status !== "cancelled" && o.status !== "refunded");
  const cancelled = os.filter((o) => o.status === "cancelled");

  const revenue = confirmed.reduce((s, o) => s + o.subtotal_cents, 0);
  const tips = confirmed.reduce((s, o) => s + o.tip_cents, 0);
  const total = confirmed.reduce((s, o) => s + o.total_cents, 0);

  // Per-pizza breakdown
  const { data: items } = confirmed.length > 0
    ? await supabase.from("order_items").select("pizza_name, quantity").in("order_id", confirmed.map((o) => o.id))
    : { data: [] };

  const pizzaCount: Record<string, number> = {};
  let totalPizzas = 0;
  ((items ?? []) as { pizza_name: string; quantity: number }[]).forEach((i) => {
    pizzaCount[i.pizza_name] = (pizzaCount[i.pizza_name] ?? 0) + i.quantity;
    totalPizzas += i.quantity;
  });

  const pizzaRows = Object.entries(pizzaCount).sort((a, b) => b[1] - a[1]);
  const maxQty = Math.max(1, ...pizzaRows.map(([, q]) => q));

  const statCard = (label: string, value: string, sub?: string) => (
    <div style={{ background: "#484D52", border: "1px solid #F8EAD510", borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#F8EAD555", marginBottom: 6 }}>{label}</div>
      <div className="font-display" style={{ fontSize: 30, fontWeight: 900, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 13, color: "#F8EAD555", marginTop: 4 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ paddingTop: 32, maxWidth: 800 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 900, margin: "0 0 4px" }}>Dashboard</h1>
        <p style={{ color: "#F8EAD566", fontSize: 14, margin: 0 }}>{fmtDate(n.service_date)}</p>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 32 }}>
        {statCard("Revenue", fmt(revenue))}
        {statCard("Tips", fmt(tips))}
        {statCard("Total collected", fmt(total))}
        {statCard("Orders", `${confirmed.length}`, cancelled.length > 0 ? `${cancelled.length} cancelled` : undefined)}
        {statCard("Pizzas sold", `${totalPizzas}`, `of ${n.nightly_total} cap`)}
      </div>

      {/* Per-pizza bar chart */}
      {pizzaRows.length > 0 && (
        <div style={{ background: "#484D52", border: "1px solid #F8EAD510", borderRadius: 16, padding: "22px 24px" }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#F8EAD577", margin: "0 0 18px" }}>
            Sold by pizza
          </h2>
          <div style={{ display: "grid", gap: 12 }}>
            {pizzaRows.map(([name, qty]) => (
              <div key={name}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 14 }}>
                  <span style={{ fontWeight: 600 }}>{name}</span>
                  <span style={{ color: "#2F7D4F", fontWeight: 700 }}>{qty}</span>
                </div>
                <div style={{ height: 8, background: "#F8EAD510", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.round((qty / maxQty) * 100)}%`, background: "#2F7D4F", borderRadius: 4, transition: "width 0.3s" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {os.length === 0 && (
        <p style={{ color: "#F8EAD544", textAlign: "center", marginTop: 48, fontSize: 16 }}>No orders yet tonight.</p>
      )}
    </div>
  );
}
