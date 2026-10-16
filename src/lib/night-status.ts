import { createClient } from "@/lib/supabase/server";
import type { AvailabilityData } from "@/lib/availability";
import { todayET } from "@/lib/service-nights";
import { formatShortDay, type CalendarNight } from "@/lib/calendar";

// Ordering status for service nights, shared by the homepage and the calendar page.

export type NightTone = "open" | "soon" | "out" | "closed";

export interface NightStatus {
  label: string;
  tone: NightTone;
}

/** Enabled nights from today on, soonest first. */
export async function getUpcomingNights(limit = 12): Promise<CalendarNight[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_nights")
    .select("id, service_date, service_start, last_pickup, order_open_at, order_close_at")
    .eq("is_enabled", true)
    .gte("service_date", todayET())
    .order("service_date", { ascending: true })
    .limit(limit);
  return (data ?? []) as CalendarNight[];
}

// The featured night's live state comes from getAvailability (window + caps).
export function isSoldOut(a: AvailabilityData) {
  const pizzas = Object.values(a.pizzaAvailability);
  return a.poolRemaining === 0 || (pizzas.length > 0 && pizzas.every((p) => p.remaining === 0));
}

/** The featured night's status: sold out, open, or when ordering opens. */
export function featuredNightStatus(a: AvailabilityData): NightStatus | null {
  const n = a.serviceNight;
  if (!n) return null;
  if (a.isOpen) return isSoldOut(a) ? { label: "Sold out", tone: "out" } : { label: "Ordering open", tone: "open" };
  return { label: `Orders open ${formatShortDay(n.order_open_at)}`, tone: "soon" };
}

/** Short status for a night in a list. */
export function nightPill(n: CalendarNight, a: AvailabilityData, now: number): NightStatus {
  if (n.id === a.serviceNight?.id) {
    if (a.isOpen) return isSoldOut(a) ? { label: "Sold out", tone: "out" } : { label: "Ordering open", tone: "open" };
    return { label: `Opens ${formatShortDay(n.order_open_at)}`, tone: "soon" };
  }
  if (now < new Date(n.order_open_at).getTime()) return { label: `Opens ${formatShortDay(n.order_open_at)}`, tone: "soon" };
  if (now <= new Date(n.order_close_at).getTime()) return { label: "Ordering open", tone: "open" };
  return { label: "Ordering closed", tone: "closed" };
}
