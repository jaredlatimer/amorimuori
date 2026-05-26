import { createClient } from "@/lib/supabase/server";
import { getAvailability } from "@/lib/availability";
import { LogoLockup } from "@/components/ui/Logo";
import { OrderingClosed } from "@/components/OrderingClosed";
import { OrderForm, type PizzaGroup } from "./OrderForm";
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

export default async function OrderPage() {
  const [availability, groups] = await Promise.all([
    getAvailability(),
    getMenuGrouped(),
  ]);

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
          <OrderingClosed
            nextOpenAt={availability.nextOpenAt}
            orderCloseAt={availability.serviceNight?.order_close_at ?? null}
          />
        ) : (
          <OrderForm
            groups={groups}
            serviceNightId={availability.serviceNight!.id}
            availability={availability.pizzaAvailability}
            poolRemaining={availability.poolRemaining}
            nightlyTotal={availability.serviceNight!.nightly_total}
          />
        )}
      </div>
    </div>
  );
}
