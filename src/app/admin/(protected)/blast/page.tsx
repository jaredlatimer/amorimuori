import { createServiceClient } from "@/lib/supabase/server";
import { buildBlastAudiences, PAID_STATUSES, type AudienceOrder } from "@/lib/blast-audiences";
import { BlastClient } from "./BlastClient";

export const dynamic = "force-dynamic";

export default async function BlastPage() {
  const supabase = await createServiceClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  const [{ data: orders }, { data: unsubs }, { data: rawNights }] = await Promise.all([
    supabase.from("orders").select("customer_email, customer_phone, placed_at").in("status", [...PAID_STATUSES]),
    supabase.from("email_unsubscribes").select("email"),
    // The next 4 nights: the first is "tonight", all 4 go in the win-back template
    supabase
      .from("service_nights")
      .select("id, service_date, service_start, last_pickup")
      .eq("is_enabled", true)
      .gte("service_date", today)
      .order("service_date", { ascending: true })
      .limit(4),
  ]);

  const unsubSet = new Set(
    (unsubs ?? []).map((u: { email: string }) => u.email.toLowerCase())
  );

  // All customers, quiet for 6+ weeks, ordered only once
  const audiences = buildBlastAudiences((orders ?? []) as AudienceOrder[], unsubSet, today);

  type Night = { id: string; service_date: string; service_start: string; last_pickup: string };
  const upcomingNights = (rawNights ?? []) as Night[];

  // Tonight's orders
  type CurrentOrder = { customer_name: string; customer_email: string; code: string; pickup_at: string };
  let currentNight: { serviceDate: string; recipients: CurrentOrder[] } | null = null;

  if (upcomingNights[0]) {
    const night = upcomingNights[0];
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
      audiences={audiences}
      currentNight={currentNight}
      upcomingNights={upcomingNights.map(({ service_date, service_start, last_pickup }) => ({ service_date, service_start, last_pickup }))}
    />
  );
}
