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

// When > 10 min left, show absolute deadline ("Friday at 7:43 PM").
// Inside 10 min, show live M:SS countdown for urgency.
function fmtWindow(cancellableUntil: string, secsLeft: number): { text: string; urgent: boolean } {
  if (secsLeft > 600) {
    const abs = new Date(cancellableUntil).toLocaleTimeString("en-US", {
      weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
    });
    return { text: abs, urgent: false };
  }
  const m = Math.floor(secsLeft / 60);
  const s = String(secsLeft % 60).padStart(2, "0");
  return { text: `${m}:${s}`, urgent: true };
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
  cancellable_until: string;
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
  const [windowSecs, setWindowSecs] = useState(0);
  const [cancelStage, setCancelStage] = useState<
    "idle" | "confirm" | "cancelling" | "done" | "error"
  >("idle");
  const [cancelError, setCancelError] = useState("");

  // Poll until payment confirmed
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
        setPolling(false);
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [polling, initialOrder?.code]);

  // Cancellation countdown
  useEffect(() => {
    if (!order?.cancellable_until) return;
    const tick = () => {
      const diff = new Date(order.cancellable_until).getTime() - Date.now();
      setWindowSecs(Math.max(0, Math.floor(diff / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [order?.cancellable_until]);

  async function handleCancel() {
    if (!order) return;
    setCancelStage("cancelling");
    setCancelError("");
    try {
      const res = await fetch("/api/cancel-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: order.code }),
      });
      const data = await res.json();
      if (res.ok) {
        setOrder((prev) => prev ? { ...prev, status: "cancelled" } : prev);
        setCancelStage("done");
      } else {
        setCancelError(data.error ?? "Something went wrong");
        setCancelStage("error");
      }
    } catch {
      setCancelError("Network error");
      setCancelStage("error");
    }
  }

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
  const isCancelled = order.status === "cancelled" || order.status === "refunded";
  const canCancel = order.status === "new" && windowSecs > 0 && cancelStage !== "done";

  // ── Cancelled state ─────────────────────────────────────────────────────────
  if (isCancelled) {
    return (
      <div style={{ maxWidth: 460, width: "100%", textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: "#60403F22",
            border: "1px solid #60403F66",
            borderRadius: 100,
            padding: "6px 16px",
            fontSize: 13,
            fontWeight: 700,
            color: "#60403F",
            letterSpacing: 0.5,
            marginBottom: 24,
          }}
        >
          Order cancelled
        </div>

        <h1
          className="font-display"
          style={{ fontSize: "clamp(32px, 7vw, 52px)", fontWeight: 900, lineHeight: 1.1, margin: "0 0 8px" }}
        >
          Refund on the way.
        </h1>

        <p style={{ color: "#F8EAD5aa", fontSize: 16, marginBottom: 28 }}>
          Your full refund of <strong style={{ color: "#F8EAD5" }}>{fmt(order.total_cents)}</strong> has
          been issued. Allow 5–10 business days to appear on your statement.
        </p>

        <div
          style={{
            background: "#3A3E43",
            border: "1px solid #F8EAD514",
            borderRadius: 16,
            padding: "18px 22px",
            textAlign: "left",
            marginBottom: 28,
          }}
        >
          <span style={{ fontSize: 13, color: "#F8EAD555" }}>Order </span>
          <span className="font-display" style={{ fontSize: 22, fontWeight: 900, letterSpacing: 1 }}>
            {order.code}
          </span>
          <span style={{ fontSize: 13, color: "#F8EAD555" }}> · {fmt(order.total_cents)} refunded</span>
        </div>

        <a
          href="/order"
          style={{
            display: "inline-block",
            background: "#2F7D4F",
            color: "#F8EAD5",
            textDecoration: "none",
            padding: "14px 28px",
            borderRadius: 100,
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          Order again →
        </a>

        <div style={{ marginTop: 16 }}>
          <a href="/" style={{ color: "#F8EAD544", textDecoration: "none", fontSize: 14 }}>
            ← Back to home
          </a>
        </div>
      </div>
    );
  }

  // ── Normal / confirmed state ────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 460, width: "100%", textAlign: "center" }}>
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

        {/* Address */}
        <div
          style={{
            marginTop: 18,
            padding: "14px 16px",
            background: confirmed ? "#2F7D4F12" : "#484D520d",
            border: `1px solid ${confirmed ? "#2F7D4F33" : "transparent"}`,
            borderRadius: 10,
            fontSize: 14,
            color: "#484D52",
            lineHeight: 1.5,
          }}
        >
          {confirmed ? (
            <>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>📍 Pickup address</div>
              <div>42852 Crossbow Ct, Ashburn, VA 20147</div>
              <div style={{ fontSize: 12, color: "#484D5299", marginTop: 6 }}>
                Also in your confirmation email — Order {order.code}
              </div>
            </>
          ) : (
            <span style={{ color: "#484D5299" }}>
              📍 Pickup address will appear here once your payment confirms.
            </span>
          )}
        </div>
      </div>

      {/* ── Cancellation section ── */}
      {confirmed && (
        <>
          {canCancel ? (
            <div
              style={{
                marginTop: 20,
                padding: "16px 20px",
                background: "#3A3E43",
                border: "1px solid #F8EAD514",
                borderRadius: 14,
                textAlign: "left",
              }}
            >
              {cancelStage === "confirm" ? (
                /* Confirm step */
                <div>
                  <p style={{ fontSize: 14, color: "#F8EAD5cc", margin: "0 0 14px" }}>
                    Cancel and get a full refund of{" "}
                    <strong style={{ color: "#F8EAD5" }}>{fmt(order.total_cents)}</strong>?
                    You won't be able to undo this.
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={handleCancel}
                      style={{
                        flex: 1,
                        background: "#60403F",
                        border: "none",
                        color: "#F8EAD5",
                        borderRadius: 9,
                        padding: "10px",
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "var(--font-archivo), sans-serif",
                      }}
                    >
                      Yes, cancel my order
                    </button>
                    <button
                      onClick={() => setCancelStage("idle")}
                      style={{
                        flex: 1,
                        background: "transparent",
                        border: "1px solid #F8EAD520",
                        color: "#F8EAD566",
                        borderRadius: 9,
                        padding: "10px",
                        fontSize: 14,
                        cursor: "pointer",
                        fontFamily: "var(--font-archivo), sans-serif",
                      }}
                    >
                      Keep it
                    </button>
                  </div>
                </div>
              ) : cancelStage === "cancelling" ? (
                <p style={{ fontSize: 14, color: "#F8EAD555", margin: 0, textAlign: "center" }}>
                  Cancelling…
                </p>
              ) : (
                /* Idle step */
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#F8EAD5cc" }}>
                      Changed your mind?
                    </div>
                    <div style={{ fontSize: 12, color: "#F8EAD544", marginTop: 2 }}>
                      {(() => {
                        const { text, urgent } = fmtWindow(order.cancellable_until, windowSecs);
                        return urgent
                          ? <>Closes in <span style={{ color: "#C9A227", fontWeight: 700 }}>{text}</span></>
                          : <>Cancel before <span style={{ color: "#F8EAD577", fontWeight: 700 }}>{text}</span></>;
                      })()}
                    </div>
                    {cancelStage === "error" && (
                      <div style={{ fontSize: 12, color: "#60403F", marginTop: 4 }}>
                        {cancelError}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setCancelStage("confirm")}
                    style={{
                      background: "#60403F",
                      border: "none",
                      color: "#F8EAD5",
                      borderRadius: 9,
                      padding: "9px 16px",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "var(--font-archivo), sans-serif",
                      flexShrink: 0,
                    }}
                  >
                    Cancel order
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Window closed — show nothing (order is cooking) */
            null
          )}
        </>
      )}

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
