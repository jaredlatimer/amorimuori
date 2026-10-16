"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { makeOrderCloseAt } from "@/lib/service-nights";

interface Settings {
  id: string;
  service_start: string;
  last_pickup: string;
  order_open_day: string;
  order_close_time: string;
  bake_minutes: number;
  nightly_pool: number;
}

interface ServiceNight {
  id: string;
  service_date: string;
  is_enabled: boolean;
  nightly_total: number;
  service_start: string;
  last_pickup: string;
  order_open_at: string;
  order_close_at: string;
}

const inputStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid #F8EAD520",
  background: "#484D52",
  color: "#F8EAD5",
  fontSize: 14,
  fontFamily: "var(--font-archivo), sans-serif",
  outline: "none",
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

export function SettingsClient({ settings: initialSettings, serviceNights: initialNights }: {
  settings: Settings;
  serviceNights: ServiceNight[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [settings, setSettings] = useState(initialSettings);
  const [nights, setNights] = useState(initialNights);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  async function saveSettings() {
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    await Promise.all([
      supabase.from("settings").update({
        service_start: settings.service_start,
        last_pickup: settings.last_pickup,
        order_open_day: settings.order_open_day,
        order_close_time: settings.order_close_time,
        bake_minutes: settings.bake_minutes,
        nightly_pool: settings.nightly_pool,
      }).eq("id", settings.id),
      // Propagate pool size + service times to all upcoming service nights
      supabase.from("service_nights")
        .update({
          nightly_total: settings.nightly_pool,
          service_start: settings.service_start,
          last_pickup: settings.last_pickup,
        })
        .gte("service_date", today),
      // Rebuild order_close_at per upcoming night (date-specific timestamp)
      ...nights
        .filter((n) => n.service_date >= today)
        .map((n) =>
          supabase.from("service_nights")
            .update({ order_close_at: makeOrderCloseAt(n.service_date, settings) })
            .eq("id", n.id)
        ),
    ]);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  const sectionHead = (title: string) => (
    <h2 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#F8EAD577", margin: "0 0 16px" }}>
      {title}
    </h2>
  );

  const card = (children: React.ReactNode) => (
    <div style={{ background: "#484D52", border: "1px solid #F8EAD510", borderRadius: 16, padding: "22px 24px", marginBottom: 28 }}>
      {children}
    </div>
  );

  return (
    <div style={{ paddingTop: 32, maxWidth: 680 }}>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 900, margin: "0 0 28px" }}>Settings</h1>

      {/* Fridays moved to Nights; the reminder list moved to Customers */}
      <p style={{ fontSize: 14, color: "#F8EAD599", margin: "-12px 0 24px" }}>
        Pick which Fridays you run in <a href="/admin/nights" style={{ color: "#F8EAD5" }}>Nights</a>. The reminder list is in{" "}
        <a href="/admin/reminders" style={{ color: "#F8EAD5" }}>Customers</a>. Saving here applies the times and pizza pool to every upcoming Friday.
      </p>

      {/* ── Timing ── */}
      {card(<>
        {sectionHead("Timing")}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[
            { label: "Service start", key: "service_start", type: "time" },
            { label: "Last pickup", key: "last_pickup", type: "time" },
            { label: "Orders close (Friday)", key: "order_close_time", type: "time" },
            { label: "Bake minutes per pizza", key: "bake_minutes", type: "number" },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label style={labelStyle}>{label}</label>
              <input
                type={type}
                value={(settings as unknown as Record<string, string | number>)[key] as string}
                min={type === "number" ? 1 : undefined}
                max={type === "number" ? 30 : undefined}
                onChange={(e) => setSettings((s) => ({ ...s, [key]: type === "number" ? parseInt(e.target.value) || 1 : e.target.value }))}
                style={{ ...inputStyle, width: "100%" }}
              />
            </div>
          ))}
        </div>
      </>)}

      {/* ── Capacity ── */}
      {card(<>
        {sectionHead("Capacity")}
        <div style={{ maxWidth: 200 }}>
          <label style={labelStyle}>Nightly pizza pool</label>
          <input
            type="number"
            value={settings.nightly_pool}
            min={1}
            max={500}
            onChange={(e) => setSettings((s) => ({ ...s, nightly_pool: parseInt(e.target.value) || 1 }))}
            style={{ ...inputStyle, width: "100%" }}
          />
          <p style={{ fontSize: 12, color: "#F8EAD544", marginTop: 6 }}>
            Max pizzas across all orders for one night.
          </p>
        </div>
      </>)}

      {/* Save */}
      <button
        onClick={saveSettings}
        disabled={saving}
        style={{
          background: saved ? "#2F7D4F" : saving ? "#2F7D4F88" : "#2F7D4F",
          border: "none", color: "#F8EAD5", borderRadius: 11,
          padding: "13px 28px", fontSize: 15, fontWeight: 700,
          cursor: saving ? "not-allowed" : "pointer",
          fontFamily: "var(--font-archivo), sans-serif",
        }}
      >
        {saved ? "Saved ✓" : saving ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}
