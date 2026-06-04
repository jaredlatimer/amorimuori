"use client";

import { useState, useEffect } from "react";

interface Props {
  serviceNight: { id: string; service_date: string };
  totalPizzas: number;
  ingredients: { name: string; count: number }[];
}

type CheckedState = Record<string, boolean>;

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

export function ShoppingClient({ serviceNight, totalPizzas, ingredients }: Props) {
  const storageKey = `shopping-checked-${serviceNight.id}`;
  const [checked, setChecked] = useState<CheckedState>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try { setChecked(JSON.parse(stored)); } catch { /* ignore */ }
    }
    setHydrated(true);
  }, [storageKey]);

  function toggle(key: string) {
    setChecked(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  function reset() {
    setChecked({});
    localStorage.removeItem(storageKey);
  }

  if (!hydrated) return null;

  const DOUGH_KEY = "dough";
  const allKeys = [DOUGH_KEY, ...ingredients.map(i => i.name)];
  const checkedCount = allKeys.filter(k => checked[k]).length;
  const total = allKeys.length;
  const allDone = total > 0 && checkedCount === total;

  return (
    <div style={{
      padding: "28px 0 80px",
      fontFamily: "var(--font-archivo), sans-serif",
      maxWidth: 540,
    }}>

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
      <div style={{ marginBottom: 28 }}>
        <Row
          label={`${totalPizzas} dough ball${totalPizzas !== 1 ? "s" : ""}`}
          sub={`${(totalPizzas * 200).toLocaleString()}g total`}
          isChecked={!!checked[DOUGH_KEY]}
          onToggle={() => toggle(DOUGH_KEY)}
          large
        />
      </div>

      {/* Ingredients */}
      {ingredients.length > 0 && (
        <>
          <SectionHeader label="Ingredients" />
          <div style={{ display: "grid", gap: 2 }}>
            {ingredients.map(ing => (
              <Row
                key={ing.name}
                label={ing.name}
                sub={`${ing.count} pizza${ing.count !== 1 ? "s" : ""}`}
                isChecked={!!checked[ing.name]}
                onToggle={() => toggle(ing.name)}
              />
            ))}
          </div>
        </>
      )}

      {ingredients.length === 0 && totalPizzas === 0 && (
        <p style={{ fontSize: 14, color: "#F8EAD533", marginTop: 20 }}>
          No orders yet for this service night.
        </p>
      )}

      {ingredients.length === 0 && totalPizzas > 0 && (
        <p style={{ fontSize: 14, color: "#F8EAD533", marginTop: 20 }}>
          No ingredients added to pizzas yet — add them in Menu.
        </p>
      )}
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
        flex: 1,
        fontSize: large ? 16 : 15,
        fontWeight: large ? 700 : 400,
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
