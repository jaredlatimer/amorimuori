import { createServiceClient } from "@/lib/supabase/server";
import type { InquiryStatus } from "@/lib/event-packages";
import { EventsClient, type InquiryRow } from "./EventsClient";

export const dynamic = "force-dynamic";

// Inquiry contact details are server-only, so this reads with the service role.
// The admin layout has already checked that someone is signed in.
export default async function EventsInboxPage() {
  const supabase = await createServiceClient();
  // select("*") so the page still loads before 011_events.sql adds the new columns
  const { data, error } = await supabase
    .from("catering_inquiries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) console.error("Events inbox load error:", error);

  const raw = (data ?? []) as Record<string, unknown>[];
  const migrated = raw.length === 0 || "status" in raw[0];
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  const rows: InquiryRow[] = raw.map((r) => ({
    id: r.id as string,
    created_at: r.created_at as string,
    name: r.name as string,
    email: r.email as string,
    phone: str(r.phone),
    event_date: r.event_date as string,
    location: r.location as string,
    guest_count: r.guest_count as number,
    event_type: str(r.event_type),
    package: str(r.package),
    dietary_notes: str(r.dietary_notes),
    serving_window: str(r.serving_window),
    notes: str(r.notes),
    status: (str(r.status) ?? "new") as InquiryStatus,
    status_updated_at: str(r.status_updated_at),
  }));

  return <EventsClient rows={rows} migrated={migrated} loadFailed={!!error} />;
}
