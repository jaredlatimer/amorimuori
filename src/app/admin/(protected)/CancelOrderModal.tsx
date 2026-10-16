"use client";

import { useEffect, useRef, useState } from "react";

export type CancelMode = "cancel" | "refund";

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Confirmation screen for the two destructive admin actions on an order:
 * plain Cancel (no money back) and Cancel & refund (card refunded via Stripe).
 * "Keep order" is focused by default so an accidental Enter never cancels.
 */
export function CancelOrderModal({
  mode,
  customerName,
  code,
  amountCents,
  canRefund,
  onClose,
  onConfirm,
}: {
  mode: CancelMode;
  customerName: string;
  code: string;
  amountCents: number;
  /** Whether the order has a card payment that "Cancel & refund" could return */
  canRefund: boolean;
  onClose: () => void;
  /** Runs the action. Resolve to an error message to show it, or null on success. */
  onConfirm: () => Promise<string | null>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const amount = fmt(amountCents);
  const isRefund = mode === "refund";

  useEffect(() => {
    keepRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function confirm() {
    setBusy(true);
    setError(null);
    const err = await onConfirm().catch(() => "Something went wrong. Check your connection and try again.");
    if (err) {
      setError(err);
      setBusy(false);
      return;
    }
    onClose();
  }

  const btn: React.CSSProperties = {
    borderRadius: 10,
    padding: "11px 18px",
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "var(--font-archivo), sans-serif",
    border: "none",
    cursor: busy ? "not-allowed" : "pointer",
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => {
        e.stopPropagation();
        if (!busy) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancel-order-title"
        aria-describedby="cancel-order-desc"
        style={{ background: "#484D52", color: "#F8EAD5", borderRadius: 20, width: "100%", maxWidth: 440, padding: "22px 22px 20px", boxShadow: "0 12px 40px #0009", fontFamily: "var(--font-archivo), sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="cancel-order-title" className="font-display" style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>
          {isRefund ? "Cancel and refund this order?" : "Cancel without a refund?"}
        </h2>

        <div style={{ marginTop: 14, background: "#3A3E43", borderRadius: 12, padding: "12px 14px", display: "grid", gap: 3 }}>
          <span style={{ fontSize: 16, fontWeight: 800 }}>{customerName}</span>
          <span style={{ fontSize: 13, color: "#F8EAD599" }}>
            Order {code} · {amount}
          </span>
        </div>

        <div id="cancel-order-desc" style={{ marginTop: 14, fontSize: 14, lineHeight: 1.5, color: "#F8EAD5dd" }}>
          {isRefund ? (
            <>
              <p style={{ margin: 0 }}>
                The order will be cancelled and the customer&apos;s card will be refunded <b>{amount}</b>.
              </p>
              <p style={{ margin: "8px 0 0", color: "#f0a0a0", fontWeight: 700 }}>This can&apos;t be undone.</p>
            </>
          ) : (
            <>
              <p style={{ margin: 0 }}>
                The order will be cancelled. The customer is <b style={{ color: "#f0a0a0" }}>NOT refunded</b>
                {canRefund ? <>: the {amount} card charge stays in place.</> : "."}
              </p>
              {canRefund && (
                <p style={{ margin: "8px 0 0", color: "#F8EAD599" }}>
                  To give their money back, use &ldquo;Cancel &amp; refund&rdquo; instead.
                </p>
              )}
            </>
          )}
        </div>

        {error && (
          <div role="alert" style={{ marginTop: 14, background: "#60403F", color: "#F8EAD5", borderRadius: 10, padding: "10px 12px", fontSize: 13, fontWeight: 700 }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            ref={keepRef}
            onClick={onClose}
            disabled={busy}
            style={{ ...btn, background: "#F8EAD5", color: "#484D52", outlineOffset: 2 }}
          >
            Keep order
          </button>
          <button
            onClick={confirm}
            disabled={busy}
            style={{ ...btn, background: "#C62828", color: "#fff", opacity: busy ? 0.6 : 1 }}
          >
            {busy
              ? isRefund
                ? "Refunding…"
                : "Cancelling…"
              : isRefund
                ? `Cancel & refund ${amount}`
                : "Cancel (no refund)"}
          </button>
        </div>
      </div>
    </div>
  );
}
