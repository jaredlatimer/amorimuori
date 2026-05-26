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

const STATUS_COLOR = { new: "#C9A227", making: "#3D7BC9" };
const STATUS_LABEL = { new: "Up next", making: "In the oven" };

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

export function KitchenClient({ serviceNightId, initialOrders, initialItems }: Props) {
  const [orders, setOrders] = useState<Order[]>(
    [...initialOrders].sort((a, b) => new Date(a.pickup_at).getTime() - new Date(b.pickup_at).getTime())
  );
  const [items, setItems] = useState<Item[]>(initialItems);
  const [updating, setUpdating] = useState(false);
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
        ? await supabase.from("order_items").select("order_id, pizza_name, quantity").in("order_id", freshIds)
        : { data: [] };

    setOrders((freshOrders ?? []) as Order[]);
    setItems((freshItems ?? []) as Item[]);
  }, [serviceNightId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const channel = supabase
      .channel(`kitchen-${serviceNightId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `service_night_id=eq.${serviceNightId}` }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [serviceNightId, refetch]); // eslint-disable-line react-hooks/exhaustive-deps

  async function advance(order: Order) {
    setUpdating(true);
    const next = order.status === "new" ? "making" : "ready";
    await supabase.from("orders").update({ status: next }).eq("id", order.id);
    setUpdating(false);
    if (next === "ready") {
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
    } else {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: "making" } : o)));
    }
  }

  const totalPizzas = items.reduce((s, i) => s + i.quantity, 0);
  const current = orders[0] ?? null;
  const upNext = orders.slice(1);

  return (
    <div style={{ margin: "0 -24px" }}>
      {/* Header */}
      <div style={{ background: "#3A3E43", padding: "14px 26px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #F8EAD510" }}>
        <div className="font-display" style={{ fontWeight: 900, fontSize: 19, color: "#F8EAD5", letterSpacing: 0.5 }}>
          KITCHEN
        </div>
        <div style={{ fontSize: 14, color: "#F8EAD5aa" }}>
          <strong style={{ color: "#F8EAD5" }}>{orders.length}</strong> orders ·{" "}
          <strong style={{ color: "#F8EAD5" }}>{totalPizzas}</strong> pizzas to make
        </div>
      </div>

      {/* Body: current order + up-next rail */}
      <div style={{ display: "flex", minHeight: "calc(100vh - 56px - 57px)", background: "#22252a" }}>

        {/* ── Left: single focused order ── */}
        <div style={{ flex: "1 1 0", padding: 24, display: "flex", flexDirection: "column" }}>
          {!current ? (
            <div style={{ margin: "auto", textAlign: "center", color: "#F8EAD544", fontSize: 26 }}>
              All caught up. 🎉
            </div>
          ) : (
            <div style={{ background: "#fff", borderRadius: 18, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", border: `4px solid ${STATUS_COLOR[current.status]}` }}>

              {/* Status band */}
              <div style={{ background: STATUS_COLOR[current.status], color: "#fff", padding: "16px 26px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, opacity: 0.85 }}>
                    {STATUS_LABEL[current.status]}
                  </div>
                  <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 17, marginTop: 2 }}>
                    {current.code} · {current.customer_name}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, opacity: 0.85, fontWeight: 700 }}>Pickup</div>
                  <div className="font-display" style={{ fontWeight: 900, fontSize: 30, lineHeight: 1 }}>
                    {formatTime(current.pickup_at)}
                  </div>
                </div>
              </div>

              {/* Items — oversized for across-kitchen readability */}
              <div style={{ padding: "10px 30px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                {items.filter((i) => i.order_id === current.id).map((item, li, arr) => (
                  <div key={item.pizza_name} style={{ display: "flex", alignItems: "center", gap: 22, padding: "18px 0", borderBottom: li < arr.length - 1 ? "2px solid #f0f0ee" : "none" }}>
                    <span className="font-display" style={{ fontSize: 60, fontWeight: 900, color: "#256340", minWidth: 90, lineHeight: 1 }}>
                      {item.quantity}×
                    </span>
                    <span style={{ fontSize: 30, fontWeight: 700, color: "#484D52", lineHeight: 1.1 }}>
                      {item.pizza_name}
                    </span>
                  </div>
                ))}
              </div>

              {/* Action button */}
              <div style={{ padding: "18px 26px", borderTop: "2px dashed #ddd" }}>
                <button
                  onClick={() => advance(current)}
                  disabled={updating}
                  style={{
                    width: "100%", border: "none", cursor: updating ? "not-allowed" : "pointer",
                    fontFamily: "var(--font-archivo), sans-serif", fontWeight: 900, color: "#fff",
                    background: updating ? "#aaa" : current.status === "making" ? "#3D7BC9" : "#2F7D4F",
                    borderRadius: 14, padding: "20px", fontSize: 22, letterSpacing: 0.5,
                  }}
                >
                  {updating ? "…" : current.status === "making" ? "MARK READY ✓" : "START THIS ORDER"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: up-next rail (280px) ── */}
        <div style={{ width: 280, background: "#3A3E43", padding: "20px 16px", overflowY: "auto", flexShrink: 0 }}>
          <div style={{ fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: "#F8EAD577", fontWeight: 700, marginBottom: 14, paddingLeft: 4 }}>
            Up next · {upNext.length}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {upNext.length === 0 && (
              <div style={{ color: "#F8EAD544", fontSize: 14, paddingLeft: 4 }}>Nothing waiting.</div>
            )}
            {upNext.map((o, idx) => (
              <div key={o.id} style={{ background: "#F8EAD50d", border: "1px solid #F8EAD51a", borderRadius: 11, padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <span style={{ fontSize: 13, color: "#F8EAD599", fontWeight: 600 }}>#{idx + 2}</span>
                  <span className="font-display" style={{ fontWeight: 900, fontSize: 16, color: "#F8EAD5" }}>
                    {formatTime(o.pickup_at)}
                  </span>
                </div>
                {items.filter((i) => i.order_id === o.id).map((item) => (
                  <div key={item.pizza_name} style={{ fontSize: 14, color: "#F8EAD5", lineHeight: 1.5 }}>
                    <strong>{item.quantity}×</strong> {item.pizza_name}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
