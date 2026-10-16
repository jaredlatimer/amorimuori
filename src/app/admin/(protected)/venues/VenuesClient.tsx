"use client";

import { useRef, useState } from "react";
import {
  VENUE_DEAL_TYPES,
  VENUE_STATUSES,
  todayET,
  type VenueDealType,
  type VenueRow,
  type VenueStatus,
} from "@/lib/venues";

type Filter = "all" | VenueStatus;

type Draft = Omit<VenueRow, "id" | "created_at" | "updated_at"> & { id: string | null };

const EMPTY: Draft = {
  id: null,
  name: "",
  contact_name: "",
  email: "",
  phone: "",
  address: "",
  deal_type: "hybrid",
  deal_notes: "",
  status: "prospect",
  last_contacted_on: "",
  next_booked_on: "",
  notes: "",
};

const STATUS_COLOR: Record<VenueStatus, { bg: string; fg: string }> = {
  prospect: { bg: "#F8EAD5", fg: "#2C2F33" },
  contacted: { bg: "#E8C24A", fg: "#2C2F33" },
  booked: { bg: "#2F7D4F", fg: "#F8EAD5" },
  regular: { bg: "#1F5C39", fg: "#F8EAD5" },
  not_a_fit: { bg: "#60403F", fg: "#F8EAD5" },
};

