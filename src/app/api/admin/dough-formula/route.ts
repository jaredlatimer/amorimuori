import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { validateFormula, type DoughFormula } from "@/lib/dough";

// Saves only the dough columns. Kept apart from Settings' main save, which
// also rewrites times and pool on every upcoming night.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Partial<DoughFormula>;
  const invalid = validateFormula(body);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const service = await createServiceClient();
  const { data: row } = await service.from("settings").select("id").limit(1).maybeSingle();
  const id = (row as { id: string } | null)?.id;
  if (!id) return NextResponse.json({ error: "No settings row found" }, { status: 500 });

  const { error } = await service.from("settings").update({
    dough_ball_g: Math.round(body.ball_g!),
    dough_buffer_pct: body.buffer_pct,
    dough_hydration_pct: body.hydration_pct,
    dough_salt_pct: body.salt_pct,
    dough_yeast_pct: body.yeast_pct,
    dough_schedule: body.schedule,
  }).eq("id", id);

  if (error) {
    console.error("Dough formula save error:", error);
    // 42703 = undefined column: migration 015 hasn't been run yet
    const missing = error.code === "42703" || /dough_/.test(error.message ?? "");
    return NextResponse.json(
      { error: missing ? "Run migration 015_dough_formula.sql in Supabase first." : "Failed to save" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
