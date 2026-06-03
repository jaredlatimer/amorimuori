import { createClient } from "@/lib/supabase/server";
import { InventoryClient } from "./InventoryClient";

export const dynamic = "force-dynamic";

interface ServiceNight {
  id: string;
  service_date: string;
  nightly_total: number;
  sold_out_overrides: Record<string, boolean>;
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ nightId?: string }>;
}) {
  const { nightId } = await searchParams;
  const supabase = await createClient();

  const { data: allNights } = await supabase
    .from("service_nights")
    .select("id, service_date, nightly_total, sold_out_overrides")
    .eq("is_enabled", true)
    .order("service_date", { ascending: false })
    .limit(12);

  const nights = (allNights ?? []) as ServiceNight[];

  if (nights.length === 0) {
    return (
      <div style={{ paddingTop: 60, textAlign: "center", color: "#F8EAD566" }}>
        <p>No upcoming service night. Enable one in Settings.</p>
      </div>
    );
  }

  const todayET = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const upcoming = [...nights].reverse().find((n) => n.service_date >= todayET);
  const night = (nightId ? nights.find((n) => n.id === nightId) : null) ?? upcoming ?? nights[0];

  // Confirmed orders (not cancelled/pending/refunded)
  const { data: orders } = await supabase
    .from("orders")
    .select("id")
    .eq("service_night_id", night.id)
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

  const sold: Record<string, number> = {};
  ((items ?? []) as { pizza_id: string; quantity: number }[]).forEach((i) => {
    sold[i.pizza_id] = (sold[i.pizza_id] ?? 0) + i.quantity;
  });

  const totalSold = Object.values(sold).reduce((a, b) => a + b, 0);

  return (
    <InventoryClient
      key={night.id}
      serviceNight={night}
      allNights={nights}
      pizzas={(pizzas ?? []) as { id: string; name: string; category: string; nightly_cap: number }[]}
      sold={sold}
      totalSold={totalSold}
    />
  );
}
