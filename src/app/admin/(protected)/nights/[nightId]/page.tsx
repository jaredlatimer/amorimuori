import { notFound } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { todayET } from "@/lib/service-nights";
import { OrdersView } from "../../orders/OrdersView";
import { StockView } from "../../inventory/StockView";
import { ResultsView } from "../../dashboard/ResultsView";
import { ShoppingView } from "../../shopping/ShoppingView";
import { NightCosts } from "../../costs/NightCosts";
import type { Pizza, PricedIngredient } from "../../costs/CostsClient";
import { NightSetup } from "./NightSetup";
import { formatNightDate, nightStatus } from "../status";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "setup", label: "Setup" },
  { key: "shopping", label: "Shopping" },
  { key: "orders", label: "Orders" },
  { key: "stock", label: "Stock" },
  { key: "results", label: "Results" },
] as const;
type Tab = (typeof TABS)[number]["key"];

interface Night {
  id: string;
  service_date: string;
  is_enabled: boolean;
  nightly_total: number;
  service_start: string;
  last_pickup: string;
  order_open_at: string;
  order_close_at: string;
}

export default async function NightPage({
  params,
  searchParams,
}: {
  params: Promise<{ nightId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { nightId } = await params;
  const { tab: rawTab } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("service_nights")
    .select("id, service_date, is_enabled, nightly_total, service_start, last_pickup, order_open_at, order_close_at")
    .eq("id", nightId)
    .maybeSingle();
  if (!data) notFound();
  const night = data as Night;

  const today = todayET();
  const status = nightStatus(night, today);
  // Open on what you'd most likely want: results after the night, orders on the night, setup before it
  const fallback: Tab = night.service_date < today ? "results" : night.service_date === today ? "orders" : "setup";
  const tab: Tab = TABS.some((t) => t.key === rawTab) ? (rawTab as Tab) : fallback;

  return (
    <div style={{ paddingTop: 26 }}>
      <a href="/admin/nights" style={{ fontSize: 13, color: "#F8EAD577", textDecoration: "none" }}>
        ‹ All nights
      </a>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "8px 0 14px" }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>
          {formatNightDate(night.service_date, "long")}
        </h1>
        <span className={`night-pill ${status.tone}`}>{status.label}</span>
        {night.service_date === today && night.is_enabled && (
          <a href={`/admin/service?nightId=${night.id}`} className="night-board-link">
            Open the Board ›
          </a>
        )}
      </div>
      <nav className="night-tabs">
        {TABS.map((t) => (
          <a key={t.key} href={`/admin/nights/${night.id}?tab=${t.key}`} className={t.key === tab ? "on" : undefined}>
            {t.label}
          </a>
        ))}
      </nav>
      <style>{CSS}</style>

      {tab === "setup" && <NightSetup night={night} />}
      {tab === "shopping" && <ShoppingView nightId={night.id} />}
      {tab === "orders" && <OrdersView nightId={night.id} embedded />}
      {tab === "stock" && <StockView nightId={night.id} embedded />}
      {tab === "results" && <Results night={night} />}
    </div>
  );
}

async function Results({ night }: { night: Night }) {
  // Ingredient prices are server-only, as on the Costs page
  const service = await createServiceClient();
  const [{ data: priced }, { data: pizzas }] = await Promise.all([
    service.from("ingredients").select("id, name, price_cents, yield_pizzas").order("name"),
    service.from("pizzas").select("id, name, price_cents, category, is_active, ingredients").order("name"),
  ]);
  return (
    <>
      <ResultsView nightId={night.id} embedded />
      <div style={{ maxWidth: 800, marginTop: 28 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#F8EAD577", margin: "0 0 14px" }}>
          Costs and profit
        </h2>
        <NightCosts
          night={{ id: night.id, service_date: night.service_date, nightly_total: night.nightly_total }}
          pizzas={(pizzas ?? []) as Pizza[]}
          priced={(priced ?? []) as PricedIngredient[]}
        />
      </div>
    </>
  );
}

const CSS = `
.night-pill { font-size: 12px; font-weight: 700; border-radius: 100px; padding: 3px 10px; white-space: nowrap; }
.night-pill.live, .night-pill.open { background: #2F7D4F33; color: #7fd3a0; }
.night-pill.soon { background: #F8EAD512; color: #F8EAD5bb; }
.night-pill.closed { background: #C9A22726; color: #E8C24A; }
.night-pill.off { background: #60403F; color: #F8EAD5aa; }
.night-pill.done { border: 1px solid #F8EAD522; color: #F8EAD588; }
.night-board-link { margin-left: auto; background: #2F7D4F; color: #F8EAD5; border-radius: 12px; padding: 8px 14px; font-size: 13px; font-weight: 700; text-decoration: none; }
.night-tabs { display: flex; gap: 22px; border-bottom: 1px solid #F8EAD51a; overflow-x: auto; scrollbar-width: none; }
.night-tabs a { padding: 8px 0 10px; font-size: 14px; font-weight: 700; color: #F8EAD577; text-decoration: none; white-space: nowrap; }
.night-tabs a.on { color: #F8EAD5; box-shadow: inset 0 -2px 0 #2F7D4F; }
`;
