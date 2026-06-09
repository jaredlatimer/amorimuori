"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface PricedIngredient {
  id: string;
  name: string;
  price_cents: number;
  yield_pizzas: number;
}

interface Pizza {
  id: string;
  name: string;
  price_cents: number;
  category: string;
  is_active: boolean;
  ingredients: string[];
}

interface ServiceNight {
  id: string;
  service_date: string;
  nightly_total: number;
}

interface Props {
  pricedIngredients: PricedIngredient[];
  allIngredientNames: string[];
  pizzas: Pizza[];
  serviceNights: ServiceNight[];
}

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

const card: React.CSSProperties = {
  background: "#484D52", border: "1px solid #F8EAD510", borderRadius: 14, padding: "18px 20px",
};

const sectionLabel: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, letterSpacing: 1.5,
  textTransform: "uppercase", color: "#F8EAD555", marginBottom: 12, margin: "0 0 12px",
};

const inputStyle: React.CSSProperties = {
  padding: "10px 13px", borderRadius: 10, border: "1px solid #F8EAD520",
  background: "#3A3E43", color: "#F8EAD5", fontSize: 14,
  fontFamily: "var(--font-archivo), sans-serif", outline: "none",
};

const btnGreen: React.CSSProperties = {
  background: "#2F7D4F", border: "none", color: "#F8EAD5",
  borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 700,
  cursor: "pointer", fontFamily: "var(--font-archivo), sans-serif",
};

const btnGhost: React.CSSProperties = {
  background: "transparent", border: "1px solid #F8EAD520", color: "#F8EAD566",
  borderRadius: 9, padding: "7px 14px", fontSize: 13,
  cursor: "pointer", fontFamily: "var(--font-archivo), sans-serif",
};

