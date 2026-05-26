"use client";

import { useState } from "react";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

interface CheckoutFormInnerProps {
  code: string;
  totalCents: number;
  onBack: () => void;
}

export function CheckoutFormInner({
  code,
  totalCents,
  onBack,
}: CheckoutFormInnerProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setPaying(true);
    setPayError("");

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/order/confirmation?code=${code}`,
      },
    });

    // Only reaches here if there's an error (otherwise Stripe redirects)
    setPaying(false);
    setPayError(error?.message ?? "Payment failed. Please try again.");
  }

  return (
    <form onSubmit={handlePay} style={{ marginTop: 4 }}>
      <PaymentElement
        options={{
          layout: "tabs",
          terms: { card: "never" },
        }}
      />

      {payError && (
        <p
          style={{
            fontSize: 13,
            color: "#C9A227",
            marginTop: 10,
            lineHeight: 1.4,
          }}
        >
          {payError}
        </p>
      )}

      <button
        type="submit"
        disabled={!stripe || paying}
        style={{
          width: "100%",
          marginTop: 16,
          background: !stripe || paying ? "#484D5255" : "#2F7D4F",
          color: "#F8EAD5",
          padding: "16px",
          borderRadius: 12,
          fontSize: 16,
          fontWeight: 700,
          fontFamily: "var(--font-archivo), sans-serif",
          cursor: !stripe || paying ? "not-allowed" : "pointer",
          border: "none",
          transition: "background 0.15s",
        }}
      >
        {paying ? "Processing…" : `Pay ${fmt(totalCents)}`}
      </button>

      <button
        type="button"
        onClick={onBack}
        style={{
          width: "100%",
          marginTop: 10,
          background: "transparent",
          color: "#484D5299",
          padding: "10px",
          border: "none",
          fontSize: 14,
          cursor: "pointer",
          fontFamily: "var(--font-archivo), sans-serif",
        }}
      >
        ← Edit order
      </button>
    </form>
  );
}
