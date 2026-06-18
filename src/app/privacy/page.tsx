import type { Metadata } from "next";
import { SiteShell } from "@/components/ui/SiteShell";

export const metadata: Metadata = {
  title: "Privacy Policy — Amori Muori",
};

export default function PrivacyPage() {
  return (
    <SiteShell>
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "60px 24px 80px",
        lineHeight: 1.7,
      }}
    >
      <h1
        className="font-display"
        style={{ fontSize: 36, fontWeight: 900, marginBottom: 8 }}
      >
        Privacy Policy
      </h1>
      <p style={{ color: "#F8EAD599", marginBottom: 40 }}>
        Effective date: June 18, 2025
      </p>

      <Section title="Who we are">
        Amori Muori is a Neapolitan pizza business operating Friday Night Take
        pop-up dinners in Ashburn Farm, Ashburn, VA. Our website is{" "}
        <a href="https://amorimuori.com" style={{ color: "#2F7D4F" }}>
          amorimuori.com
        </a>
        .
      </Section>

      <Section title="Information we collect">
        When you place an order we collect your name, email address, mobile
        phone number, and payment information (processed securely by Stripe —
        we never store card details). We also collect your pickup slot
        preference and order contents.
      </Section>

      <Section title="How we use your information">
        <ul style={{ paddingLeft: 20, margin: "8px 0" }}>
          <li>To process and fulfill your pizza order</li>
          <li>To send your order confirmation and receipt by email</li>
          <li>
            To send you up to 2 SMS order-status updates per order (in-oven and
            ready) if you opted in at checkout
          </li>
          <li>To send an afternoon pickup reminder email on service day</li>
          <li>To communicate service announcements or ordering windows</li>
        </ul>
      </Section>

      <Section title="SMS messaging">
        If you opt in to text notifications at checkout, you consent to receive
        up to 2 automated SMS messages per order from Amori Muori. Message and
        data rates may apply. You can opt out at any time by replying{" "}
        <strong>STOP</strong> to any message. Reply <strong>HELP</strong> for
        help. We do not sell or share your phone number with third parties for
        marketing purposes.
      </Section>

      <Section title="Sharing your information">
        We share your information only with service providers necessary to
        operate the business: Stripe (payments), Twilio (SMS), Resend (email),
        Supabase (database), and Vercel (hosting). We do not sell your personal
        information.
      </Section>

      <Section title="Data retention">
        Order records are retained for accounting and tax purposes. You may
        request deletion of your personal data by emailing us at{" "}
        <a href="mailto:hello@amorimuori.com" style={{ color: "#2F7D4F" }}>
          hello@amorimuori.com
        </a>
        .
      </Section>

      <Section title="Contact">
        Questions about this policy? Email us at{" "}
        <a href="mailto:hello@amorimuori.com" style={{ color: "#2F7D4F" }}>
          hello@amorimuori.com
        </a>
        .
      </Section>
    </main>
    </SiteShell>
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
