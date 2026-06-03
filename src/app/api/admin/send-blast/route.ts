import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendBlast } from "@/lib/email";

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

  const service = await createServiceClient();

  const [{ data: orders }, { data: unsubs }] = await Promise.all([
    service.from("orders").select("customer_email").eq("status", "picked_up"),
    service.from("email_unsubscribes").select("email"),
  ]);

  const unsubSet = new Set((unsubs ?? []).map((u: { email: string }) => u.email.toLowerCase()));
  const emails = [
    ...new Set(
      (orders ?? [])
        .map((o: { customer_email: string }) => o.customer_email?.toLowerCase())
        .filter((e: string | undefined): e is string => !!e && !unsubSet.has(e))
    ),
  ];

  try {
    const sent = await sendBlast({
      emails,
      subject: body.subject,
      body: body.body,
      eventDate: body.eventDate ?? undefined,
    });
    return NextResponse.json({ sent });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Blast send error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
