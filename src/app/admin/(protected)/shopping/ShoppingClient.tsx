"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  serviceNight: { id: string; service_date: string };
  totalPizzas: number;
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

export function ShoppingClient({ serviceNight, totalPizzas, ingredients, initialCheckedKeys, initialCustomItems }: Props) {
  const [checked, setChecked] = useState<CheckedState>(() =>
    Object.fromEntries(initialCheckedKeys.map(k => [k, true]))
  );
  const [extraItems, setExtraItems] = useState<ExtraItem[]>(
    initialCustomItems.map(({ id, itemKey, label }) => ({ id, itemKey, label }))
  );
  const [extraInput, setExtraInput] = useState("");

  // Realtime sync — instant cross-device updates
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`shopping-${serviceNight.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shopping_items", filter: `service_night_id=eq.${serviceNight.id}` },
        (payload) => {
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            const row = payload.new as { id: string; item_key: string; label: string; is_checked: boolean; is_custom: boolean };
            setChecked(prev => ({ ...prev, [row.item_key]: row.is_checked }));
            if (row.is_custom) {
              setExtraItems(prev =>
                prev.some(i => i.id === row.id)
                  ? prev
                  : [...prev, { id: row.id, itemKey: row.item_key, label: row.label }]
              );
            }
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as { id: string; item_key: string };
            setChecked(prev => { const { [row.item_key]: _, ...rest } = prev; return rest; });
            setExtraItems(prev => prev.filter(i => i.id !== row.id));
          }
        }
      )
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
      <div style={{ marginBottom: 28 }}>
        <Row
          label={`${totalPizzas} dough ball${totalPizzas !== 1 ? "s" : ""}`}
          sub={`${(totalPizzas * 200).toLocaleString()}g total`}
          isChecked={!!checked[DOUGH_KEY]}
          onToggle={() => toggle(DOUGH_KEY, "Dough")}
          large
        />
      </div>

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
