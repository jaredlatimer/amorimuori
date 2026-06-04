import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const serviceNightId = searchParams.get("serviceNightId");
  if (!serviceNightId) return NextResponse.json({ error: "Missing serviceNightId" }, { status: 400 });

  const { data } = await supabase
    .from("shopping_items")
    .select("id, item_key, label, is_checked, is_custom, created_at")
    .eq("service_night_id", serviceNightId)
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as {
    id: string; item_key: string; label: string;
    is_checked: boolean; is_custom: boolean;
  }[];

  const checkedKeys = rows.filter(r => r.is_checked).map(r => r.item_key);
  const customItems = rows
    .filter(r => r.is_custom)
    .map(r => ({ id: r.id, itemKey: r.item_key, label: r.label }));

  return NextResponse.json({ checkedKeys, customItems });
}
