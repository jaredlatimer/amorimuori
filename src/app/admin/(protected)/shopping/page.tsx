import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayET } from "@/lib/service-nights";

export const dynamic = "force-dynamic";

// Shopping now lives on each night's page; this keeps old links working
export default async function ShoppingPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_nights")
    .select("id")
    .eq("is_enabled", true)
    .gte("service_date", todayET())
    .order("service_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  const id = (data as { id: string } | null)?.id;
  redirect(id ? `/admin/nights/${id}?tab=shopping` : "/admin/nights");
}
