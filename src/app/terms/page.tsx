import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Amori Muori",
};

export default function TermsPage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "60px 24px 80px",
        color: "#F8EAD5",
        fontFamily: "var(--font-archivo), sans-serif",
        lineHeight: 1.7,
      }}
    >
      <h1
        className="font-display"
        style={{ fontSize: 36, fontWeight: 900, marginBottom: 8 }}
      >
        Terms of Service
      </h1>
      <p style={{ color: "#F8EAD599", marginBottom: 40 }}>
        Effective date: June 18, 2025
      </p>

      <Section title="Overview">
        These terms govern your use of amorimouri.com and the Friday Night Take
        ordering service operated by Amori Muori in Ashburn Farm, Ashburn, VA.
        By placing an order you agree to these terms.
      </Section>

      <Section title="Orders and payment">
        All orders are paid in full at checkout via credit or debit card.
        Prices are listed in USD. No sales tax is applied. A tip is optional.
        Your order is not confirmed until payment is successfully processed by
        Stripe.
      </Section>

      <Section title="Pickup">
        Orders are available for pickup only at 42852 Crossbow Ct, Ashburn, VA
        20147. The address is provided after payment is confirmed. You are
        responsible for arriving within your selected pickup window. Amori
        Muori is not responsible for pizzas that cool due to late pickup.
      </Section>

      <Section title="Cancellations and refunds">
        You may cancel your order up to 30 minutes before your pickup time for
        a full refund. Cancellations after that window are not guaranteed.
        Refunds are issued to the original payment method and may take 5–10
        business days to appear.
      </Section>

      <Section title="SMS communications">
        If you opt in to SMS order updates at checkout, you agree to receive up
        to 2 automated text messages per order from Amori Muori. Message and
        data rates may apply. Reply <strong>STOP</strong> to unsubscribe at any
        time. Reply <strong>HELP</strong> for assistance.
      </Section>

      <Section title="Availability">
        The Friday Night Take operates on a limited nightly pool of 50 pizzas.
        Availability is not guaranteed. If a pizza or slot you selected becomes
        unavailable during checkout, you will be prompted to make a new
        selection.
      </Section>

      <Section title="Limitation of liability">
        Amori Muori&apos;s liability is limited to the amount you paid for your
        order. We are not liable for indirect or consequential damages arising
        from your use of this service.
      </Section>

      <Section title="Changes to these terms">
        We may update these terms from time to time. Continued use of the
        service after changes constitutes acceptance of the updated terms.
      </Section>

      <Section title="Contact">
        Questions? Email us at{" "}
        <a href="mailto:hello@amorimouri.com" style={{ color: "#2F7D4F" }}>
          hello@amorimouri.com
        </a>
        .
      </Section>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2
        className="font-display"
        style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}
      >
        {title}
      </h2>
      <div style={{ color: "#F8EAD5cc" }}>{children}</div>
    </section>
  );
}
