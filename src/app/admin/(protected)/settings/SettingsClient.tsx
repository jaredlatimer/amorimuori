"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ET = "America/New_York";

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

function getUpcomingFridays(n = 16): string[] {
  const results: string[] = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  const daysUntilFriday = (5 - day + 7) % 7;
  d.setDate(d.getDate() + (daysUntilFriday === 0 ? 0 : daysUntilFriday));
  for (let i = 0; i < n; i++) {
    results.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 7);
  }
  return results;
}

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

function makeOrderOpenAt(fridayDate: string, settings: Settings): string {
  // Wednesday before at 10 AM ET
  const friday = new Date(fridayDate + "T12:00:00Z");
  const wednesday = new Date(friday);
  wednesday.setDate(friday.getDate() - 2);
  const ymd = wednesday.toISOString().slice(0, 10);
  return `${ymd}T10:00:00-04:00`;
}

function makeOrderCloseAt(fridayDate: string, settings: Settings): string {
  const t = settings.order_close_time.slice(0, 5);
  return `${fridayDate}T${t}:00-04:00`;
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
  const [toggling, setToggling] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const fridays = getUpcomingFridays(16);
  const nightsByDate = Object.fromEntries(nights.map((n) => [n.service_date, n]));

  async function toggleFriday(fridayDate: string) {
    setToggling(fridayDate);
    const existing = nightsByDate[fridayDate];

    if (existing) {
      await supabase.from("service_nights").update({ is_enabled: !existing.is_enabled }).eq("id", existing.id);
      setNights((prev) => prev.map((n) => n.service_date === fridayDate ? { ...n, is_enabled: !n.is_enabled } : n));
    } else {
      const { data } = await supabase.from("service_nights").insert({
        service_date: fridayDate,
        is_enabled: true,
        nightly_total: settings.nightly_pool,
        service_start: settings.service_start,
        last_pickup: settings.last_pickup,
        order_open_at: makeOrderOpenAt(fridayDate, settings),
        order_close_at: makeOrderCloseAt(fridayDate, settings),
        sold_out_overrides: {},
        status: "scheduled",
      }).select().single();
      if (data) setNights((prev) => [...prev, data as ServiceNight].sort((a, b) => a.service_date.localeCompare(b.service_date)));
    }
    setToggling(null);
  }

  async function saveSettings() {
    setSaving(true);
    await supabase.from("settings").update({
      service_start: settings.service_start,
      last_pickup: settings.last_pickup,
      order_open_day: settings.order_open_day,
      order_close_time: settings.order_close_time,
      bake_minutes: settings.bake_minutes,
      nightly_pool: settings.nightly_pool,
    }).eq("id", settings.id);
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

      {/* ── Service Fridays ── */}
      {card(<>
        {sectionHead("Service Fridays")}
        <p style={{ fontSize: 14, color: "#F8EAD577", marginBottom: 18, marginTop: -8 }}>
          Toggle on the Fridays you're running service. Customers can only order for enabled nights.
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          {fridays.map((date) => {
            const night = nightsByDate[date];
            const enabled = night?.is_enabled ?? false;
            const isToggling = toggling === date;
            return (
              <div key={date} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #F8EAD50a" }}>
                <div>
                  <span style={{ fontSize: 15, fontWeight: enabled ? 700 : 400, color: enabled ? "#F8EAD5" : "#F8EAD555" }}>
                    {fmtDate(date)}
                  </span>
                  {night && (
                    <span style={{ fontSize: 12, color: "#F8EAD533", marginLeft: 10 }}>
                      Opens {new Date(night.order_open_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: ET })}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => toggleFriday(date)}
                  disabled={isToggling}
                  style={{
                    width: 48, height: 28, borderRadius: 14,
                    background: enabled ? "#2F7D4F" : "#F8EAD520",
                    border: "none", cursor: isToggling ? "not-allowed" : "pointer",
                    position: "relative", transition: "background 0.2s", flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: "absolute", top: 3, left: enabled ? 23 : 3,
                    width: 22, height: 22, borderRadius: "50%",
                    background: "#F8EAD5", transition: "left 0.2s",
                  }} />
                </button>
              </div>
            );
          })}
        </div>
      </>)}

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
