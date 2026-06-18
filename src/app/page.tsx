import { getAvailability } from "@/lib/availability";
import { createServiceClient } from "@/lib/supabase/server";
import { LogoLockup } from "@/components/ui/Logo";

export const dynamic = "force-dynamic";

// "17:30:00" → "5:30 PM"
function formatServiceStart(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

async function getServiceStart(): Promise<string> {
  const supabase = await createServiceClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  // Next enabled service night's start time, falling back to global settings
  const { data: night } = await supabase
    .from("service_nights")
    .select("service_start")
    .eq("is_enabled", true)
    .gte("service_date", today)
    .order("service_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (night?.service_start) return formatServiceStart((night as { service_start: string }).service_start);

  const { data: settings } = await supabase.from("settings").select("service_start").single();
  if (settings?.service_start) return formatServiceStart((settings as { service_start: string }).service_start);

  return "6:00 PM";
}

const INFO_CARDS = [
  {
    k: "01",
    t: "Order Wednesday",
    d: "Pre-ordering opens each Wednesday for that week's Friday service. No phone calls, no lines.",
  },
  {
    k: "02",
    t: "Pick your window",
    d: "Choose the soonest slot or schedule a later pickup that suits your evening.",
  },
  {
    k: "03",
    t: "Pay & get the address",
    d: "Check out by card or Apple Pay. Your Ashburn Farm pickup spot is revealed the moment payment clears.",
  },
];

export default async function Home() {
  const availability = await getAvailability();
  const serviceStart = await getServiceStart();
  const isOpen = availability.isOpen;
  const openDayName = availability.nextOpenAt
    ? new Date(availability.nextOpenAt).toLocaleDateString("en-US", { weekday: "long", timeZone: "America/New_York" })
    : "Wednesday";

  const serviceDate = availability.serviceNight?.service_date ?? null;
  // "YYYY-MM-DD" → "Friday, June 20"
  const serviceDateLabel = serviceDate
    ? new Date(`${serviceDate}T12:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : null;
  // Two days before the service Friday → Wednesday
  const orderingOpensLabel = serviceDate
    ? (() => {
        const d = new Date(`${serviceDate}T12:00:00`);
        d.setDate(d.getDate() - 2);
        return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      })()
    : null;

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
          background:
            "radial-gradient(circle at 70% 12%, #3A3E4300, #3A3E43cc)",
          pointerEvents: "none",
        }}
      />
      {/* Dotted texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.04,
          backgroundImage: "radial-gradient(#F8EAD5 1px, transparent 1px)",
          backgroundSize: "26px 26px",
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
        <LogoLockup />
        <a
          href="/order"
          className="am-btn"
          style={{
            background: "#F8EAD5",
            color: "#484D52",
            padding: "11px 22px",
            borderRadius: 100,
            fontSize: 14,
          }}
        >
          {isOpen ? "Order now" : `Opens ${openDayName}`}
        </a>
      </nav>

      {/* Hero */}
      <section
        style={{
          position: "relative",
          padding: "6vh 7vw 10vh",
          maxWidth: 1100,
        }}
      >
        {/* Green badge pill */}
        <div
          className="rise"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 9,
            background: "#2F7D4F25",
            border: "1px solid #2F7D4F66",
            color: "#F8EAD5",
            padding: "7px 15px",
            borderRadius: 100,
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 30,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 99,
              background: "#2F7D4F",
              display: "inline-block",
            }}
          />
          Friday Night Take · Ashburn Farm, VA
        </div>

        <h1
          className="font-display rise"
          style={{
            fontSize: "clamp(48px, 9vw, 104px)",
            fontWeight: 900,
            lineHeight: 0.92,
            letterSpacing: -1,
            animationDelay: ".05s",
          }}
        >
          Authentic
          <br />
          Neapolitan pizza,
          <br />
          <span style={{ fontStyle: "italic", color: "#FFF0DA" }}>
            made for Fridays.
          </span>
        </h1>

        <p
          className="rise"
          style={{
            marginTop: 26,
            maxWidth: 540,
            fontSize: 18,
            lineHeight: 1.55,
            color: "#F8EAD5cc",
            animationDelay: ".12s",
          }}
        >
          Fired at 900°, 60-second bake, tomato sauce and fresh mozzarella and
          more made fresh in <strong style={{ color: "#F8EAD5" }}>Ashburn Farm</strong>.{" "}
          {serviceDateLabel && orderingOpensLabel ? (
            <>
              Next service is{" "}
              <strong style={{ color: "#F8EAD5" }}>{serviceDateLabel}</strong>
              {" — "}ordering opens{" "}
              <strong style={{ color: "#F8EAD5" }}>{orderingOpensLabel}</strong>.
            </>
          ) : (
            <>
              When we&apos;re running, ordering opens the Wednesday before.
            </>
          )}{" "}
          Reserve your pickup window — service starts at{" "}
          <strong style={{ color: "#F8EAD5" }}>{serviceStart}</strong>.
        </p>

        {/* CTAs */}
        <div
          className="rise"
          style={{
            display: "flex",
            gap: 14,
            marginTop: 38,
            flexWrap: "wrap",
            animationDelay: ".18s",
          }}
        >
          <a
            href="/order"
            className="am-btn"
            style={{
              background: "#F8EAD5",
              color: "#484D52",
              padding: "16px 34px",
              borderRadius: 100,
              fontSize: 16,
            }}
          >
            {isOpen ? "Start your order →" : "See what’s cooking →"}
          </a>
          <a
            href="/order"
            className="am-btn"
            style={{
              background: "transparent",
              color: "#F8EAD5",
              padding: "16px 28px",
              borderRadius: 100,
              fontSize: 16,
              border: "1.5px solid #F8EAD544",
            }}
          >
            See the menu
          </a>
        </div>

        {/* 01/02/03 info cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 18,
            marginTop: 70,
          }}
        >
          {INFO_CARDS.map((card, i) => (
            <div
              key={card.k}
              className="rise"
              style={{
                background: "#3A3E4399",
                border: "1px solid #F8EAD51a",
                borderRadius: 18,
                padding: "26px 24px",
                animationDelay: `${0.24 + i * 0.07}s`,
              }}
            >
              <div
                className="font-display"
                style={{ fontSize: 30, color: "#2F7D4F", fontWeight: 900 }}
              >
                {card.k}
              </div>
              <div style={{ fontWeight: 700, fontSize: 17, marginTop: 10 }}>
                {card.t}
              </div>
              <div
                style={{
                  color: "#F8EAD599",
                  fontSize: 14.5,
                  marginTop: 7,
                  lineHeight: 1.5,
                }}
              >
                {card.d}
              </div>
            </div>
          ))}
        </div>
        {/* Catering */}
        <div
          className="rise"
          style={{
            marginTop: 70,
            background: "#2F7D4F1f",
            border: "1px solid #2F7D4F55",
            borderRadius: 22,
            padding: "38px 34px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
            animationDelay: ".45s",
          }}
        >
          <div style={{ flex: 1, minWidth: 260 }}>
            <p style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: "#2F7D4F", fontWeight: 700, margin: 0 }}>
              Catering
            </p>
            <h2 className="font-display" style={{ fontSize: 30, fontWeight: 900, margin: "8px 0 0", lineHeight: 1.15 }}>
              Bring the oven to your event.
            </h2>
            <p style={{ marginTop: 10, fontSize: 15.5, lineHeight: 1.55, color: "#F8EAD5bb", margin: "10px 0 0" }}>
              Birthdays, block parties, weddings, corporate gatherings — fresh
              Neapolitan pizza fired on site. Tell us about your event.
            </p>
          </div>
          <a
            href="/catering"
            className="am-btn"
            style={{
              background: "#2F7D4F",
              color: "#F8EAD5",
              borderRadius: 100,
              padding: "16px 32px",
              fontSize: 16,
              fontWeight: 700,
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            Plan your event →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          position: "relative",
          borderTop: "1px solid #F8EAD514",
          padding: "22px 7vw",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <LogoLockup />
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <a href="/privacy" style={{ fontSize: 13, color: "#F8EAD533", textDecoration: "none" }}>Privacy Policy</a>
            <a href="/terms" style={{ fontSize: 13, color: "#F8EAD533", textDecoration: "none" }}>Terms</a>
            <p style={{ fontSize: 13, color: "#F8EAD533", margin: 0 }}>Ashburn Farm, VA</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
