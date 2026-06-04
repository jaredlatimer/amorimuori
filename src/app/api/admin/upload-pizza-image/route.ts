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
  const path = `${pizzaId}.${ext}`;
  const bytes = await file.arrayBuffer();

  const service = await createServiceClient();
  const { error } = await service.storage
    .from("pizza-images")
    .upload(path, bytes, { upsert: true, contentType: file.type });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: { publicUrl } } = service.storage.from("pizza-images").getPublicUrl(path);
  return NextResponse.json({ publicUrl });
}
