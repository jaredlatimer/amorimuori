import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildNightIcs, type CalendarNight } from "@/lib/calendar";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ nightId: string }> }
) {
  const { nightId } = await params;
  if (!UUID.test(nightId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("service_nights")
    .select("id, service_date, service_start, last_pickup, order_open_at, order_close_at")
    .eq("id", nightId)
    .eq("is_enabled", true)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const night = data as CalendarNight;
  return new Response(buildNightIcs(night), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="amori-muori-${night.service_date}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
