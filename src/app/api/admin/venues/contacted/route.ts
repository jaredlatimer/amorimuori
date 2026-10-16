import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isMissingTable } from "@/lib/event-proposals";
import { VENUE_COLUMNS, todayET } from "@/lib/venues";

// "Contacted today": stamps today's date, and moves a Prospect to Contacted
export async function POST(request: Request) {
  // Verify admin is authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { venueId } = (body ?? {}) as { venueId?: string };
  if (!venueId) return NextResponse.json({ error: "Missing venueId" }, { status: 400 });

  const service = await createServiceClient();
  const now = new Date().toISOString();
  const today = todayET();

  const { data, error } = await service
    .from("venues")
    .update({ last_contacted_on: today, updated_at: now })
    .eq("id", venueId)
    .select(VENUE_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error("Venue contacted error:", error);
    return NextResponse.json(
      { error: isMissingTable(error) ? "Run migration 016_venues.sql first" : "Failed to update" },
      { status: 500 }
    );
  }
  if (!data) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  if ((data as { status: string }).status === "prospect") {
    const { data: moved } = await service
      .from("venues")
      .update({ status: "contacted" })
      .eq("id", venueId)
      .eq("status", "prospect")
      .select(VENUE_COLUMNS)
      .maybeSingle();
    if (moved) return NextResponse.json({ ok: true, venue: moved });
  }

  return NextResponse.json({ ok: true, venue: data });
}
