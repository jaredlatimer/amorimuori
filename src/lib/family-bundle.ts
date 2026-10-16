// Family bundle: money off the pizzas when an order has enough of them. It doesn't
// stack with the referral BOGO; the customer gets whichever saves more.
// No server imports here, so the order form can preview it with the same math
// the checkout route charges.

export const FAMILY_BUNDLE = {
  minPizzas: 3,
  discountCents: 500,
} as const;

type Line = { unitPriceCents: number; qty: number };

/** "$16", or "$16.50" when there are cents */
function dollars(cents: number) {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

function pizzaCount(lines: Line[]) {
  return lines.reduce((sum, l) => sum + l.qty, 0);
}

function subtotal(lines: Line[]) {
  return lines.reduce((sum, l) => sum + l.unitPriceCents * l.qty, 0);
}

/** Receipt label, e.g. "3 or more pizzas: $5 off" */
export const BUNDLE_LABEL = `${FAMILY_BUNDLE.minPizzas} or more pizzas: ${dollars(FAMILY_BUNDLE.discountCents)} off`;

/** The same offer mid-sentence, e.g. "$5 off for 3 or more pizzas" */
export const BUNDLE_PHRASE = `${dollars(FAMILY_BUNDLE.discountCents)} off for ${FAMILY_BUNDLE.minPizzas} or more pizzas`;

/** Bundle discount on the food subtotal. Counts pizzas, not line items. */
export function bundleDiscountCents(lines: Line[]): number {
  if (pizzaCount(lines) < FAMILY_BUNDLE.minPizzas) return 0;
  return Math.min(FAMILY_BUNDLE.discountCents, subtotal(lines));
}

/**
 * The bundle and a referral BOGO don't combine. Given what the BOGO would take
 * off (0 when there's none), keep whichever saves more. A tie goes to the BOGO.
 */
export function chooseDiscount(lines: Line[], bogoCents: number): { bogoCents: number; bundleCents: number } {
  const bundleCents = bundleDiscountCents(lines);
  if (bundleCents > bogoCents) return { bogoCents: 0, bundleCents };
  return { bogoCents, bundleCents: 0 };
}

/** The math in plain words: "3 or more pizzas: $5 off. 3 × $16 = $48, minus $5 = $43." */
export function bundleSummary(lines: Line[]): string {
  const live = lines.filter((l) => l.qty > 0);
  const count = pizzaCount(live);
  const food = subtotal(live);
  const off = bundleDiscountCents(live);
  const prices = new Set(live.map((l) => l.unitPriceCents));
  const sum =
    prices.size === 1
      ? `${count} × ${dollars(live[0].unitPriceCents)} = ${dollars(food)}`
      : `${count} pizzas = ${dollars(food)}`;
  return `${BUNDLE_LABEL}. ${sum}, minus ${dollars(off)} = ${dollars(food - off)}.`;
}

/** "Add 1 more pizza and save $5." when the order is one pizza short, else null */
export function bundleNudge(count: number): string | null {
  if (count < 1 || FAMILY_BUNDLE.minPizzas - count !== 1) return null;
  return `Add 1 more pizza and save ${dollars(FAMILY_BUNDLE.discountCents)}.`;
}
