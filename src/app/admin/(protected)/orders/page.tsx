import { createClient } from "@/lib/supabase/server";
import { OrdersClient } from "./OrdersClient";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const supabase = await createClient();

  // Tonight's service night (nearest enabled, order window not fully closed)
  const { data: night } = await supabase
    .from("service_nights")
    .select("id, service_date, service_start, last_pickup, nightly_total")
    .eq("is_enabled", true)
    .order("service_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!night) {
    return (
      <div style={{ paddingTop: 60, textAlign: "center", color: "#F8EAD566" }}>
        <p>No upcoming service night found.</p>
        <p style={{ fontSize: 13, marginTop: 8 }}>
          Create one in the Settings tab once it's built.
        </p>
      </div>
    );
  }

  const n = night as {
    id: string;
    service_date: string;
    service_start: string;
    last_pickup: string;
    nightly_total: number;
  };

  // Fetch orders + items for tonight
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, code, customer_name, customer_phone, pickup_at, status, subtotal_cents, tip_cents, total_cents, placed_at"
    )
    .eq("service_night_id", n.id)
    .neq("status", "pending_payment")
    .order("pickup_at", { ascending: true });

  const orderIds = ((orders ?? []) as { id: string }[]).map((o) => o.id);
  const { data: allItems } = orderIds.length > 0
    ? await supabase
        .from("order_items")
        .select("order_id, pizza_name, quantity, unit_price_cents")
        .in("order_id", orderIds)
    : { data: [] };

  return (
    <OrdersClient
      serviceNight={n}
      initialOrders={(orders ?? []) as Parameters<typeof OrdersClient>[0]["initialOrders"]}
      initialItems={(allItems ?? []) as Parameters<typeof OrdersClient>[0]["initialItems"]}
    />
  );
}
