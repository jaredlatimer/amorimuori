import { createServiceClient } from "@/lib/supabase/server";

// Words from Caravaggio's life and work. Keep in sync with the backfill in
// supabase/migrations/010_referrals.sql.
export const REFERRAL_WORDS = [
  "AMOR", "NAPOLI", "MEDUSA", "BACCHUS", "JUDITH", "EMMAUS", "NARCISSUS", "LUTE",
  "MATTHEW", "MALTA", "MERISI", "FRUTTA", "TENEBRISM", "DAVID", "GOLIATH", "LAZARUS",
  "ISAAC", "THOMAS", "URSULA", "LORETO", "ROSARY", "CARDSHARPS", "FORTUNE", "MILANO",
  "ROMA", "SICILIA", "SALOME", "MAGDALENE", "CHIAROSCURO", "PELLEGRINI",
];

export const REWARD_LIFETIME_DAYS = 60;

// Order statuses that count as a real, paid order
const PAID_STATUSES = '("new","making","ready","picked_up")';

type Supabase = Awaited<ReturnType<typeof createServiceClient>>;

export function normalizeReferralCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "").replace(/_/g, "-");
}

function randomReferralCode(): string {
  const word = REFERRAL_WORDS[Math.floor(Math.random() * REFERRAL_WORDS.length)];
  const digits = 1000 + Math.floor(Math.random() * 9000);
  return `${word}-${digits}`;
}

/** The customer's referral code, created on first call. */
export async function getOrCreateReferralCode(
  supabase: Supabase,
  email: string,
  name: string
): Promise<string | null> {
  const key = email.trim().toLowerCase();
  if (!key) return null;

  const { data: existing } = await supabase
    .from("referral_codes")
    .select("code")
    .eq("email", key)
    .maybeSingle();
  if (existing) return (existing as { code: string }).code;

  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomReferralCode();
    const { error } = await supabase
      .from("referral_codes")
      .insert({ code, email: key, name: name.trim() });
    if (!error) return code;

    // 23505 = unique violation: either the code collided (try another) or
    // a concurrent request already created this customer's code (use it).
    if (error.code !== "23505") {
      console.error("Referral code insert error:", error);
      return null;
    }
    const { data: raced } = await supabase
      .from("referral_codes")
      .select("code")
      .eq("email", key)
      .maybeSingle();
    if (raced) return (raced as { code: string }).code;
  }
  return null;
}

/** BOGO discount: the cheapest single pizza, when the order has at least two. */
export function bogoDiscountCents(lines: { unitPriceCents: number; qty: number }[]): number {
  const pizzaCount = lines.reduce((sum, l) => sum + l.qty, 0);
  if (pizzaCount < 2) return 0;
  return Math.min(...lines.filter((l) => l.qty > 0).map((l) => l.unitPriceCents));
}

export type ReferralDiscount =
  | { kind: "none" }
  | { kind: "friend"; code: string; referrerName: string }
  | { kind: "reward"; rewardId: string; friendName: string };

export type ReferralResolution =
  | { ok: true; discount: ReferralDiscount }
  | { ok: false; error: string };

async function hasPaidOrder(supabase: Supabase, email: string, phone: string): Promise<boolean> {
  const { data: byEmail } = await supabase
    .from("orders")
    .select("id")
    .ilike("customer_email", email.trim())
    .filter("status", "in", PAID_STATUSES)
    .limit(1);
  if ((byEmail ?? []).length > 0) return true;

  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length < 10) return false;
  const { data: byPhone } = await supabase
    .from("orders")
    .select("customer_phone")
    .filter("status", "in", PAID_STATUSES)
    .ilike("customer_phone", `%${digits.slice(-4)}%`);
  return ((byPhone ?? []) as { customer_phone: string }[]).some(
    (o) => o.customer_phone.replace(/\D/g, "").slice(-10) === digits
  );
}

/**
 * Decide which referral discount, if any, applies to a checkout.
 * A friend's code is for first-time customers only; without a code, the
 * customer's oldest unexpired reward is applied automatically.
 */
export async function resolveReferralDiscount(
  supabase: Supabase,
  opts: { rawCode: string | null | undefined; email: string; phone: string; pizzaCount: number }
): Promise<ReferralResolution> {
  const email = opts.email.trim().toLowerCase();
  const code = opts.rawCode ? normalizeReferralCode(opts.rawCode) : "";

  if (code) {
    const { data: owner } = await supabase
      .from("referral_codes")
      .select("email, name")
      .eq("code", code)
      .maybeSingle();
    if (!owner) {
      return { ok: false, error: "We don't recognize that referral code. Check the spelling and try again." };
    }
    const o = owner as { email: string; name: string };
    if (o.email === email) {
      return { ok: false, error: "That's your own code. Share it with a friend to earn a free pizza." };
    }
    if (await hasPaidOrder(supabase, email, opts.phone)) {
      return { ok: false, error: "Referral codes are for first-time customers. Thanks for coming back!" };
    }
    if (opts.pizzaCount < 2) {
      return { ok: false, error: "Add a second pizza to use this code. The cheaper one is free." };
    }
    return { ok: true, discount: { kind: "friend", code, referrerName: o.name.split(" ")[0] ?? "" } };
  }

  if (opts.pizzaCount < 2) return { ok: true, discount: { kind: "none" } };

  const { data: reward } = await supabase
    .from("referral_rewards")
    .select("id, friend_name")
    .eq("referrer_email", email)
    .is("redeemed_order_id", null)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (reward) {
    const r = reward as { id: string; friend_name: string };
    return { ok: true, discount: { kind: "reward", rewardId: r.id, friendName: r.friend_name } };
  }
  return { ok: true, discount: { kind: "none" } };
}

/**
 * Called when an order is marked picked up. If it used a friend's code,
 * the code's owner earns a reward. Returns the new reward, or null.
 */
export async function awardReferralForPickup(
  supabase: Supabase,
  orderId: string
): Promise<{ referrerEmail: string; referrerName: string; friendName: string; expiresAt: string; code: string } | null> {
  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_name, referral_code, referral_kind")
    .eq("id", orderId)
    .single();
  const o = order as { id: string; customer_name: string; referral_code: string | null; referral_kind: string | null } | null;
  if (!o || o.referral_kind !== "friend" || !o.referral_code) return null;

  const { data: owner } = await supabase
    .from("referral_codes")
    .select("email, name")
    .eq("code", o.referral_code)
    .maybeSingle();
  if (!owner) return null;
  const referrer = owner as { email: string; name: string };

  const friendName = o.customer_name.trim().split(" ")[0] ?? "";
  const expiresAt = new Date(Date.now() + REWARD_LIFETIME_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("referral_rewards").insert({
    referrer_email: referrer.email,
    earned_from_order_id: o.id,
    friend_name: friendName,
    expires_at: expiresAt,
  });
  // 23505: this order already earned its reward (status toggled twice)
  if (error) {
    if (error.code !== "23505") console.error("Referral reward insert error:", error);
    return null;
  }

  return { referrerEmail: referrer.email, referrerName: referrer.name, friendName, expiresAt, code: o.referral_code };
}

/** Mark the reward an order used as redeemed, once its payment succeeds. */
export async function redeemReferralReward(supabase: Supabase, rewardId: string, orderId: string) {
  const { error } = await supabase
    .from("referral_rewards")
    .update({ redeemed_order_id: orderId, redeemed_at: new Date().toISOString() })
    .eq("id", rewardId)
    .is("redeemed_order_id", null);
  if (error) console.error("Referral reward redeem error:", error);
}
