"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  calcDoughBatch, doughCountdown, formatStepTime, DOUGH_SCHEDULES, type DoughFormula,
} from "@/lib/dough";

interface Props {
  serviceNight: { id: string; service_date: string; service_start: string };
  totalPizzas: number;
  glutenFreePizzas: number;
  doughFormula: DoughFormula;
  doughFormulaSaved: boolean;
  ingredients: { name: string; count: number }[];
  initialCheckedKeys: string[];
  initialCustomItems: { id: string; itemKey: string; label: string; isChecked: boolean }[];
}

type CheckedState = Record<string, boolean>;
type ExtraItem = { id: string; itemKey: string; label: string };

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

export function ShoppingClient({
  serviceNight, totalPizzas, glutenFreePizzas, doughFormula, doughFormulaSaved,
  ingredients, initialCheckedKeys, initialCustomItems,
}: Props) {
  const supabase = createClient();
  const [checked, setChecked] = useState<CheckedState>(() =>
    Object.fromEntries(initialCheckedKeys.map(k => [k, true]))
  );
  const [extraItems, setExtraItems] = useState<ExtraItem[]>(
    initialCustomItems.map(({ id, itemKey, label }) => ({ id, itemKey, label }))
  );
  const [extraInput, setExtraInput] = useState("");

  // Realtime sync — instant cross-device updates
  useEffect(() => {
    async function refetch() {
      const res = await fetch(`/api/admin/shopping/state?serviceNightId=${serviceNight.id}`);
      const data = await res.json();
      setChecked(Object.fromEntries((data.checkedKeys as string[]).map((k: string) => [k, true])));
      setExtraItems(data.customItems as ExtraItem[]);
    }

    const channel = supabase
      .channel(`shopping-${serviceNight.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shopping_items", filter: `service_night_id=eq.${serviceNight.id}` }, () => refetch())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [serviceNight.id]);

  function toggle(itemKey: string, label: string, isCustom = false) {
    const newVal = !checked[itemKey];
    setChecked(prev => ({ ...prev, [itemKey]: newVal }));
    fetch("/api/admin/shopping/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceNightId: serviceNight.id, itemKey, label, isChecked: newVal, isCustom }),
    }).catch(console.error);
  }

  async function addExtra() {
    const trimmed = extraInput.trim();
    if (!trimmed) return;
    setExtraInput("");
    const tempId = `temp-${Date.now()}`;
    const tempItem: ExtraItem = { id: tempId, itemKey: tempId, label: trimmed };
    setExtraItems(prev => [...prev, tempItem]);

    const res = await fetch("/api/admin/shopping/custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceNightId: serviceNight.id, label: trimmed }),
    });
    const json = await res.json();
    if (res.ok) {
      setExtraItems(prev => prev.map(i => i.id === tempId ? { id: json.id, itemKey: json.itemKey, label: trimmed } : i));
    } else {
      setExtraItems(prev => prev.filter(i => i.id !== tempId));
    }
  }

  function removeExtra(item: ExtraItem) {
    setExtraItems(prev => prev.filter(i => i.id !== item.id));
    setChecked(prev => { const { [item.itemKey]: _, ...rest } = prev; return rest; });
    fetch("/api/admin/shopping/custom", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    }).catch(console.error);
  }

  function reset() {
    setChecked({});
    const allKeys = ["dough", ...ingredients.map(i => i.name), ...extraItems.map(i => i.itemKey)];
    allKeys.forEach(itemKey => {
      const label = itemKey === "dough" ? "Dough"
        : ingredients.find(i => i.name === itemKey)?.name
        ?? extraItems.find(i => i.itemKey === itemKey)?.label
        ?? itemKey;
      const isCustom = extraItems.some(i => i.itemKey === itemKey);
      fetch("/api/admin/shopping/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceNightId: serviceNight.id, itemKey, label, isChecked: false, isCustom }),
      }).catch(console.error);
    });
  }

  const DOUGH_KEY = "dough";
  const allKeys = [DOUGH_KEY, ...ingredients.map(i => i.name), ...extraItems.map(i => i.itemKey)];
  const checkedCount = allKeys.filter(k => checked[k]).length;
  const total = allKeys.length;
  const allDone = total > 0 && checkedCount === total;

  return (
    <div style={{ padding: "28px 4px 80px", fontFamily: "var(--font-archivo), sans-serif", maxWidth: 480 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 26, fontWeight: 900, margin: "0 0 4px" }}>
            Shopping list
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "#F8EAD555" }}>
            {formatDate(serviceNight.service_date)} · {totalPizzas} pizza{totalPizzas !== 1 ? "s" : ""} ordered
          </p>
        </div>
        <button
          onClick={reset}
          style={{ background: "transparent", border: "1px solid #F8EAD520", color: "#F8EAD566", borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer", fontFamily: "var(--font-archivo), sans-serif", flexShrink: 0, marginTop: 2 }}
        >
          Reset
        </button>
      </div>

      {/* Progress */}
      <div style={{ margin: "14px 0 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: allDone ? "#2F7D4F" : "#F8EAD544", marginBottom: 6, fontWeight: allDone ? 700 : 400 }}>
          <span>{checkedCount} of {total} checked</span>
          {allDone && <span>All done ✓</span>}
        </div>
        <div style={{ height: 4, background: "#484D52", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: total > 0 ? `${(checkedCount / total) * 100}%` : "0%", background: "#2F7D4F", borderRadius: 2, transition: "width 0.2s" }} />
        </div>
      </div>

      {/* Dough */}
      <SectionHeader label="Dough" />
      <DoughCard
        nightId={serviceNight.id}
        serviceDate={serviceNight.service_date}
        firstPickup={serviceNight.service_start}
        regularPizzas={totalPizzas - glutenFreePizzas}
        glutenFreePizzas={glutenFreePizzas}
        formula={doughFormula}
        formulaSaved={doughFormulaSaved}
        isChecked={!!checked[DOUGH_KEY]}
        onToggle={() => toggle(DOUGH_KEY, "Dough")}
      />

      {/* Ingredients */}
      {ingredients.length > 0 && (
        <>
          <SectionHeader label="Ingredients" />
          <div style={{ display: "grid", gap: 2, marginBottom: 28 }}>
            {ingredients.map(ing => (
              <Row
                key={ing.name}
                label={ing.name}
                sub={`${ing.count} pizza${ing.count !== 1 ? "s" : ""}`}
                isChecked={!!checked[ing.name]}
                onToggle={() => toggle(ing.name, ing.name)}
              />
            ))}
          </div>
        </>
      )}

      {ingredients.length === 0 && totalPizzas === 0 && (
        <p style={{ fontSize: 14, color: "#F8EAD533", marginTop: 20, marginBottom: 28 }}>
          No orders yet for this service night.
        </p>
      )}

      {ingredients.length === 0 && totalPizzas > 0 && (
        <p style={{ fontSize: 14, color: "#F8EAD533", marginTop: 20, marginBottom: 28 }}>
          No ingredients added to pizzas yet — add them in Menu.
        </p>
      )}

      {/* Other */}
      <SectionHeader label="Other" />
      <div style={{ display: "grid", gap: 2, marginBottom: 10 }}>
        {extraItems.map(item => (
          <RowWithDelete
            key={item.id}
            label={item.label}
            isChecked={!!checked[item.itemKey]}
            onToggle={() => toggle(item.itemKey, item.label, true)}
            onDelete={() => removeExtra(item)}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          style={{
            flex: 1, padding: "11px 14px", borderRadius: 10,
            border: "1px solid #F8EAD520", background: "#484D52",
            color: "#F8EAD5", fontSize: 15,
            fontFamily: "var(--font-archivo), sans-serif", outline: "none",
          }}
          placeholder="Add item…"
          value={extraInput}
          onChange={e => setExtraInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") addExtra(); }}
        />
        <button
          onClick={addExtra}
          disabled={!extraInput.trim()}
          style={{
            background: extraInput.trim() ? "#2F7D4F" : "#484D52",
            border: "none", color: "#F8EAD5", borderRadius: 10,
            padding: "11px 18px", fontSize: 15, fontWeight: 700,
            cursor: extraInput.trim() ? "pointer" : "default",
            fontFamily: "var(--font-archivo), sans-serif", flexShrink: 0,
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString("en-US");
const plural = (n: number, word: string) => `${fmt(n)} ${word}${n !== 1 ? "s" : ""}`;

// Regular dough from the formula, plus the GF count and the mix-to-ball timeline
function DoughCard({
  nightId, serviceDate, firstPickup, regularPizzas, glutenFreePizzas, formula, formulaSaved, isChecked, onToggle,
}: {
  nightId: string; serviceDate: string; firstPickup: string;
  regularPizzas: number; glutenFreePizzas: number;
  formula: DoughFormula; formulaSaved: boolean;
  isChecked: boolean; onToggle: () => void;
}) {
  // Walk-up extras are a quick guess for this device only, so they stay in the browser
  const storageKey = `dough-extra-${nightId}`;
  const [extraText, setExtraText] = useState("");
  useEffect(() => {
    try { setExtraText(localStorage.getItem(storageKey) ?? ""); } catch { /* storage blocked */ }
  }, [storageKey]);
  function changeExtra(value: string) {
    setExtraText(value);
    try { localStorage.setItem(storageKey, value); } catch { /* storage blocked */ }
  }
  const extra = Math.max(0, Math.floor(Number(extraText) || 0));

  const batch = calcDoughBatch(regularPizzas + extra, formula);
  const steps = doughCountdown(serviceDate, firstPickup, formula.schedule);
  const scheduleLabel = DOUGH_SCHEDULES.find((s) => s.key === formula.schedule)?.label ?? formula.schedule;

  const muted = { fontSize: 13, color: "#F8EAD577", margin: 0, lineHeight: 1.5 } as const;
  const ingredientRows = [
    { name: "Flour", amount: `${fmt(batch.flour_g)} g`, note: `about ${batch.flour_lb.toFixed(1)} lb` },
    { name: "Water", amount: `${fmt(batch.water_g)} g`, note: `${formula.hydration_pct}% of the flour` },
    { name: "Salt", amount: `${fmt(batch.salt_g)} g`, note: `${formula.salt_pct}% of the flour` },
    { name: "Instant dry yeast", amount: `${batch.yeast_g.toFixed(1)} g`, note: `${formula.yeast_pct}% of the flour` },
  ];

  return (
    <div style={{ marginBottom: 28 }}>
      <Row
        label={`Regular dough: ${plural(batch.balls, "ball")}`}
        sub={`${fmt(batch.totalDough_g)} g`}
        isChecked={isChecked}
        onToggle={onToggle}
        large
      />

      <div style={{ background: "#484D52", border: "1px solid #F8EAD510", borderRadius: 10, padding: "14px", marginTop: 2, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label htmlFor="dough-extra" style={{ fontSize: 14, color: "#F8EAD5cc", flex: 1, minWidth: 160 }}>
            Extra balls for walk-ups
          </label>
          <input
            id="dough-extra"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="0"
            value={extraText}
            onChange={(e) => changeExtra(e.target.value)}
            style={{
              width: 80, padding: "8px 10px", borderRadius: 8,
              border: "1px solid #F8EAD520", background: "#3A3E43",
              color: "#F8EAD5", fontSize: 15, textAlign: "right",
              fontFamily: "var(--font-archivo), sans-serif", outline: "none",
            }}
          />
        </div>

        <p style={muted}>
          {plural(regularPizzas, "pizza")} ordered{extra > 0 ? ` + ${fmt(extra)} extra` : ""} = {plural(batch.balls, "ball")}.
          {glutenFreePizzas > 0 && ` Gluten free pizzas aren't counted here.`}
        </p>

        {batch.balls > 0 ? (
          <>
            <p style={{ ...muted, color: "#F8EAD5cc", fontSize: 14 }}>
              {plural(batch.balls, "ball")} × {fmt(formula.ball_g)} g = {fmt(batch.baseDough_g)} g,
              plus {formula.buffer_pct}% spare = <strong style={{ color: "#F8EAD5" }}>{fmt(batch.totalDough_g)} g of dough</strong>.
            </p>
            <p style={muted}>
              Water, salt and yeast are each a share of the flour, so the flour is{" "}
              {fmt(batch.totalDough_g)} g ÷ {batch.percentSum.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")} = {fmt(batch.flour_g)} g.
            </p>
            <div style={{ display: "grid", gap: 2 }}>
              {ingredientRows.map((r) => (
                <div key={r.name} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "8px 10px", background: "#3A3E43", borderRadius: 8 }}>
                  <span style={{ flex: 1, fontSize: 15, color: "#F8EAD5" }}>{r.name}</span>
                  <span style={{ fontSize: 12, color: "#F8EAD566" }}>{r.note}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#F8EAD5", minWidth: 72, textAlign: "right" }}>{r.amount}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p style={muted}>No regular dough needed yet.</p>
        )}

        <p style={{ ...muted, fontSize: 12, color: formulaSaved ? "#F8EAD555" : "#E8C24A" }}>
          {formulaSaved
            ? <>Formula: {fmt(formula.ball_g)} g balls, {formula.buffer_pct}% spare. Change it in <a href="/admin/settings" style={{ color: "#F8EAD5aa" }}>Settings</a>.</>
            : <>Using the default formula. Run migration 015_dough_formula.sql to save your own.</>}
        </p>
      </div>

      {/* Gluten free: bought or made differently, so just the count */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", marginTop: 8, border: "1px dashed #F8EAD522", borderRadius: 10 }}>
        <span style={{ flex: 1, fontSize: 15, color: "#F8EAD5" }}>
          Gluten free dough: {plural(glutenFreePizzas, "ball")}
        </span>
        <span style={{ fontSize: 12, color: "#F8EAD566" }}>separate oven</span>
      </div>

      {/* Countdown */}
      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#F8EAD577", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>
          {scheduleLabel} dough timeline
        </div>
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
          {steps.map((step) => (
            <li key={step.at + step.label} style={{ fontSize: 14, color: "#F8EAD5cc", lineHeight: 1.45 }}>
              <strong style={{ color: "#F8EAD5" }}>{formatStepTime(step.at)}:</strong> {step.label}
            </li>
          ))}
        </ol>
        <p style={{ ...muted, fontSize: 12, marginTop: 10 }}>
          Hot kitchen? Halve the yeast. Cold kitchen? Give it more time, not more yeast.
        </p>
      </div>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#F8EAD555", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: "#F8EAD512" }} />
    </div>
  );
}

function Row({ label, sub, isChecked, onToggle, large }: {
  label: string; sub: string; isChecked: boolean; onToggle: () => void; large?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "13px 14px",
        background: isChecked ? "#F8EAD506" : "#484D52",
        border: "1px solid #F8EAD510",
        borderRadius: 10,
        cursor: "pointer", textAlign: "left",
        fontFamily: "var(--font-archivo), sans-serif",
        width: "100%",
      }}
    >
      <div style={{
        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
        border: isChecked ? "none" : "2px solid #F8EAD530",
        background: isChecked ? "#2F7D4F" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {isChecked && (
          <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
            <path d="M1.5 5L5 8.5L11.5 1.5" stroke="#F8EAD5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span style={{
        flex: 1, fontSize: large ? 16 : 15, fontWeight: large ? 700 : 400,
        color: isChecked ? "#F8EAD533" : "#F8EAD5",
        textDecoration: isChecked ? "line-through" : "none",
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 13, fontWeight: 700,
        color: isChecked ? "#F8EAD522" : "#F8EAD5aa",
        background: isChecked ? "transparent" : "#3A3E43",
        border: "1px solid #F8EAD510",
        borderRadius: 100, padding: "3px 10px",
        flexShrink: 0, whiteSpace: "nowrap",
      }}>
        {sub}
      </span>
    </button>
  );
}

function RowWithDelete({ label, isChecked, onToggle, onDelete }: {
  label: string; isChecked: boolean; onToggle: () => void; onDelete: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      <button
        onClick={onToggle}
        style={{
          flex: 1, display: "flex", alignItems: "center", gap: 14,
          padding: "13px 14px",
          background: isChecked ? "#F8EAD506" : "#484D52",
          border: "1px solid #F8EAD510",
          borderRadius: 10,
          cursor: "pointer", textAlign: "left",
          fontFamily: "var(--font-archivo), sans-serif",
        }}
      >
        <div style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
          border: isChecked ? "none" : "2px solid #F8EAD530",
          background: isChecked ? "#2F7D4F" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {isChecked && (
            <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
              <path d="M1.5 5L5 8.5L11.5 1.5" stroke="#F8EAD5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <span style={{
          flex: 1, fontSize: 15,
          color: isChecked ? "#F8EAD533" : "#F8EAD5",
          textDecoration: isChecked ? "line-through" : "none",
        }}>
          {label}
        </span>
      </button>
      <button
        onClick={onDelete}
        style={{
          background: "transparent", border: "none",
          color: "#F8EAD533", cursor: "pointer",
          padding: "0 10px", fontSize: 20, lineHeight: 1, flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
