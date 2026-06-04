import { createClient } from "@/lib/supabase/server";
import { ShoppingClient } from "./ShoppingClient";

export const dynamic = "force-dynamic";

export default async function ShoppingPage() {
  const supabase = await createClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  const { data: rawNight } = await supabase
    .from("service_nights")
    .select("id, service_date")
    .eq("is_enabled", true)
    .gte("service_date", today)
    .order("service_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!rawNight) {
    return (
      <div style={{ paddingTop: 40, maxWidth: 600 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 900, margin: "0 0 16px" }}>Shopping</h1>
        <p style={{ color: "#F8EAD544", fontSize: 15 }}>No upcoming service nights scheduled. Enable one in Settings.</p>
      </div>
    );
  }

  const night = rawNight as { id: string; service_date: string };

  const { data: existingOrders } = await supabase
    .from("orders")
    .select("id")
    .eq("service_night_id", night.id)
    .not("status", "in", '("cancelled","refunded","pending_payment")');

  const orderIds = (existingOrders ?? []).map((o: { id: string }) => o.id);
  const pizzaQtys: Record<string, number> = {};
  let totalPizzas = 0;

  if (orderIds.length > 0) {
    const { data: items } = await supabase
      .from("order_items")
      .select("pizza_id, quantity")
      .in("order_id", orderIds);
    for (const item of (items ?? []) as { pizza_id: string; quantity: number }[]) {
      pizzaQtys[item.pizza_id] = (pizzaQtys[item.pizza_id] ?? 0) + item.quantity;
      totalPizzas += item.quantity;
    }
  }

  const orderedPizzaIds = Object.keys(pizzaQtys);
  const ingCounts: Record<string, number> = {};

  if (orderedPizzaIds.length > 0) {
    const { data: rawPizzas } = await supabase
      .from("pizzas")
      .select("id, ingredients")
      .in("id", orderedPizzaIds);

    for (const pizza of (rawPizzas ?? []) as { id: string; ingredients: string[] }[]) {
      const qty = pizzaQtys[pizza.id] ?? 0;
      for (const ing of (pizza.ingredients ?? [])) {
        ingCounts[ing] = (ingCounts[ing] ?? 0) + qty;
      }
    }
  }

  const ingredients = Object.entries(ingCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));

  return (
    <ShoppingClient
      serviceNight={night}
      totalPizzas={totalPizzas}
      ingredients={ingredients}
    />
  );
}
