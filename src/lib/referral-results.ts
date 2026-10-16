// Friday-by-Friday results of the referral BOGO, measured from real orders, and the
// Cautious / Likely / Strong scenarios from the revenue calculator to compare against.

export const REFERRAL_LAUNCH_DATE = "2026-10-16";

// Calculator presets. Each is a guess about how customers and guests behave.
export interface ScenarioInputs {
  share: number; // % of customers who send their code to anyone
  reach: number; // guests each sharing customer invites
  conv: number; // % of invited guests who order
  ppo: number; // pizzas per guest order
  redeem: number; // % of earned rewards that get used
  incr: number; // % of used rewards that bring an order that wouldn't have happened
  ret: number; // % of guests who come back at full price
  free: number; // $ value of the free pizza
}

export const SCENARIOS: Record<"cautious" | "likely" | "strong", ScenarioInputs> = {
  cautious: { share: 20, reach: 2, conv: 15, ppo: 2.2, redeem: 50, incr: 30, ret: 15, free: 16 },
  likely: { share: 35, reach: 3, conv: 20, ppo: 2.4, redeem: 65, incr: 50, ret: 25, free: 16 },
  strong: { share: 55, reach: 4, conv: 30, ppo: 2.6, redeem: 80, incr: 65, ret: 40, free: 16.5 },
};
export type ScenarioKey = keyof typeof SCENARIOS;

// The calculator models a 4-Friday campaign. Baseline numbers come from the
// May to Sep order history: $16.91 per pizza, 2.4 pizzas per regular order.
export const CALC_FRIDAYS = 4;
export const CALC_CUSTOMERS = 41;
const AVG_PIZZA_PRICE = 16.91;
const REGULAR_PPO = 2.4;

export interface ScenarioResult {
  guests: number; // guest orders over the 4 Fridays
  rewards: number;
  rewardExtra: number;
  back: number;
  net: number; // extra revenue over the 4 Fridays, $
  perFriday: number; // extra revenue per Friday, $
}

/** Same math as the calculator, in whole people at each step. */
export function runScenario(v: ScenarioInputs): ScenarioResult {
  const sharers = Math.round((CALC_CUSTOMERS * v.share) / 100);
  const guests = Math.round((sharers * v.reach * v.conv) / 100);
  const rewards = Math.round((guests * v.redeem) / 100);
  const rewardExtra = Math.round((rewards * v.incr) / 100);
  const back = Math.round((guests * v.ret) / 100);
  const net =
    guests * v.ppo * AVG_PIZZA_PRICE -
    guests * v.free +
    rewardExtra * REGULAR_PPO * AVG_PIZZA_PRICE -
    rewards * v.free +
    back * v.ppo * AVG_PIZZA_PRICE;
  return { guests, rewards, rewardExtra, back, net, perFriday: net / CALC_FRIDAYS };
}

// ---------- Measuring real Fridays ----------

export interface NightRow {
  id: string;
  service_date: string;
}

export interface OrderRow {
  id: string;
  service_night_id: string | null;
  customer_email: string;
  subtotal_cents: number;
  discount_cents: number;
  referral_kind: "friend" | "reward" | null;
  pizzas: number;
}

export interface NightResult {
  id: string;
  date: string;
  guests: number;
  guestPizzas: number;
  guestSubtotal: number; // cents, before the free pizza
  guestDiscount: number; // cents
  rewardsUsed: number;
  rewardDiscount: number; // cents
  rewardExtra: number; // reward orders from customers who hadn't ordered in the 4 Fridays before
  rewardExtraPizzas: number;
  rewardExtraSubtotal: number; // cents
  back: number; // full-price orders from guests who first came on an earlier Friday
  backPizzas: number;
  backSubtotal: number; // cents
  extra: number; // extra revenue, cents
}

export const LOOKBACK_FRIDAYS = 4;

/**
 * Results for each Friday since launch. `allNights` must be every enabled night,
 * oldest first, so the lookback for reward orders reaches before launch.
 */
export function measureNights(allNights: NightRow[], orders: OrderRow[], fromDate: string, toDate: string): NightResult[] {
  const nightIndex = new Map(allNights.map((n, i) => [n.id, i]));
  const byNight = new Map<string, OrderRow[]>();
  for (const o of orders) {
    if (!o.service_night_id || !nightIndex.has(o.service_night_id)) continue;
    const list = byNight.get(o.service_night_id) ?? [];
    list.push(o);
    byNight.set(o.service_night_id, list);
  }
  const email = (o: OrderRow) => o.customer_email.trim().toLowerCase();

  // The night each guest first ordered with a code
  const guestFirstNight = new Map<string, number>();
  for (const o of orders) {
    if (o.referral_kind !== "friend" || !o.service_night_id) continue;
    const i = nightIndex.get(o.service_night_id);
    if (i === undefined) continue;
    const prev = guestFirstNight.get(email(o));
    if (prev === undefined || i < prev) guestFirstNight.set(email(o), i);
  }

  const results: NightResult[] = [];
  allNights.forEach((night, i) => {
    if (night.service_date < fromDate || night.service_date > toDate) return;
    const here = byNight.get(night.id) ?? [];
    const r: NightResult = {
      id: night.id, date: night.service_date,
      guests: 0, guestPizzas: 0, guestSubtotal: 0, guestDiscount: 0,
      rewardsUsed: 0, rewardDiscount: 0, rewardExtra: 0, rewardExtraPizzas: 0, rewardExtraSubtotal: 0,
      back: 0, backPizzas: 0, backSubtotal: 0, extra: 0,
    };
    const lookback = new Set(allNights.slice(Math.max(0, i - LOOKBACK_FRIDAYS), i).map((n) => n.id));

    for (const o of here) {
      if (o.referral_kind === "friend") {
        r.guests += 1;
        r.guestPizzas += o.pizzas;
        r.guestSubtotal += o.subtotal_cents;
        r.guestDiscount += o.discount_cents;
      } else if (o.referral_kind === "reward") {
        r.rewardsUsed += 1;
        r.rewardDiscount += o.discount_cents;
        const orderedBefore = orders.some(
          (p) => p.id !== o.id && p.service_night_id && lookback.has(p.service_night_id) && email(p) === email(o)
        );
        if (!orderedBefore) {
          r.rewardExtra += 1;
          r.rewardExtraPizzas += o.pizzas;
          r.rewardExtraSubtotal += o.subtotal_cents;
        }
      } else {
        const first = guestFirstNight.get(email(o));
        if (first !== undefined && first < i) {
          r.back += 1;
          r.backPizzas += o.pizzas;
          r.backSubtotal += o.subtotal_cents - o.discount_cents;
        }
      }
    }
    r.extra = r.guestSubtotal - r.guestDiscount + r.rewardExtraSubtotal - r.rewardDiscount + r.backSubtotal;
    results.push(r);
  });
  return results;
}

export function sumNights(nights: NightResult[]): Omit<NightResult, "id" | "date"> {
  const t = {
    guests: 0, guestPizzas: 0, guestSubtotal: 0, guestDiscount: 0,
    rewardsUsed: 0, rewardDiscount: 0, rewardExtra: 0, rewardExtraPizzas: 0, rewardExtraSubtotal: 0,
    back: 0, backPizzas: 0, backSubtotal: 0, extra: 0,
  };
  for (const n of nights) for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] += n[k];
  return t;
}
