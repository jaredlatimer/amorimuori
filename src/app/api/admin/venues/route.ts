import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isMissingTable } from "@/lib/event-proposals";
import { VENUE_COLUMNS, VENUE_DEAL_TYPES, VENUE_STATUSES } from "@/lib/venues";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function clean(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

function cleanDate(v: unknown): string | null | undefined {
  if (v == null || v === "") return null;
  return typeof v === "string" && DATE_RE.test(v) && !Number.isNaN(Date.parse(v)) ? v : undefined;
}

// Add a venue (no id) or save changes to one (with id)
export async function POST(request: Request) {
  // Verify admin is authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const b = body as Record<string, unknown>;

  const name = clean(b.name, 120);
  const lastContacted = cleanDate(b.last_contacted_on);
  const nextBooked = cleanDate(b.next_booked_on);
  const problem =
    !name ? "Add the venue name." :
    !VENUE_DEAL_TYPES.some((d) => d.id === b.deal_type) ? "Pick a deal type." :
    !VENUE_STATUSES.some((s) => s.id === b.status) ? "Pick a status." :
    lastContacted === undefined || nextBooked === undefined ? "Check the dates." :
    null;
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const row = {
    name,
    contact_name: clean(b.contact_name, 120),
    email: clean(b.email, 200),
    phone: clean(b.phone, 40),
    address: clean(b.address, 300),
    deal_type: b.deal_type as string,
    deal_notes: clean(b.deal_notes, 2000),
    status: b.status as string,
    last_contacted_on: lastContacted,
    next_booked_on: nextBooked,
    notes: clean(b.notes, 4000),
    updated_at: new Date().toISOString(),
  };

  const service = await createServiceClient();
  const id = typeof b.id === "string" && b.id ? b.id : null;
  const { data, error } = id
    ? await service.from("venues").update(row).eq("id", id).select(VENUE_COLUMNS).maybeSingle()
    : await service.from("venues").insert(row).select(VENUE_COLUMNS).single();

  if (error) {
    console.error("Venue save error:", error);
    return NextResponse.json(
      { error: isMissingTable(error) ? "Run migration 016_venues.sql first" : "Failed to save" },
      { status: 500 }
    );
  }
  if (!data) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  return NextResponse.json({ ok: true, venue: data });
}
