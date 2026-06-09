import { createServiceClient } from "@/lib/supabase/server";
import { CostsClient } from "./CostsClient";

export const dynamic = "force-dynamic";

export default async function CostsPage() {
  const supabase = await createServiceClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  const [
    { data: pricedIngredients },
    { data: pizzas },
    { data: serviceNights },
  ] = await Promise.all([
    supabase.from("ingredients").select("id, name, price_cents, yield_pizzas").order("name"),
    supabase.from("pizzas").select("id, name, price_cents, category, is_active, ingredients").order("name"),
    supabase
      .from("service_nights")
      .select("id, service_date, nightly_total")
      .gte("service_date", today)
      .order("service_date", { ascending: true })
      .limit(10),
  ]);

  // Collect all unique ingredient names from active pizzas
  const allIngNames = new Set<string>();
  for (const pizza of (pizzas ?? []) as { is_active: boolean; ingredients: string[] }[]) {
    if (pizza.is_active) {
      for (const ing of pizza.ingredients ?? []) allIngNames.add(ing);
    }
  }

  return (
    <CostsClient
      pricedIngredients={(pricedIngredients ?? []) as { id: string; name: string; price_cents: number; yield_pizzas: number }[]}
      allIngredientNames={Array.from(allIngNames).sort()}
      pizzas={(pizzas ?? []) as { id: string; name: string; price_cents: number; category: string; is_active: boolean; ingredients: string[] }[]}
      serviceNights={(serviceNights ?? []) as { id: string; service_date: string; nightly_total: number }[]}
    />
  );
}
