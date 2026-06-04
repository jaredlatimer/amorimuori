import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data: pizzas, error } = await supabase
    .from("pizzas")
    .select("id, name, description, category, price_cents, nightly_cap, allergens, is_special, sort_order, image_url")
    .eq("is_active", true)
    .order("category")
    .order("sort_order");

  if (error) {
    return NextResponse.json({ error: "Failed to load menu" }, { status: 500 });
  }

  return NextResponse.json({ pizzas }, { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" } });
}
