"use client";

import { NightSummary, type PricedIngredient, type Pizza } from "./CostsClient";

/** One night's ingredient spend, other expenses and margin, for the night's Results tab. */
export function NightCosts({
  night,
  pizzas,
  priced,
}: {
  night: { id: string; service_date: string; nightly_total: number };
  pizzas: Pizza[];
  priced: PricedIngredient[];
}) {
  const pricedByName: Record<string, PricedIngredient> = {};
  for (const p of priced) pricedByName[p.name] = p;
  return (
    <NightSummary
      serviceNights={[night]}
      selectedNightId={night.id}
      setSelectedNightId={() => {}}
      pizzas={pizzas}
      pricedByName={pricedByName}
      hideSelector
    />
  );
}
