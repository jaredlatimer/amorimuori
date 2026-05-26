"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Pizza {
  id: string;
  name: string;
  category: string;
  nightly_cap: number;
}

interface Props {
  serviceNight: { id: string; service_date: string; nightly_total: number; sold_out_overrides: Record<string, boolean> };
  pizzas: Pizza[];
  sold: Record<string, number>;
  totalSold: number;
}

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export function InventoryClient({ serviceNight, pizzas, sold, totalSold }: Props) {
  const supabase = createClient();
  const [overrides, setOverrides] = useState<Record<string, boolean>>(serviceNight.sold_out_overrides ?? {});
  const [toggling, setToggling] = useState<string | null>(null);

  const poolRemaining = Math.max(0, serviceNight.nightly_total - totalSold);
  const poolPct = Math.round((totalSold / serviceNight.nightly_total) * 100);

  async function toggleSoldOut(pizzaId: string) {
    setToggling(pizzaId);
    const next = { ...overrides, [pizzaId]: !overrides[pizzaId] };
    if (!next[pizzaId]) delete next[pizzaId];
    await supabase.from("service_nights").update({ sold_out_overrides: next }).eq("id", serviceNight.id);
    setOverrides(next);
    setToggling(null);
  }

  const bar = (value: number, max: number, color: string) => (
    <div style={{ height: 6, background: "#F8EAD510", borderRadius: 3, overflow: "hidden", marginTop: 6 }}>
      <div style={{ height: "100%", width: `${Math.min(100, Math.round((value / Math.max(1, max)) * 100))}%`, background: color, borderRadius: 3, transition: "width 0.3s" }} />
    </div>
  );

  return (
    <div style={{ paddingTop: 32, maxWidth: 720 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 900, margin: "0 0 4px" }}>Inventory</h1>
        <p style={{ color: "#F8EAD566", fontSize: 14, margin: 0 }}>{fmtDate(serviceNight.service_date)}</p>
      </div>

      {/* Pool card */}
      <div style={{ background: "#484D52", border: "1px solid #F8EAD510", borderRadius: 16, padding: "20px 24px", marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#F8EAD566", marginBottom: 4 }}>Nightly pool</div>
            <div className="font-display" style={{ fontSize: 36, fontWeight: 900, lineHeight: 1 }}>
              {poolRemaining} <span style={{ fontSize: 18, color: "#F8EAD566" }}>/ {serviceNight.nightly_total} remaining</span>
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: poolPct >= 90 ? "#C9A227" : "#2F7D4F" }}>{poolPct}% sold</div>
        </div>
        {bar(totalSold, serviceNight.nightly_total, poolPct >= 90 ? "#C9A227" : "#2F7D4F")}
      </div>

      {/* Per-pizza table */}
      <div style={{ background: "#484D52", border: "1px solid #F8EAD510", borderRadius: 16, overflow: "hidden" }}>
        {pizzas.map((pizza, i) => {
          const pizzaSold = sold[pizza.id] ?? 0;
          const remaining = Math.max(0, pizza.nightly_cap - pizzaSold);
          const soldOut = overrides[pizza.id] === true;
          const isToggling = toggling === pizza.id;
          const pct = Math.round((pizzaSold / pizza.nightly_cap) * 100);

          return (
            <div key={pizza.id} style={{ padding: "16px 20px", borderBottom: i < pizzas.length - 1 ? "1px solid #F8EAD50a" : "none", opacity: soldOut ? 0.65 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{pizza.name}</span>
                    {soldOut && <span style={{ fontSize: 11, fontWeight: 700, color: "#60403F", background: "#60403F22", borderRadius: 100, padding: "2px 8px" }}>Sold out</span>}
                  </div>
                  <div style={{ fontSize: 13, color: "#F8EAD555", marginTop: 2 }}>
                    {pizzaSold} sold · {remaining} remaining · cap {pizza.nightly_cap}
                  </div>
                  {bar(pizzaSold, pizza.nightly_cap, pct >= 80 ? "#C9A227" : "#2F7D4F")}
                </div>

                <button
                  onClick={() => toggleSoldOut(pizza.id)}
                  disabled={isToggling}
                  style={{
                    background: soldOut ? "#60403F33" : "transparent",
                    border: `1px solid ${soldOut ? "#60403F66" : "#F8EAD520"}`,
                    color: soldOut ? "#60403F" : "#F8EAD566",
                    borderRadius: 8, padding: "7px 14px", fontSize: 13,
                    cursor: isToggling ? "not-allowed" : "pointer",
                    fontFamily: "var(--font-archivo), sans-serif", flexShrink: 0,
                    fontWeight: soldOut ? 700 : 400,
                  }}
                >
                  {isToggling ? "…" : soldOut ? "Unsell out" : "Mark sold out"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
