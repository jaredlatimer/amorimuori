import { createClient } from "@/lib/supabase/server";
import { MenuClient } from "./MenuClient";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const supabase = await createClient();

  const { data: pizzas } = await supabase
    .from("pizzas")
    .select("id, name, description, category, price_cents, nightly_cap, allergens, is_active, is_special, sort_order, image_url")
    .order("category")
    .order("sort_order");

  return <MenuClient initialPizzas={(pizzas ?? []) as Parameters<typeof MenuClient>[0]["initialPizzas"]} />;
}
