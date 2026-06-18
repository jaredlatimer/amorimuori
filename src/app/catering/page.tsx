import { LogoLockup } from "@/components/ui/Logo";
import { CateringForm } from "./CateringForm";

export const metadata = {
  title: "Catering — Amori Muori",
  description: "Bring the 900° oven to your event. Neapolitan pizza catering in Northern Virginia.",
};

export default function CateringPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#484D52",
        position: "relative",
        overflow: "hidden",
        fontFamily: "var(--font-archivo), sans-serif",
        color: "#F8EAD5",
      }}
    >
      {/* Radial gradient atmosphere */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at 70% 12%, #3A3E4300, #3A3E43cc)",
          pointerEvents: "none",
        }}
      />

      {/* Nav */}
      <nav
        style={{
          position: "relative",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "22px 7vw",
        }}
      >
        <a href="/" style={{ textDecoration: "none", color: "inherit" }}>
          <LogoLockup />
        </a>
        <a
          href="/order"
          className="am-btn"
          style={{
            background: "#F8EAD5",
            color: "#484D52",
            borderRadius: 100,
            padding: "11px 22px",
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Order now
        </a>
      </nav>

      {/* Content */}
      <div style={{ position: "relative", maxWidth: 560, margin: "0 auto", padding: "30px 24px 80px" }}>
        <p style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: "#F8EAD5aa", margin: 0 }}>
          Catering
        </p>
        <h1
          className="font-display"
          style={{ fontSize: 40, fontWeight: 900, lineHeight: 1.1, margin: "10px 0 0" }}
        >
          Bring the oven to your event.
        </h1>
        <p style={{ marginTop: 16, fontSize: 17, lineHeight: 1.6, color: "#F8EAD5cc" }}>
          Fresh Neapolitan pizza, fired on site at 900°. Tell us about your event and
          we&apos;ll get back to you within a couple of days.
        </p>

        <CateringForm />
      </div>
    </div>
  );
}
