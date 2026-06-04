import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { serviceNightId, itemKey, label, isChecked, isCustom } = await request.json();
  if (!serviceNightId || !itemKey || !label) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const service = await createServiceClient();
  const { error } = await service.from("shopping_items").upsert({
    service_night_id: serviceNightId,
    item_key: itemKey,
    label,
    is_checked: isChecked,
    is_custom: isCustom ?? false,
  }, { onConflict: "service_night_id,item_key" });

  if (error) {
    console.error("Shopping toggle error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
