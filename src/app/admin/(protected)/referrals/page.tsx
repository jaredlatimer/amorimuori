import { createServiceClient } from "@/lib/supabase/server";
import { todayET } from "@/lib/service-nights";
import {
  REFERRAL_LAUNCH_DATE,
  SCENARIOS,
  measureNights,
  runScenario,
  type NightRow,
  type OrderRow,
} from "@/lib/referral-results";
import { ReferralsClient, type OwedReward } from "./ReferralsClient";

export const dynamic = "force-dynamic";

// Referral tables are server-only (RLS on, no policies), so this page reads with the service role.
// The admin layout has already checked that someone is signed in.

const PAID_STATUSES = ["new", "making", "ready", "picked_up"];

interface RawOrder {
  id: string;
  service_night_id: string | null;
  customer_email: string;
  subtotal_cents: number;
  discount_cents: number;
  bundle_discount_cents: number;
  referral_kind: "friend" | "reward" | null;
  order_items: { quantity: number }[] | null;
}

interface Reward {
  referrer_email: string;
  friend_name: string;
  earned_at: string;
  expires_at: string;
  redeemed_at: string | null;
}

export default async function ReferralsPage({ searchParams }: { searchParams: Promise<{ night?: string }> }) {
  const { night: nightParam } = await searchParams;
  const supabase = await createServiceClient();
  const today = todayET();

  const [{ data: nights }, { data: orders }, { data: rewards }, { data: codes }] = await Promise.all([
    supabase.from("service_nights").select("id, service_date").eq("is_enabled", true).order("service_date", { ascending: true }),
    supabase
      .from("orders")
      .select("id, service_night_id, customer_email, subtotal_cents, discount_cents, bundle_discount_cents, referral_kind, order_items(quantity)")
      .in("status", PAID_STATUSES)
      .limit(10000),
    supabase.from("referral_rewards").select("referrer_email, friend_name, earned_at, expires_at, redeemed_at"),
    supabase.from("referral_codes").select("code, email, name"),
  ]);

  const allNights = (nights ?? []) as NightRow[];
  const orderRows: OrderRow[] = ((orders ?? []) as RawOrder[]).map((o) => ({
    id: o.id,
    service_night_id: o.service_night_id,
    customer_email: o.customer_email ?? "",
    subtotal_cents: o.subtotal_cents,
    discount_cents: o.discount_cents ?? 0,
    bundle_discount_cents: o.bundle_discount_cents ?? 0,
    referral_kind: o.referral_kind,
    pizzas: (o.order_items ?? []).reduce((s, i) => s + i.quantity, 0),
  }));
  const results = measureNights(allNights, orderRows, REFERRAL_LAUNCH_DATE, today);

  const allRewards = (rewards ?? []) as Reward[];
  const allCodes = (codes ?? []) as { code: string; email: string; name: string }[];
  const now = Date.now();
  const isOpen = (r: Reward) => !r.redeemed_at && new Date(r.expires_at).getTime() > now;
  const owed: OwedReward[] = allRewards
    .filter(isOpen)
    .sort((a, b) => a.expires_at.localeCompare(b.expires_at))
    .map((r) => {
      const c = allCodes.find((x) => x.email === r.referrer_email);
      return { code: c?.code ?? "", name: c?.name || r.referrer_email, friend: r.friend_name, earnedAt: r.earned_at, expiresAt: r.expires_at };
    });

  const scenarioPerFriday = {
    cautious: runScenario(SCENARIOS.cautious).perFriday,
    likely: runScenario(SCENARIOS.likely).perFriday,
    strong: runScenario(SCENARIOS.strong).perFriday,
  };

  return (
    <ReferralsClient
      nights={results}
      selectedNightId={results.some((n) => n.id === nightParam) ? nightParam! : null}
      customersWithCodes={allCodes.length}
      rewardsEarned={allRewards.length}
      rewardsUsed={allRewards.filter((r) => r.redeemed_at).length}
      rewardsExpired={allRewards.filter((r) => !r.redeemed_at && new Date(r.expires_at).getTime() <= now).length}
      owed={owed}
      scenarioPerFriday={scenarioPerFriday}
    />
  );
}
