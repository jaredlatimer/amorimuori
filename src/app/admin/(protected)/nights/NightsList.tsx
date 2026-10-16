"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { makeOrderCloseAt, makeOrderOpenAt, type ScheduleDefaults } from "@/lib/service-nights";
import { nightStatus, formatNightDate } from "./status";

export interface NightRow {
  id: string;
  service_date: string;
  is_enabled: boolean;
  nightly_total: number;
  order_open_at: string;
  order_close_at: string;
  sold: number;
  revenue_cents: number;
}

type Row = NightRow | { id: null; service_date: string };

export function NightsList({
  rows,
  unscheduled,
  today,
  defaults,
}: {
  rows: NightRow[];
  unscheduled: string[];
  today: string;
  defaults: ScheduleDefaults;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const all: Row[] = [...rows, ...unscheduled.map((d) => ({ id: null, service_date: d }))];
  const upcoming = all.filter((r) => r.service_date >= today).sort((a, b) => a.service_date.localeCompare(b.service_date));
  const past = all.filter((r) => r.service_date < today).sort((a, b) => b.service_date.localeCompare(a.service_date));

  async function addFriday(date: string) {
    setBusy(date);
    setError(null);
    const { data, error: err } = await supabase
      .from("service_nights")
      .insert({
        service_date: date,
        is_enabled: true,
        nightly_total: defaults.nightly_pool,
        service_start: defaults.service_start,
        last_pickup: defaults.last_pickup,
        order_open_at: makeOrderOpenAt(date),
        order_close_at: makeOrderCloseAt(date, defaults),
        sold_out_overrides: {},
        status: "scheduled",
      })
      .select("id")
      .single();
    setBusy(null);
    if (err || !data) {
      setError("Couldn't add that Friday. Try again.");
      return;
    }
    router.refresh();
  }

  async function setRunning(row: NightRow, on: boolean) {
    setBusy(row.service_date);
    setError(null);
    const { error: err } = await supabase.from("service_nights").update({ is_enabled: on }).eq("id", row.id);
    setBusy(null);
    if (err) setError("Couldn't change that Friday. Try again.");
    router.refresh();
  }

  function renderRow(r: Row) {
    const isPast = r.service_date < today;
    if (r.id === null) {
      return (
        <div key={r.service_date} className="nl-row">
          <div className="nl-date">{formatNightDate(r.service_date)}</div>
          <span className="nl-pill none">Not scheduled</span>
          <span className="nl-num" />
          <span className="nl-num" />
          <button className="nl-btn" disabled={busy === r.service_date} onClick={() => addFriday(r.service_date)}>
            Run this Friday
          </button>
        </div>
      );
    }
    const status = nightStatus(r, today);
    return (
      <div key={r.id} className="nl-row">
        <a className="nl-date" href={`/admin/nights/${r.id}`}>
          {formatNightDate(r.service_date)}
        </a>
        <span className={`nl-pill ${status.tone}`}>{status.label}</span>
        <span className="nl-num">{r.is_enabled || r.sold > 0 ? `${r.sold} / ${r.nightly_total}` : "–"}</span>
        <span className="nl-num">{r.revenue_cents > 0 ? `$${Math.round(r.revenue_cents / 100)}` : "–"}</span>
        {isPast ? (
          <a className="nl-btn ghost" href={`/admin/nights/${r.id}?tab=results`}>
            Results
          </a>
        ) : r.is_enabled ? (
          <button className="nl-btn ghost" disabled={busy === r.service_date || r.sold > 0} title={r.sold > 0 ? "This night already has orders" : undefined} onClick={() => setRunning(r, false)}>
            Skip
          </button>
        ) : (
          <button className="nl-btn" disabled={busy === r.service_date} onClick={() => setRunning(r, true)}>
            Run this Friday
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 32, maxWidth: 820 }}>
      <style>{CSS}</style>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 900, margin: "0 0 6px" }}>Nights</h1>
      <p style={{ fontSize: 14, color: "#F8EAD577", margin: "0 0 22px" }}>
        Each Friday you run. Open one for its setup, shopping list, orders, stock and results.
      </p>
      {error && <div className="nl-error">{error}</div>}
      <section className="nl-card">
        <div className="nl-head">
          <span>Upcoming</span>
          <span>Status</span>
          <span className="nl-num">Sold</span>
          <span className="nl-num">Revenue</span>
          <span />
        </div>
        {upcoming.map(renderRow)}
      </section>
      {past.length > 0 && (
        <section className="nl-card">
          <div className="nl-head">
            <span>Past</span>
            <span>Status</span>
            <span className="nl-num">Sold</span>
            <span className="nl-num">Revenue</span>
            <span />
          </div>
          {past.map(renderRow)}
        </section>
      )}
    </div>
  );
}

const CSS = `
.nl-card { background: #484D52; border: 1px solid #F8EAD510; border-radius: 22px; padding: 6px 18px 8px; margin-bottom: 20px; }
.nl-head, .nl-row { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1.2fr) 70px 80px 128px; align-items: center; gap: 12px; }
.nl-head { font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #F8EAD566; padding: 12px 0 8px; }
.nl-row { padding: 11px 0; border-top: 1px solid #F8EAD512; font-size: 14px; }
.nl-date { font-weight: 700; color: #F8EAD5; text-decoration: none; }
a.nl-date:hover { text-decoration: underline; }
.nl-num { text-align: right; font-variant-numeric: tabular-nums; color: #F8EAD5cc; }
.nl-pill { justify-self: start; font-size: 12px; font-weight: 700; border-radius: 100px; padding: 3px 10px; white-space: nowrap; }
.nl-pill.live { background: #2F7D4F33; color: #7fd3a0; }
.nl-pill.open { background: #2F7D4F33; color: #7fd3a0; }
.nl-pill.soon { background: #F8EAD512; color: #F8EAD5bb; }
.nl-pill.closed { background: #C9A22726; color: #E8C24A; }
.nl-pill.off { background: #60403F; color: #F8EAD5aa; }
.nl-pill.done { border: 1px solid #F8EAD522; color: #F8EAD588; }
.nl-pill.none { color: #F8EAD555; padding-left: 0; }
.nl-btn { justify-self: end; border: 0; border-radius: 12px; padding: 7px 14px; background: #2F7D4F; color: #F8EAD5; font: 700 13px var(--font-archivo), sans-serif; cursor: pointer; text-decoration: none; white-space: nowrap; }
.nl-btn.ghost { background: transparent; border: 1px solid #F8EAD526; color: #F8EAD5bb; }
.nl-btn:disabled { opacity: .45; cursor: not-allowed; }
.nl-error { background: #60403F; border-radius: 12px; padding: 10px 14px; margin-bottom: 14px; font-size: 14px; font-weight: 700; }
@media (max-width: 760px) {
  .nl-card { padding: 4px 14px 6px; }
  .nl-head { display: none; }
  .nl-row { grid-template-columns: minmax(0, 1fr) auto; row-gap: 6px; }
  .nl-row .nl-num { display: none; }
  .nl-row .nl-pill { grid-row: 2; grid-column: 1; }
  .nl-row .nl-btn { grid-row: 1 / 3; grid-column: 2; align-self: center; }
}
`;
