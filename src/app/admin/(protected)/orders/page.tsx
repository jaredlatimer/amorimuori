import { createClient } from "@/lib/supabase/server";
import { OrdersClient } from "./OrdersClient";

export const dynamic = "force-dynamic";

interface ServiceNight {
  id: string;
  service_date: string;
  service_start: string;
  last_pickup: string;
  nightly_total: number;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ nightId?: string }>;
}) {
  const { nightId } = await searchParams;
  const supabase = await createClient();

  // Fetch recent + upcoming enabled service nights
  const { data: allNights } = await supabase
    .from("service_nights")
    .select("id, service_date, service_start, last_pickup, nightly_total")
    .eq("is_enabled", true)
    .order("service_date", { ascending: false })
    .limit(12);

  const nights = (allNights ?? []) as ServiceNight[];

  if (nights.length === 0) {
    return (
      <div style={{ paddingTop: 60, textAlign: "center", color: "#F8EAD566" }}>
        <p>No service nights found.</p>
        <p style={{ fontSize: 13, marginTop: 8 }}>
          Create one in the Settings tab.
        </p>
      </div>
    );
  }

  // Default to the nearest upcoming night (smallest date >= today), else most recent past
  const todayET = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const upcoming = [...nights].reverse().find((n) => n.service_date >= todayET);
  const night = (nightId ? nights.find((n) => n.id === nightId) : null) ?? upcoming ?? nights[0];

  // Fetch orders + items for the selected night
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, code, customer_name, customer_phone, pickup_at, status, subtotal_cents, tip_cents, total_cents, placed_at"
    )
    .eq("service_night_id", night.id)
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
      key={night.id}
      serviceNight={night}
      allNights={nights}
      initialOrders={(orders ?? []) as Parameters<typeof OrdersClient>[0]["initialOrders"]}
      initialItems={(allItems ?? []) as Parameters<typeof OrdersClient>[0]["initialItems"]}
    />
  );
}
