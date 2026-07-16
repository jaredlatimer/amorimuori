import { createServiceClient } from "@/lib/supabase/server";
import { BlastClient } from "./BlastClient";

export const dynamic = "force-dynamic";

export default async function BlastPage() {
  const supabase = await createServiceClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  const [{ data: orders }, { data: unsubs }, { data: rawNight }] = await Promise.all([
    supabase.from("orders").select("customer_email").not("status", "in", '("cancelled","refunded","pending_payment")'),
    supabase.from("email_unsubscribes").select("email"),
    supabase
      .from("service_nights")
      .select("id, service_date")
      .eq("is_enabled", true)
      .gte("service_date", today)
      .order("service_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const unsubSet = new Set(
    (unsubs ?? []).map((u: { email: string }) => u.email.toLowerCase())
  );

  // Past customers (picked up)
  const pastRecipients = [
    ...new Set(
      (orders ?? [])
        .map((o: { customer_email: string }) => o.customer_email?.toLowerCase())
        .filter((e: string | undefined): e is string => !!e && !unsubSet.has(e))
    ),
  ] as string[];

  // Tonight's orders
  type CurrentOrder = { customer_name: string; customer_email: string; code: string; pickup_at: string };
  let currentNight: { serviceDate: string; recipients: CurrentOrder[] } | null = null;

  if (rawNight) {
    const night = rawNight as { id: string; service_date: string };
    const { data: currentOrders } = await supabase
      .from("orders")
      .select("customer_name, customer_email, code, pickup_at")
      .eq("service_night_id", night.id)
      .not("status", "in", '("cancelled","refunded","pending_payment")')
      .order("pickup_at", { ascending: true });

    const eligible = ((currentOrders ?? []) as CurrentOrder[]).filter(
      (o) => !!o.customer_email?.trim() && !unsubSet.has(o.customer_email.toLowerCase())
    );

    currentNight = { serviceDate: night.service_date, recipients: eligible };
  }

  return (
    <BlastClient
      pastRecipients={pastRecipients}
      currentNight={currentNight}
    />
  );
}
