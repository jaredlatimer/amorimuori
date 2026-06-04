import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const pizzaId = formData.get("pizzaId") as string | null;

  if (!file || !pizzaId) {
    return NextResponse.json({ error: "Missing file or pizzaId" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  // Use pizzaId with underscores (no hyphens) + extension — avoids UUID hyphen path issues
  const safeName = pizzaId.replace(/-/g, "_");
  const path = `${safeName}.${ext}`;
  const contentType = file.type || "image/jpeg";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const bytes = await file.arrayBuffer();

  const uploadUrl = `${supabaseUrl}/storage/v1/object/pizza-images/${path}`;
  console.log("Uploading:", { path, contentType, size: bytes.byteLength });

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: Buffer.from(bytes),
  });

  const rawText = await uploadRes.text();
  console.log("Storage response:", uploadRes.status, rawText);

  if (!uploadRes.ok) {
    return NextResponse.json(
      { error: `Storage ${uploadRes.status}: ${rawText}` },
      { status: 500 }
    );
  }

  // Also update the pizzas row so image_url is always in sync
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/pizza-images/${path}`;
  const service = await createServiceClient();
  const { error: dbErr } = await service
    .from("pizzas")
    .update({ image_url: publicUrl })
    .eq("id", pizzaId);
  if (dbErr) console.error("DB update error:", dbErr);

  return NextResponse.json({ publicUrl });
}
