import { createClient } from "@/lib/supabase/server";
import { RemindersClient } from "./RemindersClient";

export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("reminder_signups")
    .select("*", { count: "exact", head: true });

  return <RemindersClient count={count ?? 0} />;
}
