import { createClient } from "@/lib/supabase/server";
import { ServiceBoard, type BoardItem, type BoardOrder, type BoardPizza } from "./ServiceBoard";

export const dynamic = "force-dynamic";

interface ServiceNight {
  id: string;
  service_date: string;
  service_start: string;
  last_pickup: string;
  nightly_total: number;
  sold_out_overrides: Record<string, boolean> | null;
}

export default async function ServicePage({
  searchParams,
}: {
  searchParams: Promise<{ nightId?: string }>;
}) {
  const { nightId } = await searchParams;
  const supabase = await createClient();

  const { data: allNights } = await supabase
    .from("service_nights")
    .select("id, service_date, service_start, last_pickup, nightly_total, sold_out_overrides")
    .eq("is_enabled", true)
    .order("service_date", { ascending: false })
    .limit(12);

  const nights = (allNights ?? []) as ServiceNight[];

  if (nights.length === 0) {
    return (
      <div style={{ paddingTop: 60, textAlign: "center", color: "#F8EAD566" }}>
        <p>No service nights yet. Add one in Settings.</p>
      </div>
    );
  }

  // Default to the nearest upcoming night (today counts), else the most recent past one
  const todayET = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const upcoming = [...nights].reverse().find((n) => n.service_date >= todayET);
  const night = (nightId ? nights.find((n) => n.id === nightId) : null) ?? upcoming ?? nights[0];

  const [{ data: orders }, { data: pizzas }, { data: rawSettings }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, code, customer_name, customer_phone, pickup_at, status, arrived_at, total_cents")
      .eq("service_night_id", night.id)
      .neq("status", "pending_payment")
      .order("pickup_at", { ascending: true }),
    supabase
      .from("pizzas")
      .select("id, name, nightly_cap")
      .eq("is_active", true)
      .order("category")
      .order("sort_order"),
    supabase.from("settings").select("bake_minutes").single(),
  ]);

  const orderIds = ((orders ?? []) as { id: string }[]).map((o) => o.id);
  const { data: items } =
    orderIds.length > 0
      ? await supabase
          .from("order_items")
          .select("order_id, pizza_id, pizza_name, quantity")
          .in("order_id", orderIds)
      : { data: [] };

  const bakeMinutes = (rawSettings as { bake_minutes?: number } | null)?.bake_minutes ?? 5;

  return (
    <ServiceBoard
      key={night.id}
      night={{ ...night, sold_out_overrides: night.sold_out_overrides ?? {} }}
      allNights={nights.map((n) => ({ id: n.id, service_date: n.service_date }))}
      bakeMinutes={bakeMinutes}
      initialOrders={(orders ?? []) as BoardOrder[]}
      initialItems={(items ?? []) as BoardItem[]}
      pizzas={(pizzas ?? []) as BoardPizza[]}
    />
  );
}
