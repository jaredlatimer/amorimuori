"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type OrderStatus =
  | "new"
  | "making"
  | "ready"
  | "picked_up"
  | "cancelled"
  | "refunded";

interface Order {
  id: string;
  code: string;
  customer_name: string;
  customer_phone: string;
  pickup_at: string;
  status: OrderStatus;
  subtotal_cents: number;
  tip_cents: number;
  total_cents: number;
  placed_at: string;
}

interface Item {
  order_id: string;
  pizza_name: string;
  quantity: number;
  unit_price_cents: number;
}

interface ServiceNight {
  id: string;
  service_date: string;
  service_start: string;
  last_pickup: string;
  nightly_total: number;
}

interface Props {
  serviceNight: ServiceNight;
  allNights: ServiceNight[];
  initialOrders: Order[];
  initialItems: Item[];
}

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "New",
  making: "Making",
  ready: "Ready",
  picked_up: "Picked up",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const STATUS_COLORS: Record<OrderStatus, { bg: string; color: string }> = {
  new: { bg: "#C9A22722", color: "#C9A227" },
  making: { bg: "#2F7D4F22", color: "#2F7D4F" },
  ready: { bg: "#4A90D922", color: "#4A90D9" },
  picked_up: { bg: "#F8EAD510", color: "#F8EAD555" },
  cancelled: { bg: "#60403F22", color: "#60403F" },
  refunded: { bg: "#60403F22", color: "#60403F" },
};

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  new: "making",
  making: "ready",
  ready: "picked_up",
};

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  new: "Start making",
  making: "Mark ready",
  ready: "Picked up ✓",
};

