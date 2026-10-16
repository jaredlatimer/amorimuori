import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendCateringInquiryNotification } from "@/lib/email";
import { EVENT_KINDS, PACKAGE_NOT_SURE, findPackage } from "@/lib/event-packages";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_GUESTS = 1000;

function clean(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const name = clean(b.name, 120);
  const email = clean(b.email, 200);
  const phone = clean(b.phone, 40);
  const eventDate = clean(b.eventDate, 10);
  const location = clean(b.location, 200);
  const eventType = clean(b.eventType, 80);
  const servingWindow = clean(b.servingWindow, 80);
  const notes = clean(b.notes, 2000);
  const dietaryNotes = clean(b.dietaryNotes, 2000);
  const packageInput = clean(b.package, 40) || PACKAGE_NOT_SURE;
  const guestCount = Number(b.guestCount);

  // Today in Ashburn, as YYYY-MM-DD, so an evening request isn't rejected as "past"
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  const problem =
    !name ? "Please add your name." :
    !EMAIL_RE.test(email) ? "Please check your email address." :
    !DATE_RE.test(eventDate) || Number.isNaN(Date.parse(eventDate)) ? "Please pick an event date." :
    eventDate < today ? "That date has already passed." :
    !Number.isInteger(guestCount) || guestCount < 1 ? "Please add your guest count." :
    guestCount > MAX_GUESTS ? `For more than ${MAX_GUESTS} guests, email us directly.` :
    !location ? "Please tell us where the event is." :
    !(EVENT_KINDS as readonly string[]).includes(eventType) ? "Please pick the kind of event." :
    packageInput !== PACKAGE_NOT_SURE && !findPackage(packageInput) ? "Please pick a package." :
    null;
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  const pkg = findPackage(packageInput) ?? null;
  const row = {
    name,
    email,
    phone: phone || null,
    event_date: eventDate,
    location,
    guest_count: guestCount,
    event_type: eventType,
    serving_window: servingWindow || null,
    notes: notes || null,
    package: pkg?.id ?? null,
    dietary_notes: dietaryNotes || null,
  };

  const supabase = await createServiceClient();
  let { error } = await supabase.from("catering_inquiries").insert(row);

  // Until 011_events.sql runs, package/dietary_notes don't exist and phone is
  // NOT NULL. Save the request anyway, with the new details folded into notes.
  if (error && (error.code === "PGRST204" || error.code === "42703")) {
    const extra = [
      pkg ? `Package: ${pkg.name}` : "Package: not sure yet",
      dietaryNotes ? `Dietary: ${dietaryNotes}` : null,
      notes || null,
    ].filter(Boolean).join("\n");
    ({ error } = await supabase.from("catering_inquiries").insert({
      name: row.name,
      email: row.email,
      phone: row.phone ?? "",
      event_date: row.event_date,
      location: row.location,
      guest_count: row.guest_count,
      event_type: row.event_type,
      serving_window: row.serving_window,
      notes: extra,
    }));
  }

  if (error) {
    console.error("Catering inquiry insert error:", error);
    return NextResponse.json({ error: "Failed to save inquiry" }, { status: 500 });
  }

  // Notify admin (best-effort — inquiry is already saved)
  sendCateringInquiryNotification({
    name,
    email,
    phone: phone || undefined,
    eventDate,
    location,
    guestCount,
    eventType,
    packageId: pkg?.id,
    dietaryNotes: dietaryNotes || undefined,
    servingWindow: servingWindow || undefined,
    notes: notes || undefined,
  }).catch((err) => console.error("Catering notification email failed:", err));

  return NextResponse.json({ ok: true });
}
