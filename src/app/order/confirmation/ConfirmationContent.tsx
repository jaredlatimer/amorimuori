"use client";

import { useEffect, useState } from "react";

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatPickup(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    weekday: "long",
  });
}

interface Order {
  id: string;
  code: string;
  customer_name: string;
  pickup_at: string;
  status: string;
  subtotal_cents: number;
  tip_cents: number;
  total_cents: number;
}

interface Item {
  pizza_name: string;
  quantity: number;
  unit_price_cents: number;
}

interface Props {
  order: Order | null;
  items: Item[];
}

export function ConfirmationContent({ order: initialOrder, items }: Props) {
  const [order, setOrder] = useState(initialOrder);
  const [polling, setPolling] = useState(
    initialOrder?.status === "pending_payment"
  );

  // If the webhook hasn't fired yet, poll every 2s until status changes
  useEffect(() => {
    if (!polling || !initialOrder?.code) return;
    let tries = 0;
    const interval = setInterval(async () => {
      tries++;
      const res = await fetch(
        `/api/order-status?code=${initialOrder.code}`
      ).catch(() => null);
      if (!res) return;
      const data = await res.json().catch(() => null);
      if (data?.status && data.status !== "pending_payment") {
        setOrder((prev) => prev ? { ...prev, status: data.status } : prev);
        setPolling(false);
        clearInterval(interval);
      }
      if (tries >= 15) {
        // Give up polling after 30s — webhook may be delayed
        setPolling(false);
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [polling, initialOrder?.code]);

  if (!order) {
    return (
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "#F8EAD599", fontSize: 16 }}>
          Order not found. If you were just charged, email us and we'll sort it
          out immediately.
        </p>
        <a
          href="/"
          style={{
            color: "#2F7D4F",
            textDecoration: "none",
            marginTop: 16,
            display: "block",
          }}
        >
          ← Home
        </a>
      </div>
    );
  }

  const confirmed = order.status !== "pending_payment";

  return (
    <div
      style={{
        maxWidth: 460,
        width: "100%",
        textAlign: "center",
      }}
    >
      {/* Badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          background: confirmed ? "#2F7D4F22" : "#C9A22722",
          border: `1px solid ${confirmed ? "#2F7D4F" : "#C9A22744"}`,
          borderRadius: 100,
          padding: "6px 16px",
          fontSize: 13,
          fontWeight: 700,
          color: confirmed ? "#2F7D4F" : "#C9A227",
          letterSpacing: 0.5,
          marginBottom: 24,
        }}
      >
        {confirmed ? "✓ Order confirmed" : "⏳ Confirming payment…"}
      </div>

      {/* Heading */}
      <h1
        className="font-display"
        style={{
          fontSize: "clamp(32px, 7vw, 52px)",
          fontWeight: 900,
          lineHeight: 1.1,
          margin: "0 0 8px",
        }}
      >
        {confirmed ? "See you tonight!" : "Hang tight…"}
      </h1>

      {confirmed && (
        <p style={{ color: "#F8EAD5aa", fontSize: 16, marginBottom: 28 }}>
          Your receipt and the pickup address are on their way to your email.
        </p>
      )}

      {/* Order card */}
      <div
        style={{
          background: "#F8EAD5",
          color: "#484D52",
          borderRadius: 20,
          padding: "24px 26px",
          textAlign: "left",
          marginTop: 8,
        }}
      >
        {/* Order code + pickup */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 20,
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#484D5266",
                letterSpacing: 1.5,
                textTransform: "uppercase",
                marginBottom: 3,
              }}
            >
              Order
            </div>
            <div
              className="font-display"
              style={{ fontSize: 28, fontWeight: 900, letterSpacing: 1 }}
            >
              {order.code}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#484D5266",
                letterSpacing: 1.5,
                textTransform: "uppercase",
                marginBottom: 3,
              }}
            >
              Pickup
            </div>
            <div
              className="font-display"
              style={{ fontSize: 22, fontWeight: 900, color: "#2F7D4F" }}
            >
              {formatPickup(order.pickup_at)}
            </div>
          </div>
        </div>

        {/* Items */}
        <div
          style={{
            borderTop: "1.5px solid #484D5215",
            paddingTop: 16,
            display: "grid",
            gap: 9,
          }}
        >
          {items.map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 15,
              }}
            >
              <span>
                <strong>{item.quantity}×</strong> {item.pizza_name}
              </span>
              <span style={{ fontWeight: 700 }}>
                {fmt(item.unit_price_cents * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div
          style={{
            borderTop: "1.5px solid #484D5215",
            marginTop: 16,
            paddingTop: 14,
            display: "grid",
            gap: 6,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 14,
              color: "#484D52aa",
            }}
          >
            <span>Subtotal</span>
            <span>{fmt(order.subtotal_cents)}</span>
          </div>
          {order.tip_cents > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
                color: "#484D52aa",
              }}
            >
              <span>Tip</span>
              <span>{fmt(order.tip_cents)}</span>
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 19,
              fontWeight: 900,
              paddingTop: 8,
              borderTop: "1.5px solid #484D5215",
              marginTop: 2,
              fontFamily: "var(--font-fraunces), serif",
            }}
          >
            <span>Total</span>
            <span>{fmt(order.total_cents)}</span>
          </div>
        </div>

        {/* Address reminder */}
        <div
          style={{
            marginTop: 18,
            padding: "12px 14px",
            background: "#484D520d",
            borderRadius: 10,
            fontSize: 13,
            color: "#484D5299",
            lineHeight: 1.4,
          }}
        >
          📍 Pickup address is in your confirmation email. Look for{" "}
          <strong style={{ color: "#484D52" }}>
            Amori Muori — Order {order.code}
          </strong>
          .
        </div>
      </div>

      <a
        href="/"
        style={{
          display: "inline-block",
          marginTop: 28,
          color: "#F8EAD566",
          textDecoration: "none",
          fontSize: 14,
        }}
      >
        ← Back to home
      </a>
    </div>
  );
}
