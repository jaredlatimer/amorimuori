"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Order {
  id: string;
  code: string;
  customer_name: string;
  pickup_at: string;
  status: "new" | "making";
}

interface Item {
  order_id: string;
  pizza_name: string;
  quantity: number;
}

interface Props {
  serviceNightId: string;
  initialOrders: Order[];
  initialItems: Item[];
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

export function KitchenClient({ serviceNightId, initialOrders, initialItems }: Props) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [items, setItems] = useState<Item[]>(initialItems);
  const [updating, setUpdating] = useState<string | null>(null);
  const supabase = createClient();

  const refetch = useCallback(async () => {
    const { data: freshOrders } = await supabase
      .from("orders")
      .select("id, code, customer_name, pickup_at, status")
      .eq("service_night_id", serviceNightId)
      .in("status", ["new", "making"])
      .order("pickup_at", { ascending: true });

    const freshIds = ((freshOrders ?? []) as Order[]).map((o) => o.id);
    const { data: freshItems } =
      freshIds.length > 0
        ? await supabase
            .from("order_items")
            .select("order_id, pizza_name, quantity")
            .in("order_id", freshIds)
        : { data: [] };

    setOrders((freshOrders ?? []) as Order[]);
    setItems((freshItems ?? []) as Item[]);
  }, [serviceNightId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const channel = supabase
      .channel(`kitchen-${serviceNightId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `service_night_id=eq.${serviceNightId}`,
        },
        () => { refetch(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [serviceNightId, refetch]); // eslint-disable-line react-hooks/exhaustive-deps

  async function advance(order: Order) {
    setUpdating(order.id);
    const next = order.status === "new" ? "making" : "ready";
    await supabase.from("orders").update({ status: next }).eq("id", order.id);
    setUpdating(null);
    if (next === "ready") {
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
    } else {
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: "making" } : o))
      );
    }
  }

  const making = orders.filter((o) => o.status === "making");
  const queued = orders.filter((o) => o.status === "new");

  if (orders.length === 0) {
    return (
      <div
        style={{
          paddingTop: 80,
          textAlign: "center",
          color: "#F8EAD544",
          fontSize: 20,
        }}
      >
        Queue is clear 🍕
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 28 }}>
      {making.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <h2
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#2F7D4F",
              margin: "0 0 14px",
            }}
          >
            In the oven · {making.length}
          </h2>
          <div style={{ display: "grid", gap: 10 }}>
            {making.map((order) => (
              <KitchenCard
                key={order.id}
                order={order}
                items={items.filter((i) => i.order_id === order.id)}
                updating={updating === order.id}
                onAdvance={() => advance(order)}
                actionLabel="Mark ready ✓"
                actionColor="#4A90D9"
              />
            ))}
          </div>
        </section>
      )}

      {queued.length > 0 && (
        <section>
          <h2
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#C9A227",
              margin: "0 0 14px",
            }}
          >
            Up next · {queued.length}
          </h2>
          <div style={{ display: "grid", gap: 10 }}>
            {queued.map((order) => (
              <KitchenCard
                key={order.id}
                order={order}
                items={items.filter((i) => i.order_id === order.id)}
                updating={updating === order.id}
                onAdvance={() => advance(order)}
                actionLabel="Start making"
                actionColor="#2F7D4F"
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function KitchenCard({
  order,
  items,
  updating,
  onAdvance,
  actionLabel,
  actionColor,
}: {
  order: Order;
  items: Item[];
  updating: boolean;
  onAdvance: () => void;
  actionLabel: string;
  actionColor: string;
}) {
  return (
    <div
      style={{
        background: "#484D52",
        border: `1px solid ${order.status === "making" ? "#2F7D4F44" : "#F8EAD510"}`,
        borderRadius: 16,
        padding: "20px 22px",
        display: "flex",
        alignItems: "center",
        gap: 20,
        flexWrap: "wrap",
      }}
    >
      {/* Code + pickup */}
      <div style={{ flex: "0 0 auto" }}>
        <div
          className="font-display"
          style={{ fontSize: 32, fontWeight: 900, lineHeight: 1, color: "#F8EAD5" }}
        >
          {order.code}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#2F7D4F", marginTop: 4 }}>
          {formatTime(order.pickup_at)}
        </div>
      </div>

      {/* Items */}
      <div style={{ flex: 1, minWidth: 150 }}>
        {items.map((item, i) => (
          <div
            key={i}
            style={{ fontSize: 17, color: "#F8EAD5", lineHeight: 1.5 }}
          >
            <strong>{item.quantity}×</strong> {item.pizza_name}
          </div>
        ))}
        <div style={{ fontSize: 13, color: "#F8EAD555", marginTop: 4 }}>
          {order.customer_name}
        </div>
      </div>

      {/* Action */}
      <button
        onClick={onAdvance}
        disabled={updating}
        style={{
          background: updating ? `${actionColor}55` : actionColor,
          border: "none",
          color: "#F8EAD5",
          borderRadius: 12,
          padding: "14px 22px",
          fontSize: 15,
          fontWeight: 700,
          cursor: updating ? "not-allowed" : "pointer",
          fontFamily: "var(--font-archivo), sans-serif",
          flexShrink: 0,
          minWidth: 140,
        }}
      >
        {updating ? "…" : actionLabel}
      </button>
    </div>
  );
}
