"use client";

import { useState } from "react";

export interface CustomerRow {
  key: string;
  name: string;
  email: string;
  phone: string;
  orders: number;
  spent_cents: number;
  first_at: string;
  last_at: string;
  came_as_guest: boolean;
  code: string | null;
}

type SortKey = "orders" | "spent" | "last";

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit", timeZone: "America/New_York" });
}

export function CustomersClient({ rows }: { rows: CustomerRow[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("last");
  const [desc, setDesc] = useState(true);
  const query = q.trim().toLowerCase();
  const filtered = query
    ? rows.filter((r) => `${r.name} ${r.email} ${r.phone} ${r.code ?? ""}`.toLowerCase().includes(query))
    : rows;
  const shown = [...filtered].sort((a, b) => {
    const diff =
      sort === "orders" ? a.orders - b.orders : sort === "spent" ? a.spent_cents - b.spent_cents : a.last_at.localeCompare(b.last_at);
    // Ties fall back to the most recent order first
    return (desc ? -diff : diff) || b.last_at.localeCompare(a.last_at);
  });
  const sortBy = (key: SortKey) => {
    if (key === sort) setDesc(!desc);
    else {
      setSort(key);
      setDesc(true);
    }
  };
  const header = (key: SortKey, label: string, className?: string) => (
    <button
      type="button"
      className={`cu-sort${className ? ` ${className}` : ""}${sort === key ? " on" : ""}`}
      onClick={() => sortBy(key)}
      aria-sort={sort === key ? (desc ? "descending" : "ascending") : "none"}
    >
      {label}
      <i>{sort === key ? (desc ? "↓" : "↑") : ""}</i>
    </button>
  );
  const repeat = rows.filter((r) => r.orders > 1).length;

  return (
    <div style={{ paddingTop: 32, maxWidth: 960 }}>
      <style>{CSS}</style>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 900, margin: "0 0 6px" }}>Customers</h1>
          <p style={{ fontSize: 14, color: "#F8EAD577", margin: 0 }}>
            {rows.length} people have paid for an order · {repeat} came back more than once
          </p>
        </div>
        <input
          id="customer-search"
          className="cu-search"
          placeholder="Search name, email, phone or code"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="cu-card">
        <div className="cu-head">
          <span>Customer</span>
          {header("orders", "Orders", "n")}
          {header("spent", "Spent", "n")}
          {header("last", "Last order")}
          <span>Code</span>
        </div>
        {shown.length === 0 && <p className="cu-empty">No one matches &ldquo;{q}&rdquo;.</p>}
        {shown.map((r) => (
          <div key={r.key} className="cu-row">
            <div className="cu-who">
              <b>
                {r.name}
                {r.came_as_guest && <span className="cu-tag">Came as a guest</span>}
              </b>
              <small>{[r.email, r.phone].filter(Boolean).join(" · ")}</small>
            </div>
            <span className="n">{r.orders}</span>
            <span className="n">${(r.spent_cents / 100).toFixed(0)}</span>
            <span className="cu-date">{shortDate(r.last_at)}</span>
            <span>{r.code ? <span className="cu-code">{r.code}</span> : <span className="cu-muted">–</span>}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const CSS = `
.cu-search { width: 280px; max-width: 100%; padding: 10px 14px; border-radius: 12px; border: 1px solid #F8EAD520; background: #484D52; color: #F8EAD5; font: 14px var(--font-archivo), sans-serif; }
.cu-card { background: #484D52; border: 1px solid #F8EAD510; border-radius: 22px; padding: 4px 18px 8px; }
.cu-head, .cu-row { display: grid; grid-template-columns: minmax(0, 1fr) 60px 70px 90px 130px; gap: 12px; align-items: center; }
.cu-head { font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #F8EAD566; padding: 12px 0 8px; }
.cu-row { padding: 11px 0; border-top: 1px solid #F8EAD512; font-size: 14px; }
.cu-sort { all: unset; cursor: pointer; display: flex; gap: 4px; align-items: center; font: inherit; letter-spacing: inherit; text-transform: inherit; color: inherit; }
.cu-sort.n { justify-content: flex-end; }
.cu-sort:hover, .cu-sort.on { color: #F8EAD5; }
.cu-sort i { font-style: normal; width: 8px; }
.cu-sort:focus-visible { outline: 2px solid #E8C24A; outline-offset: 2px; border-radius: 4px; }
.n { text-align: right; font-variant-numeric: tabular-nums; }
.cu-who { display: grid; gap: 2px; min-width: 0; }
.cu-who b { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.cu-who small { color: #F8EAD577; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cu-tag { font-size: 10.5px; font-weight: 800; background: #2F7D4F33; color: #7fd3a0; border-radius: 100px; padding: 2px 8px; }
.cu-date { color: #F8EAD5bb; font-variant-numeric: tabular-nums; }
.cu-code { font-family: ui-monospace, Menlo, monospace; font-size: 11.5px; font-weight: 700; color: #E8C24A; }
.cu-muted { color: #F8EAD544; }
.cu-empty { color: #F8EAD577; font-size: 14px; padding: 12px 0; margin: 0; }
@media (max-width: 700px) {
  .cu-head { display: flex; gap: 16px; }
  .cu-head > span { display: none; }
  .cu-row { grid-template-columns: minmax(0, 1fr) auto; row-gap: 4px; }
  .cu-row > .n:nth-of-type(2), .cu-row > .cu-date { display: none; }
  .cu-row > span:last-child { grid-column: 1; }
}
`;
