import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("settings")
    .select("*")
    .single();

  // Fetch all existing service nights (future + recent)
  const { data: serviceNights } = await supabase
    .from("service_nights")
    .select("id, service_date, is_enabled, nightly_total, service_start, last_pickup, order_open_at, order_close_at")
    .order("service_date", { ascending: true });

  return (
    <SettingsClient
      settings={settings as {
        id: string;
        service_start: string;
        last_pickup: string;
        order_open_day: string;
        order_close_time: string;
        bake_minutes: number;
        nightly_pool: number;
      }}
      serviceNights={(serviceNights ?? []) as {
        id: string;
        service_date: string;
        is_enabled: boolean;
        nightly_total: number;
        service_start: string;
        last_pickup: string;
        order_open_at: string;
        order_close_at: string;
      }[]}
    />
  );
}
