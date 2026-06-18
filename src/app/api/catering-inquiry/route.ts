import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendCateringInquiryNotification } from "@/lib/email";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { name, email, phone, eventDate, location, guestCount, eventType, servingWindow, notes } = body as {
    name?: string;
    email?: string;
    phone?: string;
    eventDate?: string;
    location?: string;
    guestCount?: number;
    eventType?: string;
    servingWindow?: string;
    notes?: string;
  };

  if (
    !name?.trim() ||
    !email?.includes("@") ||
    !phone?.trim() ||
    !eventDate ||
    !location?.trim() ||
    !guestCount ||
    guestCount <= 0 ||
    !eventType?.trim()
  ) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const { error } = await supabase.from("catering_inquiries").insert({
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    event_date: eventDate,
    location: location.trim(),
    guest_count: guestCount,
    event_type: eventType.trim(),
    serving_window: servingWindow?.trim() || null,
    notes: notes?.trim() || null,
  });

  if (error) {
    console.error("Catering inquiry insert error:", error);
    return NextResponse.json({ error: "Failed to save inquiry" }, { status: 500 });
  }

  // Notify admin (best-effort — inquiry is already saved)
  sendCateringInquiryNotification({
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    eventDate,
    location: location.trim(),
    guestCount,
    eventType: eventType.trim(),
    servingWindow: servingWindow?.trim(),
    notes: notes?.trim(),
  }).catch((err) => console.error("Catering notification email failed:", err));

  return NextResponse.json({ ok: true });
}
