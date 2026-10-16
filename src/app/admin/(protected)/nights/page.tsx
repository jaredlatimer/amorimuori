import { createClient } from "@/lib/supabase/server";
import { getUpcomingFridays, todayET } from "@/lib/service-nights";
import { NightsList, type NightRow } from "./NightsList";

export const dynamic = "force-dynamic";

export default async function NightsPage() {
  const supabase = await createClient();
  const today = todayET();

  const [{ data: settings }, { data: rawNights }] = await Promise.all([
    supabase.from("settings").select("service_start, last_pickup, order_close_time, nightly_pool").single(),
    supabase
      .from("service_nights")
      .select("id, service_date, is_enabled, nightly_total, order_open_at, order_close_at")
      .order("service_date", { ascending: false })
      .limit(40),
  ]);

  const nights = (rawNights ?? []) as Omit<NightRow, "sold" | "revenue_cents">[];
  const ids = nights.map((n) => n.id);

  const { data: orders } =
    ids.length > 0
      ? await supabase
          .from("orders")
          .select("id, service_night_id, total_cents")
          .in("service_night_id", ids)
          .not("status", "in", '("pending_payment","cancelled","refunded")')
      : { data: [] };
  const os = (orders ?? []) as { id: string; service_night_id: string; total_cents: number }[];

  const { data: items } =
    os.length > 0
      ? await supabase.from("order_items").select("order_id, quantity").in("order_id", os.map((o) => o.id))
      : { data: [] };

  const nightOfOrder = new Map(os.map((o) => [o.id, o.service_night_id]));
  const sold: Record<string, number> = {};
  const revenue: Record<string, number> = {};
  for (const o of os) revenue[o.service_night_id] = (revenue[o.service_night_id] ?? 0) + o.total_cents;
  for (const i of (items ?? []) as { order_id: string; quantity: number }[]) {
    const n = nightOfOrder.get(i.order_id);
    if (n) sold[n] = (sold[n] ?? 0) + i.quantity;
  }

  const rows: NightRow[] = nights.map((n) => ({ ...n, sold: sold[n.id] ?? 0, revenue_cents: revenue[n.id] ?? 0 }));

  // Upcoming Fridays that haven't been set up yet, so they can be added from here
  const known = new Set(nights.map((n) => n.service_date));
  const unscheduled = getUpcomingFridays(10).filter((d) => d >= today && !known.has(d));

  return (
    <NightsList
      rows={rows}
      unscheduled={unscheduled}
      today={today}
      defaults={settings as { service_start: string; last_pickup: string; order_close_time: string; nightly_pool: number }}
    />
  );
}
