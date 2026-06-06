"use client";

import { useState, useEffect, useRef } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { stripePromise } from "@/lib/stripe-client";
import { CheckoutFormInner } from "@/components/CheckoutForm";
import type { Pizza } from "@/lib/types";
import type { PizzaAvailability } from "@/lib/availability";

type CheckoutState =
  | { stage: "form" }
  | { stage: "loading" }
  | { stage: "payment"; clientSecret: string; code: string; totalCents: number }
  | { stage: "error"; message: string };

const TIP_OPTIONS: { label: string; value: number | null }[] = [
  { label: "15%", value: 15 },
  { label: "18%", value: 18 },
  { label: "20%", value: 20 },
  { label: "25%", value: 25 },
  { label: "None", value: null },
];

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatSlot(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

export interface PizzaGroup {
  category: string;
  items: Pizza[];
}

interface OrderFormProps {
  groups: PizzaGroup[];
  serviceNightId: string;
  serviceDate: string;
  availability: Record<string, PizzaAvailability>;
  poolRemaining: number;
  nightlyTotal: number;
}

export function OrderForm({
  groups,
  serviceNightId,
  serviceDate,
  availability,
  poolRemaining,
  nightlyTotal,
}: OrderFormProps) {
  const isTonight =
    serviceDate ===
    new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const [qty, setQty] = useState<Record<string, number>>({});
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState("");
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [tipPct, setTipPct] = useState<number | null>(18);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [checkout, setCheckout] = useState<CheckoutState>({ stage: "form" });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allPizzas = groups.flatMap((g) => g.items);
  const totalPizzas = Object.values(qty).reduce((a, b) => a + b, 0);
  const cartItems = allPizzas.filter((p) => (qty[p.id] ?? 0) > 0);
  const subtotal = cartItems.reduce(
    (sum, p) => sum + p.price_cents * (qty[p.id] ?? 0),
    0
  );
  const tipAmt =
    tipPct !== null ? Math.round(subtotal * (tipPct / 100)) : 0;
  const total = subtotal + tipAmt;

  // Remaining pool after what's in this cart
  const effectivePool = Math.max(0, poolRemaining - totalPizzas);
  const nightSoldOut = poolRemaining <= 0;

  // Fetch pickup slots (debounced) when cart changes
  useEffect(() => {
    if (totalPizzas === 0) {
      setSlots([]);
      setSlot("");
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSlotsLoading(true);
      try {
        const res = await fetch("/api/quote-pickup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serviceNightId, quantities: qty }),
        });
        const data = await res.json();
        if (data.slots?.length > 0) {
          setSlots(data.slots);
          setSlot((prev) =>
            data.slots.includes(prev) ? prev : data.slots[0]
          );
        } else {
          setSlots([]);
          setSlot("");
        }
      } catch {
        // network error — silently ignore
      } finally {
        setSlotsLoading(false);
      }
    }, 400);
  }, [qty, serviceNightId, totalPizzas]);

  function adjust(id: string, delta: number) {
    const avail = availability[id];
    setQty((prev) => {
      const current = prev[id] ?? 0;
      const capRemaining = avail?.remaining ?? 99;
      // Also cap at pool: how many of other pizzas are in cart
      const othersInCart = Object.entries(prev).reduce(
        (s, [k, v]) => s + (k === id ? 0 : v),
        0
      );
      const poolLeft = Math.max(0, poolRemaining - othersInCart);
      const max = Math.min(capRemaining, poolLeft);
      const next = delta > 0 ? Math.min(max, current + 1) : Math.max(0, current - 1);
      if (next === 0) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCheckout({ stage: "loading" });

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceNightId,
          quantities: qty,
          pickupSlot: slot,
          tipPct,
          name,
          phone,
          email,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.clientSecret) {
        if (data.slotTaken) {
          // Slot was claimed by someone else — kick back to slot selection
          setSlot("");
          setSlots([]);
          setCheckout({
            stage: "error",
            message: data.error,
          });
        } else {
          setCheckout({
            stage: "error",
            message: data.error ?? "Something went wrong. Please try again.",
          });
        }
        return;
      }
      setCheckout({
        stage: "payment",
        clientSecret: data.clientSecret,
        code: data.code,
        totalCents: data.totalCents,
      });
    } catch {
      setCheckout({ stage: "error", message: "Network error. Please try again." });
    }
  }

  const isCheckingOut = (checkout.stage as string) === "loading";
  const canSubmit =
    totalPizzas > 0 &&
    !!slot &&
    name.trim().length > 0 &&
    phone.trim().length > 0 &&
    email.includes("@") &&
    checkout.stage === "form";

  const inputStyle = {
    padding: "13px 15px",
    borderRadius: 11,
    border: "1.5px solid #484D5222",
    fontSize: 15,
    background: "#ffffff",
    color: "#484D52",
    fontFamily: "var(--font-archivo), sans-serif",
    width: "100%",
    outline: "none",
  } as const;

  return (
    <div className="order-grid" style={{ alignItems: "start" }}>
      {/* ── MENU COLUMN ── */}
      <div style={{ padding: "40px 0" }}>
        <h2
          className="font-display"
          style={{ fontSize: 38, fontWeight: 900, letterSpacing: -0.5 }}
        >
          The Menu
        </h2>

        {/* Pool remaining badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 8,
            marginBottom: 28,
            flexWrap: "wrap",
          }}
        >
          <p style={{ color: "#F8EAD599", fontSize: 15, margin: 0 }}>
            Tap to add pizzas to your order.
          </p>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: nightSoldOut
                ? "#60403F"
                : effectivePool <= 10
                ? "#C9A227"
                : "#2F7D4F",
              background: "#3A3E43aa",
              border: "1px solid #F8EAD51a",
              borderRadius: 100,
              padding: "5px 12px",
            }}
          >
            {nightSoldOut
              ? `Sold out ${isTonight ? "tonight" : "this Friday"}`
              : `${poolRemaining} of ${nightlyTotal} left ${isTonight ? "tonight" : "this Friday"}`}
          </span>
        </div>

        {/* Categories */}
        {groups.map((group) => (
          <div key={group.category} style={{ marginBottom: 30 }}>
            {/* Italic basil category label */}
            <div
              className="font-display"
              style={{
                fontSize: 16,
                fontWeight: 600,
                fontStyle: "italic",
                color: "#2F7D4F",
                letterSpacing: 0.5,
                marginBottom: 12,
                textTransform: "uppercase",
              }}
            >
              {group.category}
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              {group.items.map((pizza) => {
                const avail = availability[pizza.id];
                const itemQty = qty[pizza.id] ?? 0;
                const soldOut =
                  avail?.soldOut === true ||
                  avail?.remaining === 0 ||
                  nightSoldOut;
                const low =
                  avail &&
                  !avail.soldOut &&
                  avail.remaining > 0 &&
                  avail.remaining <= 5;
                const canAdd =
                  !nightSoldOut &&
                  effectivePool > 0 &&
                  !avail?.soldOut &&
                  (avail?.remaining ?? 99) > itemQty;

                return (
                  <div
                    key={pizza.id}
                    className="menucard"
                    style={{
                      background: itemQty
                        ? "#2F7D4F1f"
                        : "#3A3E4380",
                      border: `1px solid ${itemQty ? "#2F7D4F" : "#F8EAD51a"}`,
                      borderRadius: 16,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: pizza.image_url ? "stretch" : "center",
                      gap: pizza.image_url ? 0 : 16,
                      opacity: soldOut && itemQty === 0 ? 0.55 : 1,
                      overflow: "hidden",
                      padding: pizza.image_url ? 0 : "18px 20px",
                    }}
                  >
                    {/* Image column */}
                    {pizza.image_url && (
                      <div style={{ width: 130, flexShrink: 0, position: "relative", overflow: "hidden" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={pizza.image_url}
                          alt=""
                          style={{
                            position: "absolute",
                            top: 0,
                            bottom: 0,
                            height: "100%",
                            width: "auto",
                            maxWidth: "none",
                            right: -10,
                          }}
                        />
                      </div>
                    )}

                    {/* Pizza info */}
                    <div style={{ flex: 1, ...(pizza.image_url ? { padding: "16px 8px 16px 4px" } : {}) }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          className="font-display"
                          style={{ fontSize: 21, fontWeight: 600 }}
                        >
                          {pizza.name}
                        </span>
                        <span
                          style={{
                            color: "#2F7D4F",
                            fontWeight: 700,
                            fontSize: 16,
                          }}
                        >
                          ${(pizza.price_cents / 100).toFixed(0)}
                        </span>
                        {pizza.is_special && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#484D52",
                              background: "#E8C24A",
                              borderRadius: 100,
                              padding: "2px 9px",
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                            }}
                          >
                            Special
                          </span>
                        )}
                        {soldOut && itemQty === 0 ? (
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: "#F8EAD5",
                              background: "#60403F",
                              borderRadius: 100,
                              padding: "3px 10px",
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                            }}
                          >
                            Sold out
                          </span>
                        ) : low ? (
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: "#C9A227",
                              background: "#C9A22722",
                              borderRadius: 100,
                              padding: "2px 9px",
                            }}
                          >
                            {avail!.remaining} left
                          </span>
                        ) : null}
                      </div>

                      <div
                        style={{
                          color: "#F8EAD599",
                          fontSize: 14,
                          marginTop: 4,
                        }}
                      >
                        {pizza.description}
                      </div>

                      {/* Allergen pill badges */}
                      {pizza.allergens.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 6,
                            marginTop: 9,
                          }}
                        >
                          {[...new Set(pizza.allergens.map((a) => a.toLowerCase()))].map((a) => (
                            <span
                              key={a}
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#F8EAD5aa",
                                border: "1px solid #F8EAD522",
                                borderRadius: 100,
                                padding: "2px 8px",
                                letterSpacing: 0.3,
                              }}
                            >
                              {a}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Quantity controls */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        ...(pizza.image_url ? { padding: "16px 18px 16px 8px" } : {}),
                      }}
                    >
                      {itemQty > 0 && (
                        <button
                          className="qtybtn"
                          type="button"
                          onClick={() => adjust(pizza.id, -1)}
                        >
                          −
                        </button>
                      )}
                      {itemQty > 0 && (
                        <span
                          style={{
                            minWidth: 18,
                            textAlign: "center",
                            fontWeight: 700,
                            fontSize: 17,
                          }}
                        >
                          {itemQty}
                        </span>
                      )}
                      <button
                        className="qtybtn"
                        type="button"
                        onClick={() => adjust(pizza.id, 1)}
                        disabled={!canAdd}
                        style={
                          itemQty === 0 && canAdd
                            ? {
                                background: "#F8EAD5",
                                color: "#484D52",
                                borderColor: "#F8EAD555",
                              }
                            : undefined
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── CART COLUMN (sticky cream card) ── */}
      <div style={{ position: "sticky", top: 90, padding: "40px 0" }}>
        <div
          style={{
            background: "#F8EAD5",
            color: "#484D52",
            borderRadius: 22,
            padding: "28px 26px",
            boxShadow: "0 24px 60px rgba(0,0,0,.35)",
          }}
        >
          <h3
            className="font-display"
            style={{ fontSize: 26, fontWeight: 900 }}
          >
            Your order
          </h3>

          {totalPizzas === 0 ? (
            <p style={{ color: "#484D5299", marginTop: 14, fontSize: 15 }}>
              No pizzas yet — add some from the menu.
            </p>
          ) : checkout.stage === "payment" ? (
            /* ── Stripe payment panel ── */
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret: checkout.clientSecret,
                appearance: {
                  theme: "flat",
                  variables: {
                    colorBackground: "#ffffff",
                    colorText: "#484D52",
                    colorPrimary: "#2F7D4F",
                    colorDanger: "#C9A227",
                    borderRadius: "11px",
                    fontFamily: "var(--font-archivo), sans-serif",
                    spacingUnit: "5px",
                  },
                },
              }}
            >
              {/* Order summary */}
              <div style={{ margin: "14px 0 4px", display: "grid", gap: 8 }}>
                {cartItems.map((p) => (
                  <div
                    key={p.id}
                    style={{ display: "flex", justifyContent: "space-between", fontSize: 15 }}
                  >
                    <span><strong>{qty[p.id]}×</strong> {p.name}</span>
                    <span style={{ fontWeight: 700 }}>
                      ${((p.price_cents * (qty[p.id] ?? 0)) / 100).toFixed(0)}
                    </span>
                  </div>
                ))}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 19,
                    fontWeight: 900,
                    paddingTop: 10,
                    borderTop: "1.5px solid #484D5222",
                    marginTop: 2,
                    fontFamily: "var(--font-fraunces), serif",
                  }}
                >
                  <span>Total</span>
                  <span>{fmt(checkout.totalCents)}</span>
                </div>
              </div>
              <CheckoutFormInner
                code={checkout.code}
                totalCents={checkout.totalCents}
                onBack={() => setCheckout({ stage: "form" })}
              />
            </Elements>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Cart items */}
              <div style={{ margin: "18px 0", display: "grid", gap: 10 }}>
                {cartItems.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 15,
                    }}
                  >
                    <span>
                      <strong>{qty[p.id]}×</strong> {p.name}
                    </span>
                    <span style={{ fontWeight: 700 }}>
                      ${((p.price_cents * (qty[p.id] ?? 0)) / 100).toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Pickup window — slate sub-card with steam */}
              <div
                style={{
                  background: "#484D52",
                  color: "#F8EAD5",
                  borderRadius: 16,
                  padding: "20px",
                  margin: "8px 0 18px",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Steam wisps */}
                <div style={{ position: "absolute", right: 22, top: 8 }}>
                  {[0, 1, 2].map((s) => (
                    <span
                      key={s}
                      style={{
                        position: "absolute",
                        width: 4,
                        height: 18,
                        borderRadius: 9,
                        background: "#F8EAD566",
                        animation: `steam 2.4s ease-in-out ${s * 0.5}s infinite`,
                        left: s * 8,
                      }}
                    />
                  ))}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: "#F8EAD5aa",
                    fontWeight: 700,
                  }}
                >
                  Pickup window
                </div>

                {slotsLoading ? (
                  <div
                    className="font-display"
                    style={{
                      fontSize: 32,
                      fontWeight: 900,
                      lineHeight: 1,
                      marginTop: 6,
                      color: "#F8EAD566",
                    }}
                  >
                    —
                  </div>
                ) : slot ? (
                  <>
                    <div
                      className="font-display"
                      style={{
                        fontSize: 42,
                        fontWeight: 900,
                        lineHeight: 1,
                        marginTop: 6,
                      }}
                    >
                      {formatSlot(slot)}
                    </div>
                    <div
                      style={{
                        fontSize: 13.5,
                        color: "#F8EAD5cc",
                        marginTop: 8,
                      }}
                    >
                      {slot === slots[0]
                        ? "Earliest available — ready as soon as we can."
                        : "You picked a later window."}
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      fontSize: 14,
                      color: "#60403F",
                      marginTop: 8,
                    }}
                  >
                    No slots available.
                  </div>
                )}

                {/* Slot chips */}
                {slots.length > 1 && (
                  <div
                    style={{
                      marginTop: 18,
                      paddingTop: 16,
                      borderTop: "1px solid #F8EAD51f",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        letterSpacing: 1.5,
                        textTransform: "uppercase",
                        color: "#F8EAD5aa",
                        fontWeight: 700,
                        marginBottom: 10,
                      }}
                    >
                      Want it later?
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {slots.map((s, idx) => {
                        const active = s === slot;
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setSlot(s)}
                            className="am-btn"
                            style={{
                              background: active ? "#2F7D4F" : "transparent",
                              color: "#F8EAD5",
                              border: `1.5px solid ${active ? "#2F7D4F" : "#F8EAD544"}`,
                              borderRadius: 100,
                              padding: "8px 14px",
                              fontSize: 13.5,
                              fontWeight: 700,
                            }}
                          >
                            {formatSlot(s)}
                            {idx === 0 ? " · soonest" : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Tip selector */}
              <div style={{ marginTop: 6 }}>
                <div
                  style={{
                    fontSize: 12,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    color: "#484D5299",
                    fontWeight: 700,
                    marginBottom: 8,
                  }}
                >
                  Add a tip
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {TIP_OPTIONS.map((opt) => {
                    const active = tipPct === opt.value;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setTipPct(opt.value)}
                        className="am-btn"
                        style={{
                          flex: 1,
                          background: active ? "#2F7D4F" : "transparent",
                          color: active ? "#F8EAD5" : "#484D52",
                          border: `1.5px solid ${active ? "#2F7D4F" : "#484D5233"}`,
                          borderRadius: 10,
                          padding: "9px 0",
                          fontSize: 14,
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Totals */}
              <div
                style={{
                  marginTop: 18,
                  paddingTop: 14,
                  borderTop: "1.5px solid #484D5222",
                  display: "grid",
                  gap: 7,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 14.5,
                    color: "#484D52cc",
                  }}
                >
                  <span>Subtotal</span>
                  <span>{fmt(subtotal)}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 14.5,
                    color: "#484D52cc",
                  }}
                >
                  <span>
                    Tip{tipPct !== null ? ` (${tipPct}%)` : ""}
                  </span>
                  <span>{fmt(tipAmt)}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 19,
                    fontWeight: 900,
                    paddingTop: 8,
                    borderTop: "1.5px solid #484D5222",
                    marginTop: 2,
                    fontFamily: "var(--font-fraunces), serif",
                  }}
                >
                  <span>Total</span>
                  <span>{fmt(total)}</span>
                </div>
              </div>

              {/* Contact fields */}
              <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
                <input
                  required
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={inputStyle}
                />
                <input
                  required
                  type="tel"
                  placeholder="Mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={inputStyle}
                />
                <input
                  required
                  type="email"
                  placeholder="Email (for your receipt)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {checkout.stage === "error" && (
                <p
                  style={{
                    fontSize: 13,
                    color: "#C9A227",
                    textAlign: "center",
                    marginTop: 8,
                  }}
                >
                  {checkout.message}
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={!canSubmit || isCheckingOut}
                className="am-btn"
                style={{
                  width: "100%",
                  marginTop: 16,
                  background:
                    !canSubmit || isCheckingOut
                      ? "#484D5255"
                      : "#2F7D4F",
                  color: "#F8EAD5",
                  padding: "16px",
                  borderRadius: 12,
                  fontSize: 16,
                  cursor:
                    !canSubmit || isCheckingOut
                      ? "not-allowed"
                      : "pointer",
                  textAlign: "center",
                }}
              >
                {!canSubmit && totalPizzas > 0
                  ? "Add your details to continue"
                  : isCheckingOut
                  ? "Setting up payment…"
                  : `Continue to payment · ${fmt(total)}`}
              </button>

              <div
                style={{
                  fontSize: 12.5,
                  color: "#484D588",
                  textAlign: "center",
                  marginTop: 10,
                  lineHeight: 1.4,
                }}
              >
                📍 Pickup is in the Ashburn Farm neighborhood — exact address
                shared right after payment.
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
