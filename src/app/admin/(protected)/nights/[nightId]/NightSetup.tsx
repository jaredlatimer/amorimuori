"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

const ET = "America/New_York";

/** "2026-10-14T10:00" in Eastern time, for a datetime-local input. */
function toLocalInput(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ET, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Eastern-time input value back to a timestamp, with the right offset for that date (EDT or EST). */
function fromLocalInput(value: string) {
  const guess = new Date(`${value}:00Z`);
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: ET, timeZoneName: "shortOffset" })
    .formatToParts(guess)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT-5";
  const hours = Number(offset.replace("GMT", "")) || -5;
  const sign = hours < 0 ? "-" : "+";
  return `${value}:00${sign}${String(Math.abs(hours)).padStart(2, "0")}:00`;
}

export function NightSetup({ night }: { night: Night }) {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({
    is_enabled: night.is_enabled,
    nightly_total: String(night.nightly_total),
    service_start: night.service_start.slice(0, 5),
    last_pickup: night.last_pickup.slice(0, 5),
    order_open_at: toLocalInput(night.order_open_at),
    order_close_at: toLocalInput(night.order_close_at),
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setMessage(null);
  }

  async function save() {
    const pool = parseInt(form.nightly_total, 10);
    if (!Number.isFinite(pool) || pool < 0) {
      setMessage({ ok: false, text: "Pizza pool needs to be a whole number." });
      return;
    }
    if (form.order_close_at <= form.order_open_at) {
      setMessage({ ok: false, text: "Ordering has to close after it opens." });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("service_nights")
      .update({
        is_enabled: form.is_enabled,
        nightly_total: pool,
        service_start: form.service_start,
        last_pickup: form.last_pickup,
        order_open_at: fromLocalInput(form.order_open_at),
        order_close_at: fromLocalInput(form.order_close_at),
      })
      .eq("id", night.id);
    setSaving(false);
    if (error) {
      setMessage({ ok: false, text: "Couldn't save. Check your connection and try again." });
      return;
    }
    setMessage({ ok: true, text: "Saved" });
    router.refresh();
  }

  return (
    <div style={{ paddingTop: 20, maxWidth: 560 }}>
      <style>{CSS}</style>
      <div className="ns-card">
        <label className="ns-toggle">
          <input type="checkbox" checked={form.is_enabled} onChange={(e) => set("is_enabled", e.target.checked)} />
          <span>
            <b>{form.is_enabled ? "Running this Friday" : "Skipping this Friday"}</b>
            <small>Customers can only order for Fridays you're running.</small>
          </span>
        </label>
        <div className="ns-grid">
          <label>
            <span>Pizza pool</span>
            <input id="ns-pool" type="number" min={0} value={form.nightly_total} onChange={(e) => set("nightly_total", e.target.value)} />
          </label>
          <span />
          <label>
            <span>First pickup</span>
            <input id="ns-start" type="time" value={form.service_start} onChange={(e) => set("service_start", e.target.value)} />
          </label>
          <label>
            <span>Last pickup</span>
            <input id="ns-last" type="time" value={form.last_pickup} onChange={(e) => set("last_pickup", e.target.value)} />
          </label>
          <label>
            <span>Ordering opens</span>
            <input id="ns-open" type="datetime-local" value={form.order_open_at} onChange={(e) => set("order_open_at", e.target.value)} />
          </label>
          <label>
            <span>Ordering closes</span>
            <input id="ns-close" type="datetime-local" value={form.order_close_at} onChange={(e) => set("order_close_at", e.target.value)} />
          </label>
        </div>
        <div className="ns-foot">
          <button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save this Friday"}</button>
          {message && <span className={message.ok ? "ok" : "err"}>{message.text}</span>}
        </div>
        <p className="ns-note">
          Times are Eastern. Saving the defaults in Settings resets the pool and pickup times for every upcoming Friday.
        </p>
      </div>
    </div>
  );
}

const CSS = `
.ns-card { background: #484D52; border: 1px solid #F8EAD510; border-radius: 22px; padding: 22px 24px; display: grid; gap: 20px; }
.ns-toggle { display: flex; gap: 12px; align-items: flex-start; cursor: pointer; }
.ns-toggle input { width: 20px; height: 20px; accent-color: #2F7D4F; margin-top: 2px; }
.ns-toggle span { display: grid; gap: 2px; }
.ns-toggle small { color: #F8EAD577; font-size: 13px; }
.ns-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.ns-grid label { display: grid; gap: 6px; }
.ns-grid label span { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #F8EAD577; }
.ns-grid input { min-width: 0; padding: 10px 12px; border-radius: 10px; border: 1px solid #F8EAD520; background: #3A3E43; color: #F8EAD5; font: 14px var(--font-archivo), sans-serif; color-scheme: dark; }
.ns-foot { display: flex; align-items: center; gap: 14px; }
.ns-foot button { background: #2F7D4F; border: 0; color: #F8EAD5; border-radius: 12px; padding: 11px 22px; font: 700 14px var(--font-archivo), sans-serif; cursor: pointer; }
.ns-foot button:disabled { opacity: .6; cursor: wait; }
.ns-foot .ok { color: #7fd3a0; font-weight: 700; font-size: 14px; }
.ns-foot .err { color: #f0a0a0; font-weight: 700; font-size: 14px; }
.ns-note { margin: 0; font-size: 12px; color: #F8EAD566; }
@media (max-width: 560px) { .ns-grid { grid-template-columns: minmax(0, 1fr); } .ns-grid > span { display: none; } }
`;
