import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getAvailability, type AvailabilityData } from "@/lib/availability";
import { LogoLockup } from "@/components/ui/Logo";
import { OrderingClosed } from "@/components/OrderingClosed";
import { OrderForm, type PizzaGroup } from "./OrderForm";
import { normalizeReferralCode } from "@/lib/referrals";
import { parseReferralVia } from "@/lib/referral-share";
import type { Pizza, PizzaCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getMenuGrouped(): Promise<PizzaGroup[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pizzas")
    .select("*")
    .eq("is_active", true)
    .order("category")
    .order("sort_order");

  const pizzas = (data ?? []) as Pizza[];
  const groups = new Map<PizzaCategory, Pizza[]>();
  for (const p of pizzas) {
    const cat = p.category as PizzaCategory;
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(p);
  }
  const CATEGORY_ORDER: PizzaCategory[] = ["Pizze Rosse", "Pizze Bianche"];
  return CATEGORY_ORDER.flatMap((cat) => {
    const items = groups.get(cat);
    return items ? [{ category: cat, items }] : [];
  });
}

// "Order again" (/order?again=<order code>) from the post-pickup email. Order codes
// show up in confirmation URLs, so this reads the pizzas and quantities only, and
// only ones on tonight's menu, capped at what's left.
async function getOrderAgainPrefill(
  rawCode: string,
  groups: PizzaGroup[],
  availability: AvailabilityData
): Promise<{ qty: Record<string, number>; note: string } | null> {
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(code)) return null;

  const supabase = await createServiceClient();
  const { data: order } = await supabase.from("orders").select("id").eq("code", code).maybeSingle();
  if (!order) return null;
  const { data: items } = await supabase
    .from("order_items")
    .select("pizza_id, quantity")
    .eq("order_id", (order as { id: string }).id);

  const wanted: Record<string, number> = {};
  for (const item of (items ?? []) as { pizza_id: string | null; quantity: number }[]) {
    if (item.pizza_id) wanted[item.pizza_id] = (wanted[item.pizza_id] ?? 0) + item.quantity;
  }
  if (Object.keys(wanted).length === 0) return null;

  const qty: Record<string, number> = {};
  const filled: string[] = [];
  let poolLeft = availability.poolRemaining;
  for (const pizza of groups.flatMap((g) => g.items)) {
    const avail = availability.pizzaAvailability[pizza.id];
    if (!wanted[pizza.id] || !avail || avail.soldOut) continue;
    const n = Math.min(wanted[pizza.id], avail.remaining, poolLeft);
    if (n <= 0) continue;
    qty[pizza.id] = n;
    poolLeft -= n;
    filled.push(`${n} ${pizza.name}`);
  }

  return {
    qty,
    note:
      filled.length > 0
        ? `We filled in your last order: ${filled.join(", ")}. Change anything you like.`
        : "The pizzas from your last order aren't available tonight. Pick something else from the menu.",
  };
}

export default async function OrderPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; via?: string; again?: string }>;
}) {
  // A shared link (/order?ref=AMOR-4817&via=text) fills in the friend's code
  const { ref, via, again } = await searchParams;
  const refCode = typeof ref === "string" ? normalizeReferralCode(ref).slice(0, 40) : "";

  const [availability, groups] = await Promise.all([
    getAvailability(),
    getMenuGrouped(),
  ]);

  const prefill =
    availability.isOpen && typeof again === "string"
      ? await getOrderAgainPrefill(again, groups, availability)
      : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#484D52",
        fontFamily: "var(--font-archivo), sans-serif",
        color: "#F8EAD5",
      }}
    >
      {/* Nav */}
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 6vw",
          borderBottom: "1px solid #F8EAD514",
          position: "sticky",
          top: 0,
          background: "#484D52f2",
          backdropFilter: "blur(8px)",
          zIndex: 10,
        }}
      >
        <a
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            textDecoration: "none",
            opacity: 1,
            transition: "opacity 0.15s",
          }}
        >
          <LogoLockup />
        </a>
        <span
          style={{
            fontSize: 13,
            color: "#F8EAD5aa",
            fontWeight: 600,
          }}
        >
          Friday Night Take
        </span>
      </nav>

      <div
        style={{ maxWidth: 1180, margin: "0 auto", padding: "0 6vw" }}
      >
        {!availability.isOpen ? (
          <OrderingClosed night={availability.serviceNight} />
        ) : (
          <OrderForm
            groups={groups}
            serviceNightId={availability.serviceNight!.id}
            serviceDate={availability.serviceNight!.service_date}
            availability={availability.pizzaAvailability}
            poolRemaining={availability.poolRemaining}
            nightlyTotal={availability.serviceNight!.nightly_total}
            initialReferralCode={refCode}
            referralVia={refCode ? parseReferralVia(via) : null}
            initialQty={prefill?.qty}
            prefillNote={prefill?.note ?? null}
          />
        )}
      </div>
    </div>
  );
}
