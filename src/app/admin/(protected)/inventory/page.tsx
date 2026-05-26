import { createClient } from "@/lib/supabase/server";
import { InventoryClient } from "./InventoryClient";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const supabase = await createClient();

  const { data: night } = await supabase
    .from("service_nights")
    .select("id, service_date, nightly_total, sold_out_overrides")
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

  const n = night as { id: string; service_date: string; nightly_total: number; sold_out_overrides: Record<string, boolean> };

  // Confirmed orders (not cancelled/pending)
  const { data: orders } = await supabase
    .from("orders")
    .select("id")
    .eq("service_night_id", n.id)
    .not("status", "in", '("pending_payment","cancelled","refunded")');

  const orderIds = ((orders ?? []) as { id: string }[]).map((o) => o.id);
  const { data: items } = orderIds.length > 0
    ? await supabase.from("order_items").select("pizza_id, quantity").in("order_id", orderIds)
    : { data: [] };

  const { data: pizzas } = await supabase
    .from("pizzas")
    .select("id, name, category, nightly_cap")
    .eq("is_active", true)
    .order("category").order("sort_order");

  // Tally sold per pizza
  const sold: Record<string, number> = {};
  ((items ?? []) as { pizza_id: string; quantity: number }[]).forEach((i) => {
    sold[i.pizza_id] = (sold[i.pizza_id] ?? 0) + i.quantity;
  });

  const totalSold = Object.values(sold).reduce((a, b) => a + b, 0);

  return (
    <InventoryClient
      serviceNight={n}
      pizzas={(pizzas ?? []) as { id: string; name: string; category: string; nightly_cap: number }[]}
      sold={sold}
      totalSold={totalSold}
    />
  );
}
