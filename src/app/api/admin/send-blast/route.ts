import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendBlast, sendOrderBlast } from "@/lib/email";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = await createServiceClient();

  const [{ data: orders }, { data: unsubs }] = await Promise.all([
    service.from("orders").select("customer_email").eq("status", "picked_up"),
    service.from("email_unsubscribes").select("email"),
  ]);

  const unsubSet = new Set((unsubs ?? []).map((u: { email: string }) => u.email.toLowerCase()));
  const count = new Set(
    (orders ?? [])
      .map((o: { customer_email: string }) => o.customer_email?.toLowerCase())
      .filter((e: string | undefined): e is string => !!e && !unsubSet.has(e))
  ).size;

  return NextResponse.json({ count });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.subject || !body?.body) {
    return NextResponse.json({ error: "Missing subject or body" }, { status: 400 });
  }

  const TEST_EMAIL = "jared@latimerart.design";
  const service = await createServiceClient();
  const { data: unsubs } = await service.from("email_unsubscribes").select("email");
  const unsubSet = new Set((unsubs ?? []).map((u: { email: string }) => u.email.toLowerCase()));

  // Tonight's orders — personalized
  if (body.audience === "current_orders") {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const { data: rawNight } = await service
      .from("service_nights")
      .select("id")
      .eq("is_enabled", true)
      .gte("service_date", today)
      .order("service_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!rawNight) return NextResponse.json({ error: "No upcoming service night" }, { status: 400 });

    const { data: currentOrders } = await service
      .from("orders")
      .select("customer_name, customer_email, code, pickup_at")
      .eq("service_night_id", (rawNight as { id: string }).id)
      .not("status", "in", '("cancelled","refunded","pending_payment")')
      .order("pickup_at", { ascending: true });

    type Row = { customer_name: string; customer_email: string; code: string; pickup_at: string };
    const allRows = ((currentOrders ?? []) as Row[]).filter((o) => !!o.customer_email?.trim() && !unsubSet.has(o.customer_email.toLowerCase()));
    const firstRow = allRows[0];

    if (body.test) {
      const testRecipient = firstRow
        ? { email: TEST_EMAIL, name: firstRow.customer_name, code: firstRow.code, pickupAt: firstRow.pickup_at }
        : { email: TEST_EMAIL, name: "Test Customer", code: "TEST01", pickupAt: new Date().toISOString() };
      try {
        await sendOrderBlast({ recipients: [testRecipient], subject: body.subject, message: body.body });
        return NextResponse.json({ sent: 1 });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }

    const recipients = allRows.map((o) => ({ email: o.customer_email, name: o.customer_name, code: o.code, pickupAt: o.pickup_at }));

    try {
      const sent = await sendOrderBlast({ recipients, subject: body.subject, message: body.body });
      return NextResponse.json({ sent });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Order blast error:", message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // Past customers — generic blast
  if (body.test) {
    try {
      await sendBlast({ emails: [TEST_EMAIL], subject: body.subject, body: body.body, eventDate: body.eventDate ?? undefined });
      return NextResponse.json({ sent: 1 });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const { data: orders } = await service.from("orders").select("customer_email").eq("status", "picked_up");
  const emails = [
    ...new Set(
      (orders ?? [])
        .map((o: { customer_email: string }) => o.customer_email?.toLowerCase())
        .filter((e: string | undefined): e is string => !!e && !unsubSet.has(e))
    ),
  ];

  try {
    const sent = await sendBlast({ emails, subject: body.subject, body: body.body, eventDate: body.eventDate ?? undefined });
    return NextResponse.json({ sent });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Blast send error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
