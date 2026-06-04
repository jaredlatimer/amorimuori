import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  const contentType = file.type || "image/jpeg";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const uploadRes = await fetch(
    `${supabaseUrl}/storage/v1/object/pizza-images/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: file,
    }
  );

  if (!uploadRes.ok) {
    const errJson = await uploadRes.json().catch(() => ({}));
    console.error("Storage upload error:", uploadRes.status, errJson);
    return NextResponse.json({ error: errJson.message ?? "Upload failed" }, { status: 500 });
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/pizza-images/${path}`;
  return NextResponse.json({ publicUrl });
}
