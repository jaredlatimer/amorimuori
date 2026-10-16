"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CancelOrderModal, type CancelMode } from "../CancelOrderModal";

type OrderStatus = "new" | "making" | "ready" | "picked_up" | "cancelled" | "refunded";
type Lane = "new" | "making" | "ready" | "done";

export interface BoardOrder {
  id: string;
  code: string;
  customer_name: string;
  customer_phone: string;
  pickup_at: string;
  status: OrderStatus;
  arrived_at: string | null;
  total_cents: number;
  stripe_payment_intent_id: string | null;
}

export interface BoardItem {
  order_id: string;
  pizza_id: string;
  pizza_name: string;
  quantity: number;
}

export interface BoardPizza {
  id: string;
  name: string;
  nightly_cap: number;
}

interface Props {
  night: {
    id: string;
    service_date: string;
    service_start: string;
    last_pickup: string;
    nightly_total: number;
    sold_out_overrides: Record<string, boolean>;
  };
  allNights: { id: string; service_date: string }[];
  bakeMinutes: number;
  initialOrders: BoardOrder[];
  initialItems: BoardItem[];
  pizzas: BoardPizza[];
}

const LANES: { key: Lane; label: string; color: string }[] = [
  { key: "new", label: "New", color: "#C9A227" },
  { key: "making", label: "Making", color: "#3D7BC9" },
  { key: "ready", label: "Ready", color: "#2F7D4F" },
  { key: "done", label: "Done", color: "#9AA0A6" },
];

const NEXT: Partial<Record<OrderStatus, { status: OrderStatus; label: string; bg: string; fg: string }>> = {
  new: { status: "making", label: "Start", bg: "#3D7BC9", fg: "#fff" },
  making: { status: "ready", label: "Ready", bg: "#2F7D4F", fg: "#F8EAD5" },
  ready: { status: "picked_up", label: "Picked up", bg: "#484D52", fg: "#F8EAD5" },
};

const BACK: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  making: { status: "new", label: "Move back to New" },
  ready: { status: "making", label: "Move back to Making" },
  picked_up: { status: "ready", label: "Move back to Ready" },
  cancelled: { status: "new", label: "Restore to New" },
};

const INACTIVE: OrderStatus[] = ["cancelled", "refunded"];

function laneOf(status: OrderStatus): Lane {
  if (status === "new" || status === "making" || status === "ready") return status;
  return "done";
}

function formatTime(iso: string | number) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