export function CostsClient({ pricedIngredients: initial, allIngredientNames, pizzas, serviceNights }: Props) {
  const supabase = createClient();
  const [priced, setPriced] = useState<PricedIngredient[]>(initial);
  const [activeTab, setActiveTab] = useState<"ingredients" | "pizzas" | "night">("ingredients");
  const [selectedNightId, setSelectedNightId] = useState(serviceNights[0]?.id ?? "");
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, { price: string; yield: string }>>({});

  // Build a lookup by name
  const pricedByName: Record<string, PricedIngredient> = {};
  for (const p of priced) pricedByName[p.name] = p;

  function getEdit(name: string) {
    return editValues[name] ?? {
      price: pricedByName[name] ? (pricedByName[name].price_cents / 100).toFixed(2) : "",
      yield: pricedByName[name] ? String(pricedByName[name].yield_pizzas) : "1",
    };
  }

  async function saveIngredient(name: string) {
    const vals = getEdit(name);
    if (!vals.price) return;
    setSaving(name);
    setSaveError(null);
    const price_cents = Math.round(parseFloat(vals.price) * 100);
    const yield_pizzas = Math.max(1, parseFloat(vals.yield) || 1);
    const existing = pricedByName[name];

    if (existing) {
      const { data, error } = await supabase
        .from("ingredients")
        .update({ price_cents, yield_pizzas })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) setSaveError(error.message);
      else if (data) setPriced((prev) => prev.map((p) => p.id === existing.id ? data as PricedIngredient : p));
    } else {
      const { data, error } = await supabase
        .from("ingredients")
        .insert({ name, price_cents, yield_pizzas, unit: "unit" })
        .select()
        .single();
      if (error) setSaveError(error.message);
      else if (data) setPriced((prev) => [...prev, data as PricedIngredient]);
    }
    setSaving(null);
  }

  // Per-pizza cost (using existing ingredients TEXT[] on pizza)
  function pizzaCostCents(pizza: Pizza): number {
    return pizza.ingredients.reduce((sum, ingName) => {
      const p = pricedByName[ingName];
      if (!p) return sum;
      return sum + p.price_cents / (p.yield_pizzas || 1);
    }, 0);
  }

  const tabs = [
    { key: "ingredients" as const, label: "Ingredient Pricing" },
    { key: "pizzas" as const, label: "Pizza Costs" },
    { key: "night" as const, label: "Night Summary" },
  ];

  return (
    <div style={{ paddingTop: 32, maxWidth: 760 }}>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 900, margin: "0 0 6px" }}>Costs</h1>
      <p style={{ color: "#F8EAD566", fontSize: 14, margin: "0 0 28px" }}>
        Price your ingredients once — pizza costs and night profitability calculate automatically.
      </p>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 28, borderBottom: "1px solid #F8EAD510" }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            background: "transparent", border: "none",
            borderBottom: activeTab === t.key ? "2px solid #2F7D4F" : "2px solid transparent",
            color: activeTab === t.key ? "#F8EAD5" : "#F8EAD566",
            padding: "10px 18px", fontSize: 14, fontWeight: 700,
            cursor: "pointer", fontFamily: "var(--font-archivo), sans-serif", marginBottom: -1,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── INGREDIENT PRICING ── */}
      {activeTab === "ingredients" && (
        <div style={{ display: "grid", gap: 10 }}>
          <p style={{ color: "#F8EAD566", fontSize: 13, margin: "0 0 8px" }}>
            These ingredients come from your menu. Add the cost per unit and how many pizzas each unit makes.
          </p>
          {saveError && (
            <p style={{ color: "#E05555", fontSize: 13, marginBottom: 12 }}>Error: {saveError}</p>
          )}
          {allIngredientNames.length === 0 && (
            <p style={{ color: "#F8EAD544", textAlign: "center", marginTop: 24 }}>
              No ingredients on active pizzas yet — add them in the Menu tab.
            </p>
          )}
          {allIngredientNames.map((name) => {
            const p = pricedByName[name];
            const vals = getEdit(name);
            const isSaving = saving === name;
            const perPizza = p ? p.price_cents / (p.yield_pizzas || 1) : null;

            return (
              <div key={name} style={{ ...card, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                {/* Name */}
                <div style={{ flex: 1, minWidth: 140 }}>
                  <span style={{ fontWeight: 700, color: "#F8EAD5", fontSize: 15 }}>{name}</span>
                  {perPizza !== null && (
                    <span style={{ color: "#2F7D4F", fontSize: 13, marginLeft: 10, fontWeight: 700 }}>
                      {fmt(Math.round(perPizza))}/pizza
                    </span>
                  )}
                  {!p && (
                    <span style={{ color: "#C9A22766", fontSize: 12, marginLeft: 8 }}>not priced</span>
                  )}
                </div>
                {/* Price input */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "#F8EAD566", fontSize: 13 }}>$</span>
                  <input
                    style={{ ...inputStyle, width: 80 }}
                    placeholder="Price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={vals.price}
                    onChange={(e) => setEditValues((prev) => ({ ...prev, [name]: { ...getEdit(name), price: e.target.value } }))}
                  />
                </div>
                {/* Yield input */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "#F8EAD566", fontSize: 13 }}>÷</span>
                  <input
                    style={{ ...inputStyle, width: 70 }}
                    placeholder="Pizzas"
                    type="number"
                    step="1"
                    min="1"
                    title="How many pizzas does one unit make?"
                    value={vals.yield}
                    onChange={(e) => setEditValues((prev) => ({ ...prev, [name]: { ...getEdit(name), yield: e.target.value } }))}
                  />
                  <span style={{ color: "#F8EAD566", fontSize: 13 }}>pizzas/unit</span>
                </div>
                <button
                  onClick={() => saveIngredient(name)}
                  disabled={isSaving || !vals.price}
                  style={{ ...btnGreen, opacity: isSaving || !vals.price ? 0.5 : 1 }}
                >
                  {isSaving ? "…" : p ? "Update" : "Save"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── PIZZA COSTS ── */}
      {activeTab === "pizzas" && (
        <div style={{ display: "grid", gap: 12 }}>
          {pizzas.filter((p) => p.is_active).map((pizza) => {
            const cost = pizzaCostCents(pizza);
            const margin = pizza.price_cents - cost;
            const marginPct = pizza.price_cents > 0 ? Math.round((margin / pizza.price_cents) * 100) : 0;
            const unpriced = pizza.ingredients.filter((i) => !pricedByName[i]);

            return (
              <div key={pizza.id} style={card}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: "#F8EAD5", fontSize: 17 }}>{pizza.name}</div>
                    <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
                      {pizza.ingredients.map((ingName) => {
                        const p = pricedByName[ingName];
                        const perPizza = p ? p.price_cents / (p.yield_pizzas || 1) : null;
                        return (
                          <div key={ingName} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                            <span style={{ color: "#F8EAD5aa" }}>{ingName}</span>
                            {perPizza !== null ? (
                              <span style={{ color: "#C9A227", fontWeight: 600 }}>{fmt(Math.round(perPizza))}/pizza</span>
                            ) : (
                              <span style={{ color: "#F8EAD533" }}>not priced</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {unpriced.length > 0 && (
                      <p style={{ fontSize: 12, color: "#C9A22766", marginTop: 8 }}>
                        {unpriced.length} ingredient{unpriced.length > 1 ? "s" : ""} not priced yet
                      </p>
                    )}
                  </div>
                  {/* Cost summary */}
                  <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "#F8EAD555", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Price</div>
                      <div className="font-display" style={{ fontSize: 22, fontWeight: 900, color: "#F8EAD5" }}>{fmt(pizza.price_cents)}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "#F8EAD555", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Cost</div>
                      <div className="font-display" style={{ fontSize: 22, fontWeight: 900, color: "#C9A227" }}>{cost > 0 ? fmt(Math.round(cost)) : "—"}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: "#F8EAD555", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Margin</div>
                      <div className="font-display" style={{ fontSize: 22, fontWeight: 900, color: cost > 0 ? (margin >= 0 ? "#2F7D4F" : "#F8EAD5") : "#F8EAD533" }}>
                        {cost > 0 ? fmt(Math.round(margin)) : "—"}
                      </div>
                      {cost > 0 && <div style={{ fontSize: 11, color: "#F8EAD566" }}>{marginPct}%</div>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── NIGHT SUMMARY ── */}
      {activeTab === "night" && (
        <NightSummary
          serviceNights={serviceNights}
          selectedNightId={selectedNightId}
          setSelectedNightId={setSelectedNightId}
          pizzas={pizzas}
          pricedByName={pricedByName}
        />
      )}
    </div>
  );
}

function NightSummary({
  serviceNights, selectedNightId, setSelectedNightId, pizzas, pricedByName,
}: {
  serviceNights: ServiceNight[];
  selectedNightId: string;
  setSelectedNightId: (id: string) => void;
  pizzas: Pizza[];
  pricedByName: Record<string, PricedIngredient>;
}) {
  const supabase = createClient();
  const [orders, setOrders] = useState<{ id: string; total_cents: number }[]>([]);
  const [orderItems, setOrderItems] = useState<{ pizza_id: string; quantity: number }[]>([]);
  const [expenses, setExpenses] = useState<{ id: string; name: string; amount_cents: number }[]>([]);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [expName, setExpName] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expSaving, setExpSaving] = useState(false);

  if (loaded !== selectedNightId) {
    setLoaded(selectedNightId);
    setOrders([]); setOrderItems([]);

    supabase.from("orders")
      .select("id, total_cents")
      .eq("service_night_id", selectedNightId)
      .not("status", "in", '("cancelled","refunded","pending_payment")')
      .then(({ data }) => {
        const os = (data ?? []) as { id: string; total_cents: number }[];
        setOrders(os);
        if (os.length > 0) {
          supabase.from("order_items").select("pizza_id, quantity")
            .in("order_id", os.map((o) => o.id))
            .then(({ data: items }) => setOrderItems((items ?? []) as { pizza_id: string; quantity: number }[]));
        }
      });

    supabase.from("service_night_expenses").select("*")
      .eq("service_night_id", selectedNightId)
      .order("created_at")
      .then(({ data }) => setExpenses((data ?? []) as { id: string; name: string; amount_cents: number }[]));
  }

  // Tally sold pizzas
  const soldByPizzaId: Record<string, number> = {};
  for (const oi of orderItems) {
    soldByPizzaId[oi.pizza_id] = (soldByPizzaId[oi.pizza_id] ?? 0) + oi.quantity;
  }

  // Ingredient totals: name → total pizzas using it
  const ingPizzaCount: Record<string, number> = {};
  for (const [pizzaId, sold] of Object.entries(soldByPizzaId)) {
    const pizza = pizzas.find((p) => p.id === pizzaId);
    if (!pizza) continue;
    for (const ingName of pizza.ingredients ?? []) {
      ingPizzaCount[ingName] = (ingPizzaCount[ingName] ?? 0) + sold;
    }
  }

  // Ingredient spend: units needed + cost
  const ingBreakdown: { name: string; totalPizzas: number; unitsNeeded: number; costCents: number }[] = [];
  let ingredientCost = 0;

  for (const [ingName, totalPizzas] of Object.entries(ingPizzaCount)) {
    const p = pricedByName[ingName];
    if (!p) continue;
    const unitsNeeded = Math.ceil(totalPizzas / (p.yield_pizzas || 1));
    const costCents = unitsNeeded * p.price_cents;
    ingredientCost += costCents;
    ingBreakdown.push({ name: ingName, totalPizzas, unitsNeeded, costCents });
  }

  const revenue = orders.reduce((s, o) => s + o.total_cents, 0);
  const otherExpenses = expenses.reduce((s, e) => s + e.amount_cents, 0);
  const totalCosts = ingredientCost + otherExpenses;
  const grossMargin = revenue - totalCosts;
  const marginPct = revenue > 0 ? Math.round((grossMargin / revenue) * 100) : 0;

  async function addExpense() {
    if (!expName.trim() || !expAmount) return;
    setExpSaving(true);
    const amount_cents = Math.round(parseFloat(expAmount) * 100);
    const { data } = await supabase.from("service_night_expenses")
      .insert({ service_night_id: selectedNightId, name: expName.trim(), amount_cents })
      .select().single();
    if (data) setExpenses((prev) => [...prev, data as { id: string; name: string; amount_cents: number }]);
    setExpName(""); setExpAmount(""); setExpSaving(false);
  }

  async function deleteExpense(id: string) {
    await supabase.from("service_night_expenses").delete().eq("id", id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  const inputStyle: React.CSSProperties = {
    padding: "10px 13px", borderRadius: 10, border: "1px solid #F8EAD520",
    background: "#3A3E43", color: "#F8EAD5", fontSize: 14,
    fontFamily: "var(--font-archivo), sans-serif", outline: "none",
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Night selector */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {serviceNights.map((n) => (
          <button key={n.id} onClick={() => setSelectedNightId(n.id)} style={{
            background: selectedNightId === n.id ? "#F8EAD5" : "transparent",
            color: selectedNightId === n.id ? "#484D52" : "#F8EAD5aa",
            border: `1px solid ${selectedNightId === n.id ? "#F8EAD5" : "#F8EAD520"}`,
            borderRadius: 100, padding: "6px 14px", fontSize: 13,
            fontWeight: selectedNightId === n.id ? 700 : 500,
            cursor: "pointer", fontFamily: "var(--font-archivo), sans-serif",
          }}>
            {fmtDate(n.service_date)}
          </button>
        ))}
      </div>

      {/* Top line */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Revenue", value: fmt(revenue), color: "#F8EAD5" },
          { label: "Ingredient Cost", value: fmt(ingredientCost), color: "#C9A227" },
          { label: "Other Expenses", value: fmt(otherExpenses), color: "#C9A227" },
          { label: "Gross Margin", value: `${fmt(grossMargin)} (${marginPct}%)`, color: grossMargin >= 0 ? "#2F7D4F" : "#F8EAD5" },
        ].map((s) => (
          <div key={s.label} style={{ background: "#484D52", border: "1px solid #F8EAD510", borderRadius: 14, padding: "16px 18px" }}>
            <div style={sectionLabel}>{s.label}</div>
            <div className="font-display" style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Ingredient spend */}
      {ingBreakdown.length > 0 && (
        <div style={{ background: "#484D52", border: "1px solid #F8EAD510", borderRadius: 14, padding: "18px 20px" }}>
          <p style={sectionLabel}>Ingredient Spend</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ color: "#F8EAD555", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
                <th style={{ textAlign: "left", padding: "4px 0", fontWeight: 700 }}>Ingredient</th>
                <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 700 }}>Pizzas</th>
                <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 700 }}>Units needed</th>
                <th style={{ textAlign: "right", padding: "4px 0", fontWeight: 700 }}>Total cost</th>
              </tr>
            </thead>
            <tbody>
              {ingBreakdown.sort((a, b) => b.costCents - a.costCents).map((i) => (
                <tr key={i.name} style={{ borderTop: "1px solid #F8EAD510" }}>
                  <td style={{ padding: "10px 0", color: "#F8EAD5", fontWeight: 600 }}>{i.name}</td>
                  <td style={{ padding: "10px 8px", color: "#F8EAD5aa", textAlign: "right" }}>{i.totalPizzas}</td>
                  <td style={{ padding: "10px 8px", color: "#F8EAD5aa", textAlign: "right" }}>{i.unitsNeeded}</td>
                  <td style={{ padding: "10px 0", color: "#C9A227", fontWeight: 700, textAlign: "right" }}>{fmt(i.costCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Per-pizza breakdown */}
      {Object.keys(soldByPizzaId).length > 0 && (
        <div style={{ background: "#484D52", border: "1px solid #F8EAD510", borderRadius: 14, padding: "18px 20px" }}>
          <p style={sectionLabel}>Per-Pizza Breakdown</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ color: "#F8EAD555", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
                <th style={{ textAlign: "left", padding: "4px 0", fontWeight: 700 }}>Pizza</th>
                <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 700 }}>Sold</th>
                <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 700 }}>Revenue</th>
                <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 700 }}>Ing. Cost</th>
                <th style={{ textAlign: "right", padding: "4px 0", fontWeight: 700 }}>Margin</th>
              </tr>
            </thead>
            <tbody>
              {pizzas.filter((p) => soldByPizzaId[p.id]).map((pizza) => {
                const sold = soldByPizzaId[pizza.id];
                const costPerPizza = pizza.ingredients.reduce((s, ingName) => {
                  const p = pricedByName[ingName];
                  return s + (p ? p.price_cents / (p.yield_pizzas || 1) : 0);
                }, 0);
                const rev = pizza.price_cents * sold;
                const cost = costPerPizza * sold;
                const margin = rev - cost;
                return (
                  <tr key={pizza.id} style={{ borderTop: "1px solid #F8EAD510" }}>
                    <td style={{ padding: "10px 0", color: "#F8EAD5", fontWeight: 600 }}>{pizza.name}</td>
                    <td style={{ padding: "10px 8px", color: "#F8EAD5aa", textAlign: "right" }}>{sold}</td>
                    <td style={{ padding: "10px 8px", color: "#F8EAD5", textAlign: "right" }}>{fmt(rev)}</td>
                    <td style={{ padding: "10px 8px", color: "#C9A227", textAlign: "right" }}>{cost > 0 ? fmt(Math.round(cost)) : "—"}</td>
                    <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 700, color: cost > 0 ? (margin >= 0 ? "#2F7D4F" : "#F8EAD5") : "#F8EAD533" }}>
                      {cost > 0 ? fmt(Math.round(margin)) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Other expenses */}
      <div style={{ background: "#484D52", border: "1px solid #F8EAD510", borderRadius: 14, padding: "18px 20px" }}>
        <p style={sectionLabel}>Other Expenses</p>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <input style={{ ...inputStyle, flex: 1 }} placeholder="Expense (propane, boxes…)" value={expName} onChange={(e) => setExpName(e.target.value)} />
          <input style={{ ...inputStyle, width: 110 }} placeholder="Amount ($)" type="number" step="0.01" min="0" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} />
          <button onClick={addExpense} disabled={expSaving || !expName.trim() || !expAmount}
            style={{ background: "#2F7D4F", border: "none", color: "#F8EAD5", borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-archivo), sans-serif", opacity: expSaving || !expName.trim() || !expAmount ? 0.5 : 1 }}>
            {expSaving ? "…" : "Add"}
          </button>
        </div>
        {expenses.length === 0 ? (
          <p style={{ color: "#F8EAD544", fontSize: 13 }}>No other expenses logged.</p>
        ) : (
          expenses.map((e) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderTop: "1px solid #F8EAD510" }}>
              <span style={{ flex: 1, color: "#F8EAD5", fontSize: 14 }}>{e.name}</span>
              <span style={{ color: "#C9A227", fontWeight: 700, fontSize: 14 }}>{fmt(e.amount_cents)}</span>
              <button onClick={() => deleteExpense(e.id)}
                style={{ background: "#60403F", border: "none", color: "#F8EAD5", borderRadius: 9, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-archivo), sans-serif" }}>
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
