import { createClient } from "@/lib/supabase/server";
import { WalkInClient } from "./WalkInClient";

export const dynamic = "force-dynamic";

export default async function WalkInPage() {
  const supabase = await createClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  const { data: rawNight } = await supabase
    .from("service_nights")
    .select("id, service_date, nightly_total, service_start, last_pickup, sold_out_overrides")
    .eq("is_enabled", true)
    .gte("service_date", today)
    .order("service_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!rawNight) {
    return (
      <div style={{ paddingTop: 40, maxWidth: 600 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 900, margin: "0 0 16px" }}>Walk-in</h1>
        <p style={{ color: "#F8EAD544", fontSize: 15 }}>No upcoming service nights scheduled. Enable one in Settings.</p>
      </div>
    );
  }

  const night = rawNight as {
    id: string; service_date: string; nightly_total: number;
    service_start: string; last_pickup: string;
    sold_out_overrides: Record<string, boolean>;
  };

  const { data: rawPizzas } = await supabase
    .from("pizzas")
    .select("id, name, description, category, price_cents, nightly_cap, allergens, is_special, sort_order, image_url")
    .eq("is_active", true)
    .order("category")
    .order("sort_order");

  const pizzas = (rawPizzas ?? []) as {
    id: string; name: string; description: string; category: string;
    price_cents: number; nightly_cap: number; allergens: string[];
    is_special: boolean; sort_order: number; image_url: string | null;
  }[];

  // Compute availability
  const { data: existingOrders } = await supabase
    .from("orders").select("id")
    .eq("service_night_id", night.id)
    .not("status", "in", '("cancelled","refunded","pending_payment")');

  const existingIds = (existingOrders ?? []).map((o: { id: string }) => o.id);
  const pizzaQtys: Record<string, number> = {};
  let totalConfirmed = 0;

  if (existingIds.length > 0) {
    const { data: items } = await supabase
      .from("order_items").select("pizza_id, quantity").in("order_id", existingIds);
    for (const item of (items ?? []) as { pizza_id: string; quantity: number }[]) {
      pizzaQtys[item.pizza_id] = (pizzaQtys[item.pizza_id] ?? 0) + item.quantity;
      totalConfirmed += item.quantity;
    }
  }

  const poolRemaining = Math.max(0, night.nightly_total - totalConfirmed);
  const soldOutOverrides = (night.sold_out_overrides ?? {}) as Record<string, boolean>;

  const availability: Record<string, { remaining: number; soldOut: boolean }> = {};
  for (const pizza of pizzas) {
    const confirmed = pizzaQtys[pizza.id] ?? 0;
    const soldOut = soldOutOverrides[pizza.id] === true;
    const remaining = soldOut ? 0 : Math.max(0, Math.min(pizza.nightly_cap - confirmed, poolRemaining));
    availability[pizza.id] = { remaining, soldOut };
  }

  return (
    <WalkInClient
      serviceNight={{ id: night.id, service_date: night.service_date, nightly_total: night.nightly_total }}
      pizzas={pizzas}
      availability={availability}
      poolRemaining={poolRemaining}
    />
  );
}
