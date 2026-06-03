import { createServiceClient } from "@/lib/supabase/server";
import { BlastClient } from "./BlastClient";

export default async function BlastPage() {
  const supabase = await createServiceClient();

  const [{ data: orders }, { data: unsubs }] = await Promise.all([
    supabase.from("orders").select("customer_email").eq("status", "picked_up"),
    supabase.from("email_unsubscribes").select("email"),
  ]);

  const unsubSet = new Set(
    (unsubs ?? []).map((u: { email: string }) => u.email.toLowerCase())
  );
  const recipientCount = new Set(
    (orders ?? [])
      .map((o: { customer_email: string }) => o.customer_email?.toLowerCase())
      .filter((e: string | undefined): e is string => !!e && !unsubSet.has(e))
  ).size;

  return <BlastClient recipientCount={recipientCount} />;
}
