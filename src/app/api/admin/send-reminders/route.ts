import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendReminderBlast } from "@/lib/email";

export async function POST() {
  // Verify admin is authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = await createServiceClient();

  // Get all reminder signups
  const { data: signups, error: signupErr } = await service
    .from("reminder_signups")
    .select("email");

  if (signupErr) {
    return NextResponse.json({ error: "Failed to fetch signups" }, { status: 500 });
  }

  const emails = (signups ?? []).map((s: { email: string }) => s.email);
  if (emails.length === 0) {
    return NextResponse.json({ sent: 0, message: "No signups to notify" });
  }

  // Get next enabled service night for context
  const { data: night } = await service
    .from("service_nights")
    .select("service_date")
    .eq("is_enabled", true)
    .order("service_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  const fridayDate = (night as { service_date: string } | null)?.service_date;

  try {
    const sent = await sendReminderBlast(emails, fridayDate);
    return NextResponse.json({ sent });
  } catch (err) {
    console.error("Reminder blast error:", err);
    return NextResponse.json({ error: "Failed to send emails" }, { status: 500 });
  }
}