function shortDate(d: string | null) {
  if (!d) return null;
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** "today", "3 days ago", "in 12 days" */
function relative(d: string) {
  const days = Math.round((Date.parse(d + "T12:00:00") - Date.parse(todayET() + "T12:00:00")) / 86_400_000);
  if (days === 0) return "today";
  if (days === -1) return "yesterday";
  if (days === 1) return "tomorrow";
  return days < 0 ? `${-days} days ago` : `in ${days} days`;
}

export function VenuesClient({ rows: initial, migrated, loadFailed }: { rows: VenueRow[]; migrated: boolean; loadFailed: boolean }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const count = (s: VenueStatus) => rows.filter((r) => r.status === s).length;
  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  function openForm(d: Draft) {
    setError(null);
    setDraft(d);
    // Wait for the form to render, then bring it into view
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function edit(r: VenueRow) {
    openForm({
      ...r,
      contact_name: r.contact_name ?? "",
      email: r.email ?? "",
      phone: r.phone ?? "",
      address: r.address ?? "",
      deal_notes: r.deal_notes ?? "",
      last_contacted_on: r.last_contacted_on ?? "",
      next_booked_on: r.next_booked_on ?? "",
      notes: r.notes ?? "",
    });
  }

  function upsert(v: VenueRow) {
    setRows((rs) => {
      const next = rs.some((r) => r.id === v.id) ? rs.map((r) => (r.id === v.id ? v : r)) : [...rs, v];
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setError(null);
    setSaving("form");
    try {
      const res = await fetch("/api/admin/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      upsert(json.venue as VenueRow);
      setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(null);
    }
  }

  async function contactedToday(r: VenueRow) {
    setError(null);
    setSaving(r.id);
    try {
      const res = await fetch("/api/admin/venues/contacted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId: r.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Failed to update");
      upsert(json.venue as VenueRow);
    } catch (err) {
      setError(`${r.name}: ${err instanceof Error ? err.message : "Failed to update"}`);
    } finally {
      setSaving(null);
    }
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  return (
    <div style={{ paddingTop: 32, maxWidth: 960 }}>
      <style>{CSS}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 900, margin: "0 0 6px" }}>Venues</h1>
          <p style={{ fontSize: 14, color: "#F8EAD577", margin: "0 0 18px" }}>
            Breweries and wineries for pop-ups · {rows.length} total · {count("booked")} booked · {count("regular")} regular
          </p>
        </div>
        <button type="button" className="vn-btn primary" disabled={!migrated} onClick={() => openForm({ ...EMPTY })}>
          Add venue
        </button>
      </div>

      {!migrated && (
        <p className="vn-note">
          Run <b>supabase/migrations/016_venues.sql</b> in the Supabase SQL editor to turn on the venues list.
        </p>
      )}
      {loadFailed && <p className="vn-note">Couldn&apos;t load venues. Check the server logs.</p>}
      {error && <p className="vn-note" role="alert">{error}</p>}

      {draft && (
        <form ref={formRef} onSubmit={save} className="vn-card vn-form">
          <b style={{ fontSize: 17 }}>{draft.id ? `Edit ${draft.name || "venue"}` : "New venue"}</b>
          <div className="vn-grid">
            <label>Venue name<input required value={draft.name} onChange={(e) => set("name", e.target.value)} /></label>
            <label>Contact name<input value={draft.contact_name ?? ""} onChange={(e) => set("contact_name", e.target.value)} /></label>
            <label>Email<input type="email" value={draft.email ?? ""} onChange={(e) => set("email", e.target.value)} /></label>
            <label>Phone<input type="tel" value={draft.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></label>
            <label className="wide">Address or town<input value={draft.address ?? ""} onChange={(e) => set("address", e.target.value)} /></label>
            <label>
              Deal type
              <select value={draft.deal_type} onChange={(e) => set("deal_type", e.target.value as VenueDealType)}>
                {VENUE_DEAL_TYPES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
              <small>{VENUE_DEAL_TYPES.find((d) => d.id === draft.deal_type)?.hint}</small>
            </label>
            <label>
              Status
              <select value={draft.status} onChange={(e) => set("status", e.target.value as VenueStatus)}>
                {VENUE_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <label className="wide">
              Deal notes
              <textarea rows={2} value={draft.deal_notes ?? ""} placeholder="e.g. $12 a pizza, they keep drink sales, 2nd Saturday each month" onChange={(e) => set("deal_notes", e.target.value)} />
            </label>
            <label>Last contacted<input type="date" value={draft.last_contacted_on ?? ""} onChange={(e) => set("last_contacted_on", e.target.value)} /></label>
            <label>Next booked date<input type="date" value={draft.next_booked_on ?? ""} onChange={(e) => set("next_booked_on", e.target.value)} /></label>
            <label className="wide">Notes<textarea rows={3} value={draft.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></label>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="vn-btn primary" disabled={saving === "form"}>{saving === "form" ? "Saving…" : "Save"}</button>
            <button type="button" className="vn-btn" onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="vn-filters" role="group" aria-label="Filter by status">
        <button type="button" className={filter === "all" ? "on" : undefined} onClick={() => setFilter("all")}>
          All {rows.length}
        </button>
        {VENUE_STATUSES.map((s) => (
          <button key={s.id} type="button" className={filter === s.id ? "on" : undefined} onClick={() => setFilter(s.id)}>
            {s.label} {count(s.id)}
          </button>
        ))}
      </div>

      {shown.length === 0 && migrated && (
        <p style={{ color: "#F8EAD577", fontSize: 14 }}>
          {rows.length === 0 ? "No venues yet. Add the breweries and wineries you'd like to pop up at." : "Nothing with this status."}
        </p>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {shown.map((r) => {
          const deal = VENUE_DEAL_TYPES.find((d) => d.id === r.deal_type);
          const status = VENUE_STATUSES.find((s) => s.id === r.status);
          return (
            <article key={r.id} className="vn-card">
              <div className="vn-top">
                <div style={{ minWidth: 0 }}>
                  <b style={{ fontSize: 17 }}>{r.name}</b>
                  <small>
                    {[r.contact_name, r.email, r.phone, r.address].filter(Boolean).join(" · ") || "No contact details yet"}
                  </small>
                </div>
                <span className="vn-pill" style={{ background: STATUS_COLOR[r.status].bg, color: STATUS_COLOR[r.status].fg }}>
                  {status?.label ?? r.status}
                </span>
              </div>
              <dl className="vn-facts">
                <div><dt>Deal</dt><dd>{deal?.label ?? r.deal_type}</dd></div>
                <div>
                  <dt>Last contacted</dt>
                  <dd>{r.last_contacted_on ? `${shortDate(r.last_contacted_on)} (${relative(r.last_contacted_on)})` : "Never"}</dd>
                </div>
                <div>
                  <dt>Next booked</dt>
                  <dd>{r.next_booked_on ? `${shortDate(r.next_booked_on)} (${relative(r.next_booked_on)})` : "Nothing booked"}</dd>
                </div>
              </dl>
              {r.deal_notes && <p className="vn-line"><span>Deal notes</span>{r.deal_notes}</p>}
              {r.notes && <p className="vn-line"><span>Notes</span>{r.notes}</p>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="vn-btn" onClick={() => edit(r)}>Edit</button>
                <button
                  type="button"
                  className="vn-btn"
                  disabled={saving === r.id || r.last_contacted_on === todayET()}
                  onClick={() => contactedToday(r)}
                >
                  {r.last_contacted_on === todayET() ? "Contacted today ✓" : saving === r.id ? "Saving…" : "Mark contacted today"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

const CSS = `
.vn-note { background: #E8C24A22; border: 1px solid #E8C24A55; color: #F8EAD5; border-radius: 12px; padding: 10px 14px; font-size: 13.5px; margin: 0 0 14px; }
.vn-filters { display: flex; gap: 6px; flex-wrap: wrap; margin: 4px 0 16px; }
.vn-filters button, .vn-btn { font: 700 13px var(--font-archivo), sans-serif; padding: 6px 12px; border-radius: 100px; border: 1px solid #F8EAD520; background: transparent; color: #F8EAD5aa; cursor: pointer; }
.vn-filters button.on { background: #F8EAD5; color: #484D52; border-color: transparent; }
.vn-btn.primary { background: #2F7D4F; color: #F8EAD5; border-color: transparent; padding: 8px 16px; }
.vn-btn:disabled { cursor: default; opacity: .55; }
.vn-filters button:focus-visible, .vn-btn:focus-visible { outline: 2px solid #E8C24A; outline-offset: 2px; }
.vn-card { background: #484D52; border: 1px solid #F8EAD510; border-radius: 22px; padding: 16px 18px; display: grid; gap: 12px; }
.vn-form { margin-bottom: 18px; border-color: #E8C24A55; scroll-margin-top: 16px; }
.vn-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.vn-top small { display: block; color: #F8EAD577; font-size: 12px; margin-top: 2px; overflow-wrap: anywhere; }
.vn-pill { font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 100px; white-space: nowrap; }
.vn-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px 16px; margin: 0; }
.vn-facts dt { font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #F8EAD566; }
.vn-facts dd { margin: 2px 0 0; font-size: 14px; }
.vn-line { margin: 0; font-size: 14px; line-height: 1.5; white-space: pre-wrap; }
.vn-line > span { display: inline-block; width: 96px; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #F8EAD566; }
.vn-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px 14px; }
.vn-grid label { display: grid; gap: 4px; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #F8EAD599; }
.vn-grid label.wide { grid-column: 1 / -1; }
.vn-grid small { font-size: 12px; font-weight: 400; letter-spacing: 0; text-transform: none; color: #F8EAD577; }
.vn-grid input, .vn-grid select, .vn-grid textarea { font: 400 14px var(--font-archivo), sans-serif; letter-spacing: 0; text-transform: none; color: #F8EAD5; background: #3A3E43; border: 1px solid #F8EAD522; border-radius: 10px; padding: 8px 10px; }
.vn-grid input:focus, .vn-grid select:focus, .vn-grid textarea:focus { outline: 2px solid #E8C24A; outline-offset: 1px; }
`;
