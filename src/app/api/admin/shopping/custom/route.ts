import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { serviceNightId, label } = await request.json();
  if (!serviceNightId || !label?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const service = await createServiceClient();
  const itemKey = crypto.randomUUID();
  const { data, error } = await service.from("shopping_items").insert({
    service_night_id: serviceNightId,
    item_key: itemKey,
    label: label.trim(),
    is_checked: false,
    is_custom: true,
  }).select("id, item_key").single();

  if (error || !data) {
    console.error("Shopping custom add error:", error);
    return NextResponse.json({ error: "Failed to add item" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, itemKey: data.item_key });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const service = await createServiceClient();
  const { error } = await service.from("shopping_items").delete().eq("id", id);

  if (error) {
    console.error("Shopping custom delete error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
