import { createServiceClient } from "@/lib/supabase/server";
import { CustomersClient, type CustomerRow } from "./CustomersClient";

export const dynamic = "force-dynamic";

// Customer emails and referral codes are server-only, so this reads with the service role.
// The admin layout has already checked that someone is signed in.
export default async function CustomersPage() {
  const supabase = await createServiceClient();
  const [{ data: orders }, { data: codes }] = await Promise.all([
    supabase
      .from("orders")
      .select("customer_name, customer_email, customer_phone, total_cents, placed_at, status, referral_kind")
      .in("status", ["new", "making", "ready", "picked_up"])
      .order("placed_at", { ascending: true }),
    supabase.from("referral_codes").select("code, email"),
  ]);

  const codeByEmail = new Map(((codes ?? []) as { code: string; email: string }[]).map((c) => [c.email, c.code]));
  const byEmail = new Map<string, CustomerRow>();
  for (const o of (orders ?? []) as {
    customer_name: string; customer_email: string | null; customer_phone: string; total_cents: number;
    placed_at: string; status: string; referral_kind: string | null;
  }[]) {
    const key = (o.customer_email ?? "").trim().toLowerCase() || `phone:${o.customer_phone}`;
    const row = byEmail.get(key);
    if (!row) {
      byEmail.set(key, {
        key,
        name: o.customer_name,
        email: o.customer_email ?? "",
        phone: o.customer_phone,
        orders: 1,
        spent_cents: o.total_cents,
        first_at: o.placed_at,
        last_at: o.placed_at,
        came_as_guest: o.referral_kind === "friend",
        code: codeByEmail.get(key) ?? null,
      });
    } else {
      row.orders += 1;
      row.spent_cents += o.total_cents;
      row.last_at = o.placed_at;
      row.name = o.customer_name || row.name;
    }
  }

  const rows = [...byEmail.values()].sort((a, b) => b.last_at.localeCompare(a.last_at));
  return <CustomersClient rows={rows} />;
}
