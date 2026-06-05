import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendAfternoonReminder, AfternoonReminderRecipient } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Vercel automatically passes CRON_SECRET as a Bearer token — verify it
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = await createServiceClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  // Only fire if there's an enabled service night today
  const { data: night } = await service
    .from("service_nights")
    .select("id, service_date")
    .eq("is_enabled", true)
    .eq("service_date", today)
    .maybeSingle();

  if (!night) {
    return NextResponse.json({ skipped: true, reason: "No service night today" });
  }

  // Fetch active orders
  const { data: orders } = await service
    .from("orders")
    .select("customer_name, customer_email, code, pickup_at")
    .eq("service_night_id", (night as { id: string }).id)
    .not("status", "in", '("cancelled","refunded","pending_payment")')
    .order("pickup_at", { ascending: true });

  // Filter unsubscribes
  const { data: unsubs } = await service.from("email_unsubscribes").select("email");
  const unsubSet = new Set((unsubs ?? []).map((u: { email: string }) => u.email.toLowerCase()));

  const recipients = ((orders ?? []) as AfternoonReminderRecipient[]).filter(
    (o) => !!o.customer_email?.trim() && !unsubSet.has(o.customer_email.toLowerCase())
  );

  if (recipients.length === 0) {
    return NextResponse.json({ skipped: true, reason: "No eligible recipients" });
  }

  try {
    const sent = await sendAfternoonReminder(recipients);
    console.log(`Afternoon reminder: sent ${sent} emails for ${today}`);
    return NextResponse.json({ sent });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Afternoon reminder error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