export function OrdersClient({ serviceNight, allNights, initialOrders, initialItems }: Props) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [items, setItems] = useState<Item[]>(initialItems);
  const [updating, setUpdating] = useState<string | null>(null);
  const [glowingIds, setGlowingIds] = useState<Set<string>>(new Set());
  const prevIdsRef = useRef<Set<string>>(new Set(initialOrders.map((o) => o.id)));
  const [toasts, setToasts] = useState<{ id: string; message: string; exiting: boolean }[]>([]);

  function addToast(message: string) {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, exiting: false }]);
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => t.id === id ? { ...t, exiting: true } : t));
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 400);
    }, 4000);
  }

  const router = useRouter();
  const supabase = createClient();
  const todayET = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  function fakeNewOrder() {
    const id = `fake-${Date.now()}`;
    const fakeOrder: Order = {
      id,
      code: "TST-99",
      customer_name: "Test Customer",
      customer_phone: "555-0000",
      pickup_at: new Date(Date.now() + 30 * 60000).toISOString(),
      status: "new",
      subtotal_cents: 2800,
      tip_cents: 300,
      total_cents: 3100,
      placed_at: new Date().toISOString(),
    };
    const fakeItem: Item = { order_id: id, pizza_name: "Margherita", quantity: 2, unit_price_cents: 1400 };
    prevIdsRef.current = new Set([...prevIdsRef.current, id]);
    setOrders((prev) => [...prev, fakeOrder]);
    setItems((prev) => [...prev, fakeItem]);
    setGlowingIds((prev) => new Set([...prev, id]));
    addToast("New order received");
    setTimeout(() => {
      setGlowingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }, 60000);
  }

  const refetch = useCallback(async () => {
    const { data: freshOrders } = await supabase
      .from("orders")
      .select(
        "id, code, customer_name, customer_phone, pickup_at, status, subtotal_cents, tip_cents, total_cents, placed_at"
      )
      .eq("service_night_id", serviceNight.id)
      .neq("status", "pending_payment")
      .order("pickup_at", { ascending: true });

    const freshIds = ((freshOrders ?? []) as Order[]).map((o) => o.id);
    const { data: freshItems } =
      freshIds.length > 0
        ? await supabase
            .from("order_items")
            .select("order_id, pizza_name, quantity, unit_price_cents")
            .in("order_id", freshIds)
        : { data: [] };

    const fresh = (freshOrders ?? []) as Order[];
    const newIds = fresh.filter((o) => !prevIdsRef.current.has(o.id)).map((o) => o.id);
    prevIdsRef.current = new Set(fresh.map((o) => o.id));

    if (newIds.length > 0) {
      addToast(`New order${newIds.length > 1 ? `s (${newIds.length})` : ""} received`);
      setGlowingIds((prev) => new Set([...prev, ...newIds]));
      setTimeout(() => {
        setGlowingIds((prev) => {
          const next = new Set(prev);
          newIds.forEach((id) => next.delete(id));
          return next;
        });
      }, 60000);
    }

    setOrders(fresh);
    setItems((freshItems ?? []) as Item[]);
  }, [serviceNight.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`orders-admin-${serviceNight.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `service_night_id=eq.${serviceNight.id}`,
        },
        () => { refetch(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [serviceNight.id, refetch]); // eslint-disable-line react-hooks/exhaustive-deps

  async function updateStatus(orderId: string, status: OrderStatus) {
    setUpdating(orderId);
    await fetch("/api/admin/update-order-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, status }),
    });
    setUpdating(null);
    // Realtime will trigger refetch, but also update optimistically
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status } : o))
    );
  }

  // Summary stats
  const activeOrders = orders.filter(
    (o) => o.status !== "cancelled" && o.status !== "refunded"
  );
  const totalPizzas = items
    .filter((i) => activeOrders.some((o) => o.id === i.order_id))
    .reduce((s, i) => s + i.quantity, 0);
  const totalRevenue = activeOrders.reduce((s, o) => s + o.total_cents, 0);

  const grouped = {
    new: orders.filter((o) => o.status === "new"),
    making: orders.filter((o) => o.status === "making"),
    ready: orders.filter((o) => o.status === "ready"),
    done: orders.filter(
      (o) => o.status === "picked_up" || o.status === "cancelled" || o.status === "refunded"
    ),
  };

  return (
    <div style={{ paddingTop: 32 }}>
      {/* Night selector */}
      {allNights.length > 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {[...allNights].reverse().map((n) => {
            const active = n.id === serviceNight.id;
            const isPast = n.service_date < todayET;
            return (
              <button
                key={n.id}
                onClick={() => router.push(`/admin/orders?nightId=${n.id}`)}
                style={{
                  background: active ? "#F8EAD5" : "transparent",
                  color: active ? "#484D52" : isPast ? "#F8EAD533" : "#F8EAD5aa",
                  border: `1px solid ${active ? "#F8EAD5" : "#F8EAD520"}`,
                  borderRadius: 100,
                  padding: "6px 14px",
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                  fontFamily: "var(--font-archivo), sans-serif",
                }}
              >
                {new Date(n.service_date + "T12:00:00").toLocaleDateString("en-US", {
                  month: "short", day: "numeric",
                })}
                {isPast && " ·  past"}
              </button>
            );
          })}
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            className="font-display"
            style={{ fontSize: 28, fontWeight: 900, margin: 0 }}
          >
            Tonight's Orders
          </h1>
          <p style={{ color: "#F8EAD566", fontSize: 14, margin: "4px 0 0" }}>
            {formatDate(serviceNight.service_date)} ·{" "}
            {serviceNight.service_start.slice(0, 5)} –{" "}
            {serviceNight.last_pickup.slice(0, 5)}
          </p>
        </div>

        {/* Dev-only glow test */}
        {process.env.NODE_ENV === "development" && (
          <button
            onClick={fakeNewOrder}
            style={{ background: "#2F7D4F22", border: "1px solid #2F7D4F66", color: "#2F7D4F", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-archivo), sans-serif" }}
          >
            + Fake order
          </button>
        )}

        {/* Summary pills */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { label: `${activeOrders.length} orders` },
            { label: `${totalPizzas} pizzas` },
            { label: fmt(totalRevenue) },
          ].map((s) => (
            <span
              key={s.label}
              style={{
                background: "#484D52",
                border: "1px solid #F8EAD515",
                borderRadius: 100,
                padding: "5px 14px",
                fontSize: 13,
                fontWeight: 700,
                color: "#F8EAD5cc",
              }}
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {orders.length === 0 ? (
        <p style={{ color: "#F8EAD544", fontSize: 16, marginTop: 48, textAlign: "center" }}>
          No orders yet tonight.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 32 }}>
          {(
            [
              { key: "new", label: "Queued" },
              { key: "making", label: "In the oven" },
              { key: "ready", label: "Ready for pickup" },
              { key: "done", label: "Done" },
            ] as const
          ).map(({ key, label }) => {
            const group = grouped[key];
            if (group.length === 0) return null;
            return (
              <section key={key}>
                <h2
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: "#F8EAD555",
                    margin: "0 0 12px",
                  }}
                >
                  {label} · {group.length}
                </h2>
                <div style={{ display: "grid", gap: 12 }}>
                  {group.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      items={items.filter((i) => i.order_id === order.id)}
                      updating={updating === order.id}
                      glowing={glowingIds.has(order.id)}
                      onAdvance={() => {
                        const next = NEXT_STATUS[order.status];
                        if (next) updateStatus(order.id, next);
                      }}
                      onCancel={() => updateStatus(order.id, "cancelled")}
                      onRestore={() => updateStatus(order.id, "new")}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Toasts */}
      <div style={{ position: "fixed", bottom: 28, right: 24, zIndex: 200, display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none" }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={toast.exiting ? "toast-exit" : "toast-enter"}
            style={{
              background: "#2F7D4F",
              color: "#F8EAD5",
              borderRadius: 12,
              padding: "13px 20px",
              fontSize: 14,
              fontWeight: 700,
              boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
              fontFamily: "var(--font-archivo), sans-serif",
              whiteSpace: "nowrap",
            }}
          >
            New order received
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderCard({
  order,
  items,
  updating,
  glowing,
  onAdvance,
  onCancel,
  onRestore,
}: {
  order: Order;
  items: Item[];
  updating: boolean;
  glowing: boolean;
  onAdvance: () => void;
  onCancel: () => void;
  onRestore: () => void;
}) {
  const [confirmAction, setConfirmAction] = useState<"cancel" | "restore" | null>(null);
  const [glowState, setGlowState] = useState<"hold" | "animating" | "done">("done");
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!glowing) return;
    setGlowState("hold");
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setGlowState("animating");
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [glowing]);

  const sc = STATUS_COLORS[order.status];
  const nextLabel = NEXT_LABEL[order.status];
  const canCancel = order.status === "new" || order.status === "making";
  const isCancelled = order.status === "cancelled";
  const terminal = order.status === "picked_up" || order.status === "refunded";

  const btnBase: React.CSSProperties = {
    borderRadius: 8, padding: "7px 14px", fontSize: 13,
    cursor: updating ? "not-allowed" : "pointer",
    fontFamily: "var(--font-archivo), sans-serif", border: "none",
  };

  const actions = (
    <div className="order-card-actions">
      {confirmAction === "cancel" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#F8EAD5aa" }}>Cancel this order?</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setConfirmAction(null)} style={{ ...btnBase, background: "#F8EAD510", color: "#F8EAD5aa" }}>Keep it</button>
            <button onClick={() => { setConfirmAction(null); onCancel(); }} disabled={updating} style={{ ...btnBase, background: "#60403F", color: "#F8EAD5", fontWeight: 700 }}>Yes, cancel</button>
          </div>
        </div>
      )}
      {confirmAction === "restore" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#F8EAD5aa" }}>Restore to queue?</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setConfirmAction(null)} style={{ ...btnBase, background: "#F8EAD510", color: "#F8EAD5aa" }}>No</button>
            <button onClick={() => { setConfirmAction(null); onRestore(); }} disabled={updating} style={{ ...btnBase, background: "#2F7D4F", color: "#F8EAD5", fontWeight: 700 }}>Yes, restore</button>
          </div>
        </div>
      )}
      {confirmAction === null && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {nextLabel && (
            <button onClick={onAdvance} disabled={updating} style={{ ...btnBase, background: updating ? "#2F7D4F55" : "#2F7D4F", color: "#F8EAD5", fontWeight: 700 }}>
              {updating ? "…" : nextLabel}
            </button>
          )}
          {isCancelled && (
            <button onClick={() => setConfirmAction("restore")} disabled={updating} style={{ ...btnBase, background: "#2F7D4F22", border: "1px solid #2F7D4F66", color: "#2F7D4F", fontWeight: 700 }}>
              Restore
            </button>
          )}
          {canCancel && (
            <button onClick={() => setConfirmAction("cancel")} disabled={updating} style={{ ...btnBase, background: "#60403F", color: "#F8EAD5", fontWeight: 700 }}>
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={cardRef}
      className={glowState === "hold" ? "order-glow-hold" : glowState === "animating" ? "order-new-glow" : undefined}
      onAnimationEnd={() => setGlowState("done")}
      style={{ background: "#484D52", border: "1px solid #F8EAD510", borderRadius: 16, padding: "18px 20px", opacity: terminal || isCancelled ? 0.7 : 1 }}
    >
      <div className="order-card-body">
        {/* Left: order info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="font-display" style={{ fontSize: 24, fontWeight: 900, color: "#F8EAD5" }}>
              {order.customer_name}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, background: sc.bg, color: sc.color, borderRadius: 100, padding: "3px 10px", letterSpacing: 0.5 }}>
              {STATUS_LABELS[order.status]}
            </span>
          </div>
          <div style={{ marginTop: 4, fontSize: 15, color: "#2F7D4F", fontWeight: 700 }}>
            ⏰ {formatTime(order.pickup_at)}
          </div>
          <div style={{ marginTop: 3, fontSize: 13, color: "#F8EAD555" }}>
            {order.code} · {order.customer_phone}
          </div>
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
            {items.map((item, i) => (
              <span key={i} style={{ fontSize: 14, color: "#F8EAD5" }}>
                <strong>{item.quantity}×</strong> {item.pizza_name}
              </span>
            ))}
          </div>
          {/* Price + actions on mobile (below items) */}
          <div className="order-card-mobile-actions">
            <div className="font-display" style={{ fontSize: 20, fontWeight: 900, color: "#F8EAD5", marginTop: 10 }}>
              {fmt(order.total_cents)}
            </div>
            <div style={{ marginTop: 8 }}>{actions}</div>
          </div>
        </div>

        {/* Right: price + actions on wider screens */}
        <div className="order-card-right">
          <span className="font-display" style={{ fontSize: 20, fontWeight: 900, color: "#F8EAD5" }}>
            {fmt(order.total_cents)}
          </span>
          {actions}
        </div>
      </div>
    </div>
  );
}
