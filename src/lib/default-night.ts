import { createClient } from "@/lib/supabase/server";
import { todayET } from "@/lib/service-nights";

/** The night an admin page shows when none is picked: the nearest upcoming enabled night, else the latest past one. */
export async function defaultNightId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_nights")
    .select("id, service_date")
    .eq("is_enabled", true)
    .order("service_date", { ascending: false })
    .limit(12);
  const nights = (data ?? []) as { id: string; service_date: string }[];
  if (nights.length === 0) return null;
  const today = todayET();
  const upcoming = [...nights].reverse().find((n) => n.service_date >= today);
  return (upcoming ?? nights[0]).id;
}
