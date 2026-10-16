"use client";

import { useState } from "react";
import {
  INQUIRY_STATUSES,
  findPackage,
  shortEstimate,
  type InquiryStatus,
} from "@/lib/event-packages";

export interface InquiryRow {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  event_date: string;
  location: string;
  guest_count: number;
  event_type: string | null;
  package: string | null;
  dietary_notes: string | null;
  serving_window: string | null;
  notes: string | null;
  status: InquiryStatus;
  status_updated_at: string | null;
}

type Filter = "all" | InquiryStatus;

const STATUS_COLOR: Record<InquiryStatus, { bg: string; fg: string }> = {
  new: { bg: "#E8C24A", fg: "#2C2F33" },
  proposal_sent: { bg: "#F8EAD5", fg: "#2C2F33" },
  booked: { bg: "#2F7D4F", fg: "#F8EAD5" },
  lost: { bg: "#60403F", fg: "#F8EAD5" },
};

function eventDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function receivedAt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
}

export function EventsClient({ rows: initial, migrated, loadFailed }: { rows: InquiryRow[]; migrated: boolean; loadFailed: boolean }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const count = (s: InquiryStatus) => rows.filter((r) => r.status === s).length;
  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  async function setStatus(row: InquiryRow, status: InquiryStatus) {
    if (row.status === status) return;
    const before = row.status;
    setError(null);
    setSaving(row.id);
    // Optimistic; put it back if the save fails
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, status } : r)));
    try {
      const res = await fetch("/api/admin/event-inquiry-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inquiryId: row.id, status }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Failed to update");
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, status_updated_at: json.inquiry?.status_updated_at ?? r.status_updated_at } : r)));
    } catch (err) {
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, status: before } : r)));
      setError(`${row.name}: ${err instanceof Error ? err.message : "Failed to update"}`);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div style={{ paddingTop: 32, maxWidth: 960 }}>
      <style>{CSS}</style>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 900, margin: "0 0 6px" }}>Events</h1>
      <p style={{ fontSize: 14, color: "#F8EAD577", margin: "0 0 18px" }}>
        Requests from the Events page, newest first · {rows.length} total · {count("new")} new · {count("booked")} booked
      </p>

      {!migrated && (
        <p className="ev-in-note">
          Run <b>supabase/migrations/011_events.sql</b> in the Supabase SQL editor to turn on statuses, packages and
          dietary notes. Until then these show as New and can&apos;t be changed.
        </p>
      )}
      {loadFailed && <p className="ev-in-note">Couldn&apos;t load inquiries. Check the server logs.</p>}
      {error && <p className="ev-in-note" role="alert">{error}</p>}

      <div className="ev-in-filters" role="group" aria-label="Filter by status">
        <button type="button" className={filter === "all" ? "on" : undefined} onClick={() => setFilter("all")}>
          All {rows.length}
        </button>
        {INQUIRY_STATUSES.map((s) => (
          <button key={s.id} type="button" className={filter === s.id ? "on" : undefined} onClick={() => setFilter(s.id)}>
            {s.label} {count(s.id)}
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <p style={{ color: "#F8EAD577", fontSize: 14 }}>
          {rows.length === 0 ? "No event requests yet. They land here when someone sends the form on /events." : "Nothing with this status."}
        </p>
      )}

      <div style={{ display: "grid", gap: 14 }}>
        {shown.map((r) => {
          const pkg = findPackage(r.package);
          // No package picked yet: show what the most popular one would come to
          const estPkg = pkg ?? findPackage("amori")!;
          return (
            <article key={r.id} className="ev-in-card">
              <div className="ev-in-top">
                <div style={{ minWidth: 0 }}>
                  <b style={{ fontSize: 17 }}>{r.name}</b>
                  <small>
                    {[r.email, r.phone].filter(Boolean).join(" · ")} · received {receivedAt(r.created_at)}
                  </small>
                </div>
                <div className="ev-in-status" role="group" aria-label={`Status for ${r.name}`}>
                  {INQUIRY_STATUSES.map((s) => {
                    const on = r.status === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={on}
                        disabled={!migrated || saving === r.id}
                        onClick={() => setStatus(r, s.id)}
                        style={on ? { background: STATUS_COLOR[s.id].bg, color: STATUS_COLOR[s.id].fg, borderColor: "transparent" } : undefined}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <dl className="ev-in-facts">
                <div><dt>Date</dt><dd>{eventDate(r.event_date)}</dd></div>
                <div><dt>Guests</dt><dd>{r.guest_count}</dd></div>
                <div><dt>Package</dt><dd>{pkg ? pkg.name : "Not sure yet"}</dd></div>
                <div><dt>Where</dt><dd>{r.location}</dd></div>
                {r.event_type && <div><dt>Kind</dt><dd>{r.event_type}</dd></div>}
                {r.serving_window && <div><dt>Serving</dt><dd>{r.serving_window}</dd></div>}
              </dl>

              <p className="ev-in-line">
                <span>Estimate</span>
                {pkg ? `${pkg.name}: ` : `No package picked. On ${estPkg.name} it would be `}
                {shortEstimate(estPkg, r.guest_count)}
              </p>
              <p className="ev-in-line">
                <span>Dietary</span>
                {r.dietary_notes ?? <i style={{ color: "#F8EAD566" }}>None given</i>}
              </p>
              {r.notes && (
                <p className="ev-in-line">
                  <span>Notes</span>
                  {r.notes}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

const CSS = `
.ev-in-note { background: #E8C24A22; border: 1px solid #E8C24A55; color: #F8EAD5; border-radius: 12px; padding: 10px 14px; font-size: 13.5px; margin: 0 0 14px; }
.ev-in-filters { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
.ev-in-filters button, .ev-in-status button { font: 700 13px var(--font-archivo), sans-serif; padding: 6px 12px; border-radius: 100px; border: 1px solid #F8EAD520; background: transparent; color: #F8EAD5aa; cursor: pointer; }
.ev-in-filters button.on { background: #F8EAD5; color: #484D52; border-color: transparent; }
.ev-in-status button:disabled { cursor: default; opacity: .55; }
.ev-in-filters button:focus-visible, .ev-in-status button:focus-visible { outline: 2px solid #E8C24A; outline-offset: 2px; }
.ev-in-card { background: #484D52; border: 1px solid #F8EAD510; border-radius: 22px; padding: 16px 18px; display: grid; gap: 12px; }
.ev-in-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
.ev-in-top small { display: block; color: #F8EAD577; font-size: 12px; margin-top: 2px; overflow-wrap: anywhere; }
.ev-in-status { display: flex; gap: 6px; flex-wrap: wrap; }
.ev-in-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px 16px; margin: 0; }
.ev-in-facts dt { font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #F8EAD566; }
.ev-in-facts dd { margin: 2px 0 0; font-size: 14px; font-variant-numeric: tabular-nums; }
.ev-in-line { margin: 0; font-size: 14px; line-height: 1.5; white-space: pre-wrap; font-variant-numeric: tabular-nums; }
.ev-in-line > span { display: inline-block; width: 74px; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #F8EAD566; }
`;