function formatNight(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function to12h(t: string) {
  const [h, m] = t.split(":").map(Number);
  const hh = ((h + 11) % 12) + 1;
  return m ? `${hh}:${String(m).padStart(2, "0")}` : `${hh}`;
}

export function ServiceBoard({ night, allNights, bakeMinutes, initialOrders, initialItems, pizzas }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [orders, setOrders] = useState<BoardOrder[]>(initialOrders);
  const [items, setItems] = useState<BoardItem[]>(initialItems);
  const [overrides, setOverrides] = useState<Record<string, boolean>>(night.sold_out_overrides);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ order: BoardOrder; mode: CancelMode } | null>(null);
  const [confirmSoldOut, setConfirmSoldOut] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [mobileLane, setMobileLane] = useState<Lane>("new");
  const [error, setError] = useState<string | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const todayET = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const isTonight = night.service_date === todayET;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  const refetch = useCallback(async () => {
    const { data: fresh } = await supabase
      .from("orders")
      .select("id, code, customer_name, customer_phone, pickup_at, status, arrived_at, total_cents, stripe_payment_intent_id")
      .eq("service_night_id", night.id)
      .neq("status", "pending_payment")
      .order("pickup_at", { ascending: true });
    const freshOrders = (fresh ?? []) as BoardOrder[];
    const ids = freshOrders.map((o) => o.id);
    const { data: freshItems } =
      ids.length > 0
        ? await supabase.from("order_items").select("order_id, pizza_id, pizza_name, quantity").in("order_id", ids)
        : { data: [] };
    setOrders(freshOrders);
    setItems((freshItems ?? []) as BoardItem[]);
  }, [night.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const channel = supabase
      .channel(`service-board-${night.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `service_night_id=eq.${night.id}` },
        () => refetch()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [night.id, refetch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close the ··· menu on any outside click
  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [openMenu]);

  function showError(message: string) {
    setError(message);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(null), 5000);
  }

  async function setStatus(order: BoardOrder, status: OrderStatus) {
    setOpenMenu(null);
    setBusy(order.id);
    const previous = order.status;
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
    const res = await fetch("/api/admin/update-order-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, status }),
    }).catch(() => null);
    setBusy(null);
    if (!res || !res.ok) {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: previous } : o)));
      showError(`Couldn't update ${order.customer_name}'s order. Check your connection and try again.`);
    }
  }

  function openCancel(order: BoardOrder, mode: CancelMode) {
    setOpenMenu(null);
    setCancelTarget({ order, mode });
  }

  /** Plain cancel (no money back). Resolves to an error message, or null on success. */
  async function cancelOrder(order: BoardOrder): Promise<string | null> {
    setBusy(order.id);
    const res = await fetch("/api/admin/update-order-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, status: "cancelled" }),
    }).catch(() => null);
    setBusy(null);
    if (!res) return "Couldn't reach the server. Check your connection and try again.";
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return data?.error ?? "Couldn't cancel the order. Try again.";
    }
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: "cancelled" } : o)));
    refetch();
    return null;
  }

  /** Cancel & refund the card through Stripe. Resolves to an error message, or null on success. */
  async function refundOrder(order: BoardOrder): Promise<string | null> {
    setBusy(order.id);
    const res = await fetch("/api/admin/refund-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id }),
    }).catch(() => null);
    setBusy(null);
    if (!res) return "Couldn't reach the server. Check your connection and try again.";
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) return data?.error ?? "Refund failed. The order was not changed.";
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: "refunded" } : o)));
    refetch();
    return null;
  }

  async function markArrived(order: BoardOrder) {
    setOpenMenu(null);
    const arrivedAt = new Date().toISOString();
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, arrived_at: arrivedAt } : o)));
    const { error: err } = await supabase.from("orders").update({ arrived_at: arrivedAt }).eq("id", order.id);
    if (err) {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, arrived_at: null } : o)));
      showError(`Couldn't mark ${order.customer_name} as here. Try again.`);
      return;
    }
    // Same broadcast the Orders page sends, so the kitchen gets the arrival toast
    await supabase.channel(`orders-admin-${night.id}`).send({
      type: "broadcast",
      event: "customer_arrived",
      payload: { customerName: order.customer_name },
    });
  }

  async function toggleSoldOut(pizzaId: string) {
    setConfirmSoldOut(null);
    const next = { ...overrides, [pizzaId]: !overrides[pizzaId] };
    if (!next[pizzaId]) delete next[pizzaId];
    const previous = overrides;
    setOverrides(next);
    const { error: err } = await supabase.from("service_nights").update({ sold_out_overrides: next }).eq("id", night.id);
    if (err) {
      setOverrides(previous);
      showError("Couldn't change sold-out status. Try again.");
    }
  }

  // ---- Derived numbers ----
  const activeIds = new Set(orders.filter((o) => !INACTIVE.includes(o.status)).map((o) => o.id));
  const sold: Record<string, number> = {};
  for (const i of items) {
    if (activeIds.has(i.order_id)) sold[i.pizza_id] = (sold[i.pizza_id] ?? 0) + i.quantity;
  }
  const totalSold = Object.values(sold).reduce((s, n) => s + n, 0);
  const poolLeft = Math.max(0, night.nightly_total - totalSold);
  const poolPct = Math.min(100, Math.round((totalSold / Math.max(1, night.nightly_total)) * 100));

  function pizzaCount(orderId: string) {
    return items.filter((i) => i.order_id === orderId).reduce((s, i) => s + i.quantity, 0);
  }

  function startBy(order: BoardOrder) {
    const ms = new Date(order.pickup_at).getTime() - pizzaCount(order.id) * bakeMinutes * 60_000;
    return { ms, due: now >= ms };
  }

  const byLane: Record<Lane, BoardOrder[]> = { new: [], making: [], ready: [], done: [] };
  for (const o of orders) byLane[laneOf(o.status)].push(o);
  // New orders sort by when they need to start; others by pickup time
  byLane.new.sort((a, b) => startBy(a).ms - startBy(b).ms);
  byLane.done.sort((a, b) => new Date(b.pickup_at).getTime() - new Date(a.pickup_at).getTime());

  const visibleLanes = LANES.filter((l) => l.key !== "done" || showDone);
  const doneCount = byLane.done.length;

  return (
    <div className="svc" style={{ paddingTop: 22, paddingBottom: 20 }}>
      <style>{BOARD_CSS}</style>

      {/* Header */}
      <div className="svc-top">
        <label className="svc-night">
          {isTonight && <span className="svc-live" />}
          <select
            value={night.id}
            onChange={(e) => router.push(`/admin/service?nightId=${e.target.value}`)}
            aria-label="Service night"
          >
            {[...allNights].reverse().map((n) => (
              <option key={n.id} value={n.id}>
                {formatNight(n.service_date)}
                {n.service_date === todayET ? " · Tonight" : n.service_date < todayET ? " · past" : ""}
              </option>
            ))}
          </select>
        </label>
        <span className="svc-meta">
          Pickups {to12h(night.service_start)} to {to12h(night.last_pickup)}
        </span>
        <span style={{ flex: 1 }} />
        <button className={`svc-btn ghost${showDone ? " on" : ""}`} onClick={() => setShowDone((v) => !v)}>
          {showDone ? "Hide done" : `Done ${doneCount}`}
        </button>
        <a className="svc-btn primary" href="/admin/walk-in">
          + Walk-in
        </a>
      </div>

      {/* Stock strip */}
      <div className="svc-stock">
        <div className="svc-pool">
          <b>
            {totalSold} of {night.nightly_total} sold · {poolLeft} left
          </b>
          <div className="svc-bar">
            <i style={{ width: `${poolPct}%`, background: poolPct >= 90 ? "#C9A227" : "#2F7D4F" }} />
          </div>
        </div>
        {pizzas.map((p) => {
          const left = Math.max(0, p.nightly_cap - (sold[p.id] ?? 0));
          const out = !!overrides[p.id];
          if (confirmSoldOut === p.id) {
            return (
              <span key={p.id} className="svc-chip confirm">
                Mark {p.name} sold out?
                <button onClick={() => toggleSoldOut(p.id)}>Yes</button>
                <button onClick={() => setConfirmSoldOut(null)}>No</button>
              </span>
            );
          }
          if (out) {
            return (
              <span key={p.id} className="svc-chip out">
                {p.name} <b>Sold out</b>
                <button onClick={() => toggleSoldOut(p.id)}>Undo</button>
              </span>
            );
          }
          return (
            <button
              key={p.id}
              className={`svc-chip${left <= 2 ? " low" : ""}`}
              onClick={() => setConfirmSoldOut(p.id)}
              title="Tap to mark sold out"
            >
              {p.name} <b>{left}</b>
            </button>
          );
        })}
      </div>

      {/* Lane tabs (phones) */}
      <div className="svc-lane-tabs">
        {LANES.map((l) => (
          <button
            key={l.key}
            className={mobileLane === l.key ? "on" : undefined}
            onClick={() => setMobileLane(l.key)}
          >
            {l.label} <b>{byLane[l.key].length}</b>
          </button>
        ))}
      </div>

      {/* Lanes */}
      <div className="svc-lanes" style={{ ["--cols" as string]: visibleLanes.length }}>
        {LANES.map((lane) => {
          const shownDesktop = lane.key !== "done" || showDone;
          const list = byLane[lane.key];
          return (
            <section
              key={lane.key}
              className={`svc-lane${shownDesktop ? "" : " desk-hidden"}${mobileLane === lane.key ? "" : " phone-hidden"}`}
            >
              <div className="svc-lane-h">
                <span className="dot" style={{ background: lane.color }} />
                {lane.label}
                <span className="n">{list.length}</span>
              </div>
              {list.length === 0 && <div className="svc-empty">Nothing here.</div>}
              {list.map((o) => {
                const next = NEXT[o.status];
                const back = BACK[o.status];
                const sb = startBy(o);
                const late = o.status === "new" && sb.due;
                const orderItems = items.filter((i) => i.order_id === o.id);
                const canCancel = o.status === "new" || o.status === "making";
                const canArrive = (o.status === "new" || o.status === "making" || o.status === "ready") && !o.arrived_at;
                const hasMenu = !!back || canCancel || canArrive || o.status === "making";
                return (
                  <article
                    key={o.id}
                    className={`svc-tk s-${o.status}${late ? " late" : ""}`}
                    style={{ zIndex: openMenu === o.id ? 5 : undefined }}
                  >
                    <div className="svc-tk-top">
                      <span className="name">{o.customer_name}</span>
                      <span className="code">{o.code}</span>
                      <span className="time font-display">{formatTime(o.pickup_at)}</span>
                    </div>
                    {o.status !== "picked_up" && (
                      <div className="items">
                        {orderItems.map((i) => `${i.quantity} ${i.pizza_name}`).join(" · ")}
                      </div>
                    )}
                    <div className="svc-tk-foot">
                      {o.status === "new" &&
                        (late ? (
                          <span className="tag now">Start now</span>
                        ) : (
                          <span className="tag cook">Start by {formatTime(sb.ms)}</span>
                        ))}
                      {o.arrived_at && o.status !== "picked_up" && <span className="tag here">Here</span>}
                      {o.status === "cancelled" && <span className="tag gone">Cancelled</span>}
                      {o.status === "refunded" && <span className="tag gone">Refunded</span>}
                      <span style={{ flex: 1 }} />
                      {next && (
                        <button
                          className="svc-act"
                          style={{ background: next.bg, color: next.fg }}
                          disabled={busy === o.id}
                          onClick={() => setStatus(o, next.status)}
                        >
                          {next.label}
                        </button>
                      )}
                      {hasMenu && (
                        <span className="svc-more-wrap">
                          <button
                            className="svc-more"
                            aria-label={`More actions for ${o.customer_name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenu(openMenu === o.id ? null : o.id);
                            }}
                          >
                            ···
                          </button>
                          {openMenu === o.id && (
                            <div className="svc-menu" onClick={(e) => e.stopPropagation()}>
                              {back && <button onClick={() => setStatus(o, back.status)}>{back.label}</button>}
                              {o.status === "making" && (
                                <button onClick={() => setStatus(o, "picked_up")}>Mark picked up</button>
                              )}
                              {canArrive && <button onClick={() => markArrived(o)}>Customer is here</button>}
                              {canCancel && (
                                <>
                                  <hr />
                                  <button className="danger" onClick={() => openCancel(o, "cancel")}>
                                    Cancel (no refund)…
                                  </button>
                                  {o.stripe_payment_intent_id && (
                                    <button className="danger" onClick={() => openCancel(o, "refund")}>
                                      Cancel &amp; refund ${(o.total_cents / 100).toFixed(2)}…
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>

      <a className="svc-fab" href="/admin/walk-in">
        + Walk-in
      </a>

      {cancelTarget && (
        <CancelOrderModal
          mode={cancelTarget.mode}
          customerName={cancelTarget.order.customer_name}
          code={cancelTarget.order.code}
          amountCents={cancelTarget.order.total_cents}
          canRefund={!!cancelTarget.order.stripe_payment_intent_id}
          onClose={() => setCancelTarget(null)}
          onConfirm={() =>
            cancelTarget.mode === "refund" ? refundOrder(cancelTarget.order) : cancelOrder(cancelTarget.order)
          }
        />
      )}

      {error && <div className="svc-error">{error}</div>}
    </div>
  );
}

const BOARD_CSS = `
.svc-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.svc-night { display: inline-flex; align-items: center; gap: 8px; background: #484D52; border: 1px solid #F8EAD515; border-radius: 12px; padding: 0 4px 0 12px; }
.svc-night select { background: transparent; color: #F8EAD5; border: 0; font: 700 14px var(--font-archivo), sans-serif; padding: 9px 6px; cursor: pointer; }
.svc-night option { color: #222; }
.svc-live { width: 8px; height: 8px; border-radius: 50%; background: #5fd38a; box-shadow: 0 0 0 3px #5fd38a33; flex: none; }
.svc-meta { font-size: 13px; color: #F8EAD599; }
.svc-btn { display: inline-flex; align-items: center; border-radius: 12px; padding: 9px 16px; font: 700 14px var(--font-archivo), sans-serif; text-decoration: none; cursor: pointer; border: 0; white-space: nowrap; }
.svc-btn.primary { background: #2F7D4F; color: #F8EAD5; }
.svc-btn.ghost { background: transparent; color: #F8EAD5bb; border: 1px solid #F8EAD526; }
.svc-btn.ghost.on { background: #F8EAD512; color: #F8EAD5; }

.svc-stock { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; background: #484D52; border-radius: 16px; padding: 12px 14px; margin-bottom: 16px; }
.svc-pool { display: grid; gap: 5px; min-width: 170px; margin-right: 6px; font-size: 14px; }
.svc-bar { height: 6px; border-radius: 6px; background: #F8EAD51a; overflow: hidden; }
.svc-bar i { display: block; height: 100%; border-radius: 6px; }
.svc-chip { display: inline-flex; align-items: center; gap: 6px; border-radius: 100px; padding: 6px 12px; font: 600 13px var(--font-archivo), sans-serif; background: #F8EAD50f; color: #F8EAD5; border: 0; cursor: pointer; white-space: nowrap; }
.svc-chip b { font-variant-numeric: tabular-nums; }
.svc-chip.low b { color: #E8C24A; }
.svc-chip.out { background: #60403F; color: #F8EAD5bb; cursor: default; }
.svc-chip.out b { color: #f0a0a0; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; }
.svc-chip.confirm { background: #F8EAD5; color: #484D52; cursor: default; }
.svc-chip button { background: none; border: 0; padding: 0 2px; font: 700 13px var(--font-archivo), sans-serif; color: inherit; text-decoration: underline; cursor: pointer; }

.svc-lane-tabs { display: none; }
.svc-lanes { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: 14px; align-items: start; }
.svc-lane { display: grid; gap: 10px; align-content: start; background: #2E323666; border-radius: 18px; padding: 12px; min-width: 0; }
.svc-lane.desk-hidden { display: none; }
.svc-lane-h { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 12px; letter-spacing: .1em; text-transform: uppercase; padding: 2px 4px; }
.svc-lane-h .dot { width: 8px; height: 8px; border-radius: 50%; }
.svc-lane-h .n { margin-left: auto; color: #F8EAD577; }
.svc-empty { font-size: 13px; color: #F8EAD555; padding: 4px; }

.svc-tk { position: relative; min-width: 0; background: #F8EAD5; color: #484D52; border-radius: 16px; padding: 12px 13px; display: grid; gap: 7px; border-top: 4px solid #C9A227; }
.svc-tk.s-making { border-top-color: #3D7BC9; }
.svc-tk.s-ready { border-top-color: #2F7D4F; }
.svc-tk.s-picked_up, .svc-tk.s-cancelled, .svc-tk.s-refunded { background: #F8EAD5b0; border-top-color: #9AA0A6; }
.svc-tk.late { box-shadow: 0 0 0 2px #EB5757; }
.svc-tk-top { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 10px; align-items: center; }
.svc-tk-top .name { grid-column: 1; grid-row: 1; font-weight: 800; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.svc-tk-top .code { grid-column: 1; grid-row: 2; font-family: ui-monospace, Menlo, monospace; font-size: 11px; color: #484D52aa; }
.svc-tk-top .time { grid-column: 2; grid-row: 1 / 3; font-weight: 900; font-size: 19px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.svc-tk .items { font-size: 13px; line-height: 1.4; }
.svc-tk-foot { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.svc-tk .tag { font-size: 11px; font-weight: 800; border-radius: 100px; padding: 3px 8px; white-space: nowrap; }
.svc-tk .tag.cook { background: #C9A22729; color: #7a6212; }
.svc-tk .tag.now { background: #EB5757; color: #fff; }
.svc-tk .tag.here { background: #2F7D4F22; color: #256340; }
.svc-tk .tag.gone { background: #60403F22; color: #60403F; }
.svc-act { border: 0; border-radius: 10px; padding: 7px 14px; font: 700 13px var(--font-archivo), sans-serif; cursor: pointer; white-space: nowrap; }
.svc-act:disabled { opacity: .5; cursor: wait; }
.svc-more-wrap { position: relative; }
.svc-more { width: 32px; height: 32px; border-radius: 10px; border: 0; background: #484D5218; color: #484D52; font-weight: 900; letter-spacing: 1px; cursor: pointer; }
.svc-menu { position: absolute; right: 0; top: calc(100% + 6px); z-index: 20; background: #2E3236; color: #F8EAD5; border-radius: 12px; padding: 6px; width: 210px; box-shadow: 0 12px 32px #0009; display: grid; gap: 1px; }
.svc-menu button { text-align: left; background: none; border: 0; color: inherit; font: 500 13px var(--font-archivo), sans-serif; padding: 8px 10px; border-radius: 8px; cursor: pointer; }
.svc-menu button:hover { background: #F8EAD512; }
.svc-menu .danger { color: #f0a0a0; }
.svc-menu hr { border: 0; border-top: 1px solid #F8EAD51a; margin: 3px 0; }
.svc-fab { display: none; }
.svc-error { position: fixed; left: 50%; transform: translateX(-50%); bottom: 28px; z-index: 100; background: #60403F; color: #F8EAD5; border-radius: 12px; padding: 12px 18px; font-size: 14px; font-weight: 700; box-shadow: 0 6px 24px #0007; max-width: calc(100vw - 32px); }

@media (max-width: 760px) {
  .svc-top .svc-btn.primary, .svc-top .svc-btn.ghost, .svc-meta { display: none; }
  .svc-night { flex: 1; }
  .svc-night select { flex: 1; }
  .svc-stock { padding: 10px 12px; }
  .svc-pool { min-width: 100%; margin: 0 0 4px; }
  .svc-lane-tabs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; background: #2E3236; border-radius: 12px; padding: 3px; margin-bottom: 10px; position: sticky; top: 0; z-index: 10; }
  .svc-lane-tabs button { background: none; border: 0; border-radius: 9px; padding: 8px 0; font: 700 13px var(--font-archivo), sans-serif; color: #F8EAD577; cursor: pointer; }
  .svc-lane-tabs button.on { background: #484D52; color: #F8EAD5; }
  .svc-lanes { grid-template-columns: minmax(0, 1fr); }
  .svc-lane.desk-hidden { display: grid; }
  .svc-lane.phone-hidden { display: none; }
  .svc-lane { background: none; padding: 0; }
  .svc-lane-h { display: none; }
  .svc-tk { border-top: 0; border-left: 5px solid #C9A227; padding: 14px; }
  .svc-tk.s-making { border-left-color: #3D7BC9; }
  .svc-tk.s-ready { border-left-color: #2F7D4F; }
  .svc-tk.s-picked_up, .svc-tk.s-cancelled, .svc-tk.s-refunded { border-left-color: #9AA0A6; }
  .svc-act { flex: 1 0 100%; order: 10; padding: 12px; font-size: 15px; border-radius: 12px; }
  .svc-more { width: 40px; height: 40px; }
  .svc-fab { display: block; position: fixed; right: 16px; bottom: calc(86px + env(safe-area-inset-bottom, 0px)); z-index: 55; background: #2F7D4F; color: #F8EAD5; font-weight: 800; font-size: 14px; border-radius: 100px; padding: 13px 18px; text-decoration: none; box-shadow: 0 8px 20px #0007; }
}
`;
