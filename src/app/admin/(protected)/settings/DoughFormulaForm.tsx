"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DOUGH_SCHEDULES, type DoughFormula, type DoughSchedule } from "@/lib/dough";

const inputStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid #F8EAD520",
  background: "#3A3E43",
  color: "#F8EAD5",
  fontSize: 14,
  fontFamily: "var(--font-archivo), sans-serif",
  outline: "none",
  width: "100%",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#F8EAD577",
  letterSpacing: 0.8,
  textTransform: "uppercase",
  marginBottom: 5,
  display: "block",
};

const FIELDS: { key: Exclude<keyof DoughFormula, "schedule">; label: string; unit: string; step: string }[] = [
  { key: "ball_g", label: "Ball weight", unit: "g", step: "1" },
  { key: "buffer_pct", label: "Spare dough", unit: "%", step: "0.5" },
  { key: "hydration_pct", label: "Water (hydration)", unit: "%", step: "0.5" },
  { key: "salt_pct", label: "Salt", unit: "%", step: "0.1" },
  { key: "yeast_pct", label: "Instant dry yeast", unit: "%", step: "0.01" },
];

// Its own form and endpoint on purpose: the main Settings save also rewrites every upcoming night
export function DoughFormulaForm({ initial, migrated }: { initial: DoughFormula; migrated: boolean }) {
  const router = useRouter();
  const [formula, setFormula] = useState(initial);
  // Keep raw text so typing "0." or clearing a box doesn't fight the input
  const [text, setText] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, String(initial[f.key])])),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/dough-formula", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formula),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Failed to save");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  return (
    <div style={{ background: "#484D52", border: "1px solid #F8EAD510", borderRadius: 16, padding: "22px 24px", margin: "36px 0 28px" }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#F8EAD577", margin: "0 0 6px" }}>
        Dough formula
      </h2>
      <p style={{ fontSize: 13, color: "#F8EAD577", margin: "0 0 16px" }}>
        Used for the dough math on each night&apos;s Shopping tab. Water, salt and yeast are a percentage of the flour.
        This has its own Save and doesn&apos;t touch your Fridays.
      </p>
      {!migrated && (
        <p style={{ fontSize: 13, color: "#E8C24A", margin: "0 0 16px" }}>
          Showing the defaults. Run migration 015_dough_formula.sql in Supabase to save your own.
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
        {FIELDS.map(({ key, label, unit, step }) => (
          <div key={key}>
            <label style={labelStyle}>{label} ({unit})</label>
            <input
              type="number"
              inputMode="decimal"
              step={step}
              min={0}
              value={text[key]}
              onChange={(e) => {
                setText((t) => ({ ...t, [key]: e.target.value }));
                const n = parseFloat(e.target.value);
                if (Number.isFinite(n)) setFormula((f) => ({ ...f, [key]: n }));
              }}
              style={inputStyle}
            />
          </div>
        ))}
        <div>
          <label style={labelStyle}>Fermentation</label>
          <select
            value={formula.schedule}
            onChange={(e) => setFormula((f) => ({ ...f, schedule: e.target.value as DoughSchedule }))}
            style={inputStyle}
          >
            {DOUGH_SCHEDULES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 20 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            background: saving ? "#2F7D4F88" : "#2F7D4F",
            border: "none", color: "#F8EAD5", borderRadius: 11,
            padding: "11px 22px", fontSize: 14, fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer",
            fontFamily: "var(--font-archivo), sans-serif",
          }}
        >
          {saved ? "Saved ✓" : saving ? "Saving…" : "Save dough formula"}
        </button>
        {error && <span style={{ fontSize: 13, color: "#E8C24A" }}>{error}</span>}
      </div>
    </div>
  );
}
