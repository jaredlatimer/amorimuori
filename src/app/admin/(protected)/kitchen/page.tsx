import { createClient } from "@/lib/supabase/server";
import { KitchenClient } from "./KitchenClient";

export const dynamic = "force-dynamic";

export default async function KitchenPage() {
  const supabase = await createClient();

  const todayET = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  const { data: night } = await supabase
    .from("service_nights")
    .select("id, service_date, service_start, last_pickup")
    .eq("is_enabled", true)
    .gte("service_date", todayET)
    .order("service_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!night) {
    return (
      <div style={{ paddingTop: 60, textAlign: "center", color: "#F8EAD566" }}>
        <p>No upcoming service night found.</p>
      </div>
    );
  }

  const n = night as {
    id: string;
    service_date: string;
    service_start: string;
    last_pickup: string;
  };

  const { data: orders } = await supabase
    .from("orders")
    .select("id, code, customer_name, pickup_at, status")
    .eq("service_night_id", n.id)
    .in("status", ["new", "making"])
    .order("pickup_at", { ascending: true });

  const orderIds = ((orders ?? []) as { id: string }[]).map((o) => o.id);
  const { data: allItems } =
    orderIds.length > 0
      ? await supabase
          .from("order_items")
          .select("order_id, pizza_name, quantity")
          .in("order_id", orderIds)
      : { data: [] };

  return (
    <KitchenClient
      serviceNightId={n.id}
      initialOrders={
        (orders ?? []) as Parameters<typeof KitchenClient>[0]["initialOrders"]
      }
      initialItems={
        (allItems ?? []) as Parameters<typeof KitchenClient>[0]["initialItems"]
      }
    />
  );
}
