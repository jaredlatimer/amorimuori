"use client";

import { useState } from "react";

interface Pizza {
  id: string;
  name: string;
  description: string;
  category: string;
  price_cents: number;
  allergens: string[];
  is_special: boolean;
  image_url: string | null;
}

interface Props {
  serviceNight: { id: string; service_date: string; nightly_total: number };
  pizzas: Pizza[];
  availability: Record<string, { remaining: number; soldOut: boolean }>;
  poolRemaining: number;
}

const inputStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 12,
  border: "1px solid #F8EAD520",
  background: "#484D52",
  color: "#F8EAD5",
  fontSize: 16,
  fontFamily: "var(--font-archivo), sans-serif",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  WebkitAppearance: "none",
};

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

function formatPickup(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  });
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

export function WalkInClient({ serviceNight, pizzas, availability, poolRemaining }: Props) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "link">("cash");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ code: string; pickup_at: string; total_cents: number; payment: string; paymentUrl?: string } | null>(null);

  const categories = [...new Set(pizzas.map(p => p.category))];
  const totalPizzas = Object.values(qty).reduce((s, q) => s + q, 0);
  const effectivePool = Math.max(0, poolRemaining - totalPizzas);
  const subtotal = pizzas.reduce((s, p) => s + p.price_cents * (qty[p.id] ?? 0), 0);
  const canSubmit = totalPizzas > 0 && name.trim().length > 0 && phone.trim().length > 0 && !submitting;

  function adjust(id: string, delta: number) {
    const avail = availability[id];
    setQty(prev => {
      const current = prev[id] ?? 0;
      const othersInCart = Object.entries(prev).reduce((s, [k, v]) => s + (k === id ? 0 : v), 0);
      const poolLeft = Math.max(0, poolRemaining - othersInCart);
      const max = Math.min(avail?.remaining ?? 0, poolLeft);
      const next = delta > 0 ? Math.min(max, current + 1) : Math.max(0, current - 1);
      if (next === 0) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/walk-in-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceNightId: serviceNight.id,
          quantities: qty,
          name, phone, email: email || undefined,
          paymentMethod,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to place order");
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setQty({});
    setName(""); setPhone(""); setEmail("");
    setResult(null); setError(null);
  }

  if (result) {
    return (
      <div style={{ paddingTop: 40, maxWidth: 480 }}>
        <div style={{ background: "#2F7D4F22", border: "1px solid #2F7D4F55", borderRadius: 20, padding: "40px 28px", textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>{result.payment === "cash" ? "💵" : "🔗"}</div>
          <h2 className="font-display" style={{ fontSize: 28, fontWeight: 900, margin: "0 0 16px", color: "#F8EAD5" }}>
            {result.payment === "cash" ? "Order placed — cash" : "Payment link sent"}
          </h2>
          <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 6, color: "#2F7D4F", margin: "0 0 8px", fontFamily: "var(--font-fraunces), serif" }}>
            #{result.code}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#F8EAD5cc", marginBottom: 6 }}>
            Pickup at {formatPickup(result.pickup_at)}
          </div>
          <div style={{ fontSize: 15, color: "#F8EAD566", marginBottom: result.paymentUrl ? 20 : 32 }}>
            {fmt(result.total_cents)} · {name}
          </div>
          {result.paymentUrl && (
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 13, color: "#F8EAD566", marginBottom: 10 }}>
                Link sent via SMS{email ? " & email" : ""}. You can also share it directly:
              </p>
              <a
                href={result.paymentUrl}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-block", background: "#C9A22722", border: "1px solid #C9A22766", color: "#C9A227", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 700, textDecoration: "none", wordBreak: "break-all" }}
              >
                Open payment link ↗
              </a>
            </div>
          )}
          <button
            onClick={reset}
            style={{ background: "#2F7D4F", border: "none", color: "#F8EAD5", borderRadius: 12, padding: "16px 40px", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-archivo), sans-serif" }}
          >
            New order
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 28, maxWidth: 560 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
        <h1 className="font-display" style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>Walk-in</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#F8EAD577", background: "#484D52", border: "1px solid #F8EAD515", borderRadius: 100, padding: "5px 13px" }}>
            {formatDate(serviceNight.service_date)}
          </span>
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: poolRemaining <= 0 ? "#60403F" : poolRemaining <= 10 ? "#C9A227" : "#2F7D4F",
            background: "#484D52", border: "1px solid #F8EAD515", borderRadius: 100, padding: "5px 13px",
          }}>
            {poolRemaining > 0 ? `${poolRemaining} left` : "Sold out"}
          </span>
        </div>
      </div>

      {/* Pizza list */}
      {categories.map(cat => (
        <div key={cat} style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#2F7D4F", marginBottom: 10 }}>
            {cat}
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {pizzas.filter(p => p.category === cat).map(pizza => {
              const avail = availability[pizza.id];
              const itemQty = qty[pizza.id] ?? 0;
              const soldOut = avail?.soldOut || avail?.remaining === 0;
              const canAdd = !soldOut && effectivePool > 0 && (avail?.remaining ?? 0) > itemQty;

              return (
                <div
                  key={pizza.id}
                  style={{
                    background: itemQty ? "#2F7D4F18" : "#484D52",
                    border: `1px solid ${itemQty ? "#2F7D4F55" : "#F8EAD510"}`,
                    borderRadius: 14,
                    padding: "14px 16px",
                    opacity: soldOut && !itemQty ? 0.4 : 1,
                  }}
                >
                  {/* Top row: name + price + qty controls */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {/* Name + price */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 16, color: "#F8EAD5" }}>{pizza.name}</span>
                        <span style={{ fontWeight: 700, fontSize: 15, color: "#2F7D4F" }}>{fmt(pizza.price_cents)}</span>
                        {pizza.is_special && (
                          <span style={{ fontSize: 11, fontWeight: 700, background: "#E8C24A", color: "#484D52", borderRadius: 100, padding: "2px 8px" }}>Special</span>
                        )}
                      </div>
                    </div>

                    {/* Qty controls — always visible, right-aligned */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                      {itemQty > 0 && (
                        <button
                          onClick={() => adjust(pizza.id, -1)}
                          style={{ width: 40, height: 40, borderRadius: "50%", background: "#3A3E43", border: "1px solid #F8EAD530", color: "#F8EAD5", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, flexShrink: 0 }}
                        >−</button>
                      )}
                      {itemQty > 0 && (
                        <span style={{ minWidth: 20, textAlign: "center", fontWeight: 700, fontSize: 17, color: "#F8EAD5" }}>{itemQty}</span>
                      )}
                      <button
                        onClick={() => adjust(pizza.id, 1)}
                        disabled={!canAdd}
                        style={{ width: 40, height: 40, borderRadius: "50%", background: canAdd ? "#2F7D4F" : "#3A3E43", border: canAdd ? "none" : "1px solid #F8EAD520", color: "#F8EAD5", fontSize: 22, cursor: canAdd ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, flexShrink: 0, opacity: canAdd ? 1 : 0.3 }}
                      >+</button>
                    </div>
                  </div>

                  {/* Description + status tags below */}
                  {(pizza.description || soldOut || (avail && avail.remaining <= 5 && avail.remaining > 0)) && (
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {pizza.description && (
                        <span style={{ fontSize: 13, color: "#F8EAD555", flex: 1 }}>{pizza.description}</span>
                      )}
                      {soldOut ? (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#F8EAD5", background: "#60403F", borderRadius: 100, padding: "2px 8px", flexShrink: 0 }}>Sold out</span>
                      ) : avail && avail.remaining <= 5 && avail.remaining > 0 ? (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#C9A227", flexShrink: 0 }}>{avail.remaining} left</span>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Order form — appears once any pizza is added */}
      {totalPizzas > 0 && (
        <div style={{ borderTop: "1px solid #F8EAD510", paddingTop: 24, marginTop: 4 }}>

          {/* Subtotal line */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <span style={{ fontSize: 14, color: "#F8EAD566" }}>
              {totalPizzas} pizza{totalPizzas !== 1 ? "s" : ""} · soonest slot auto-assigned
            </span>
            <span style={{ fontSize: 18, fontWeight: 900, color: "#F8EAD5", fontFamily: "var(--font-fraunces), serif" }}>
              {fmt(subtotal)}
            </span>
          </div>

          {/* Customer fields */}
          <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
            <input
              style={inputStyle}
              placeholder="Customer name *"
              value={name}
              onChange={e => setName(e.target.value)}
              autoCapitalize="words"
            />
            <input
              style={inputStyle}
              placeholder="Mobile number *"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="Email (optional)"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          {/* Payment method toggle */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {(["cash", "link"] as const).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPaymentMethod(method)}
                style={{
                  flex: 1, padding: "12px", borderRadius: 12, fontSize: 15, fontWeight: 700,
                  cursor: "pointer", fontFamily: "var(--font-archivo), sans-serif",
                  background: paymentMethod === method ? "#F8EAD5" : "transparent",
                  color: paymentMethod === method ? "#484D52" : "#F8EAD566",
                  border: `1.5px solid ${paymentMethod === method ? "#F8EAD5" : "#F8EAD520"}`,
                }}
              >
                {method === "cash" ? "💵 Cash" : "🔗 Payment Link"}
              </button>
            ))}
          </div>

          {paymentMethod === "link" && !email && (
            <p style={{ fontSize: 13, color: "#C9A227", marginBottom: 12 }}>
              Add an email above to also send the link by email.
            </p>
          )}

          {error && (
            <p style={{ fontSize: 14, color: "#E05555", marginBottom: 12, lineHeight: 1.4 }}>{error}</p>
          )}

          <button
            onClick={submit}
            disabled={!canSubmit}
            style={{
              width: "100%",
              background: canSubmit ? "#2F7D4F" : "#2F7D4F44",
              border: "none",
              color: "#F8EAD5",
              borderRadius: 14,
              padding: "17px",
              fontSize: 17,
              fontWeight: 700,
              cursor: canSubmit ? "pointer" : "not-allowed",
              fontFamily: "var(--font-archivo), sans-serif",
            }}
          >
            {submitting ? "Placing order…" : paymentMethod === "cash" ? `Place order · ${fmt(subtotal)} cash` : `Send payment link · ${fmt(subtotal)}`}
          </button>
        </div>
      )}
    </div>
  );
}
