import type { Metadata } from "next";
import { getAvailability } from "@/lib/availability";
import { todayET } from "@/lib/service-nights";
import { dateParts, formatOpensAt, formatPickupWindow } from "@/lib/calendar";
import { getUpcomingNights, isSoldOut, nightPill } from "@/lib/night-status";
import { SiteShell } from "@/components/ui/SiteShell";
import { StatusPill as Pill } from "@/components/ui/StatusPill";
import { RemindForm } from "./RemindForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Calendar",
  description: "Upcoming Friday Night Take dates in Ashburn Farm, VA. See when ordering opens and add pickup nights to your calendar.",
  alternates: { canonical: "https://amorimuori.com/calendar" },
};

function AddToCalendar({ nightId, primary = false }: { nightId: string; primary?: boolean }) {
  // The dev mock night has no row to build a file from
  if (nightId === "dev-mock") return null;
  return (
    <a
      href={`/api/calendar/${nightId}`}
      download
      className={primary ? "am-btn" : undefined}
      style={
        primary
          ? {
              background: "transparent",
              color: "#F8EAD5",
              padding: "13px 24px",
              borderRadius: 100,
              fontSize: 15,
              border: "1.5px solid #F8EAD544",
            }
          : { fontSize: 13, fontWeight: 700, color: "#F8EAD5aa", whiteSpace: "nowrap" }
      }
    >
      Add to my calendar
    </a>
  );
}

export default async function CalendarPage() {
  const [availability, nights] = await Promise.all([getAvailability(), getUpcomingNights()]);
  const now = Date.now();
  const today = todayET();
  const next = availability.serviceNight;
  const nextParts = next ? dateParts(next.service_date) : null;
  const soldOut = availability.isOpen && isSoldOut(availability);

  return (
    <SiteShell>
      <main style={{ maxWidth: 1040, margin: "0 auto", padding: "50px 16px 80px" }}>
        <p style={{ fontSize: 13, letterSpacing: 2, textTransform: "uppercase", color: "#F8EAD5aa", margin: 0 }}>
          Calendar
        </p>
        <h1
          className="font-display rise"
          style={{ fontSize: "clamp(36px, 6vw, 56px)", fontWeight: 900, lineHeight: 1.05, margin: "10px 0 0" }}
        >
          Fridays, all winter.
        </h1>
        <p
          className="rise"
          style={{ marginTop: 16, maxWidth: 560, fontSize: 17, lineHeight: 1.6, color: "#F8EAD5cc", animationDelay: ".05s" }}
        >
          Here&apos;s when the oven is lit in Ashburn Farm. Pre-order online, pick a pickup time, and
          we&apos;ll have your pizza ready.
        </p>

        {/* Next night */}
        {next && nextParts ? (
          <section
            aria-label="Next Friday Night Take"
            className="cal-next rise"
            style={{
              marginTop: 34,
              background: "#2F7D4F1f",
              border: "1px solid #2F7D4F55",
              borderRadius: 22,
              padding: "28px 28px",
              animationDelay: ".1s",
            }}
          >
            <div className="cal-datebox" style={{ background: "#3A3E43", borderRadius: 16, padding: "14px 10px" }}>
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#E8C24A" }}>
                {nextParts.month}
              </span>
              <span className="font-display" style={{ fontSize: 48, fontWeight: 900, lineHeight: 1 }}>
                {nextParts.day}
              </span>
              <span style={{ fontSize: 13, color: "#F8EAD5aa" }}>{nextParts.weekday}</span>
            </div>

            <div style={{ minWidth: 0, display: "grid", gap: 10 }}>
              <p style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: "#2F7D4F", fontWeight: 700, margin: 0 }}>
                {next.service_date === today ? "Tonight" : "Next Friday Night Take"}
              </p>
              <h2 className="font-display" style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.15, margin: 0 }}>
                Pickup {formatPickupWindow(next.service_start, next.last_pickup)}
              </h2>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                {soldOut ? (
                  <Pill label="Sold out" tone="out" />
                ) : availability.isOpen ? (
                  <Pill label="Ordering open" tone="open" />
                ) : (
                  <Pill label={`Orders open ${formatOpensAt(next.order_open_at)}`} tone="soon" />
                )}
              </div>
              <p style={{ fontSize: 15, lineHeight: 1.55, color: "#F8EAD5bb", margin: 0 }}>
                {soldOut
                  ? "Every pizza for this night is spoken for. Thank you! Check the dates below for the next one."
                  : availability.isOpen
                    ? `${availability.poolRemaining} of ${next.nightly_total} pizzas left. Orders close ${formatOpensAt(next.order_close_at)}.`
                    : `${next.nightly_total} pizzas this night. Ordering stays open until ${formatOpensAt(next.order_close_at)} or until we sell out.`}
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
                {availability.isOpen && !soldOut && (
                  <a
                    href="/order"
                    className="am-btn"
                    style={{ background: "#F8EAD5", color: "#484D52", padding: "13px 26px", borderRadius: 100, fontSize: 15 }}
                  >
                    Order now →
                  </a>
                )}
                {!availability.isOpen && (
                  <a
                    href="#remind"
                    className="am-btn"
                    style={{ background: "#2F7D4F", color: "#F8EAD5", padding: "13px 26px", borderRadius: 100, fontSize: 15 }}
                  >
                    Remind me
                  </a>
                )}
                <AddToCalendar nightId={next.id} primary />
              </div>
            </div>
          </section>
        ) : (
          <section
            className="rise"
            style={{
              marginTop: 34,
              background: "#3A3E4399",
              border: "1px solid #F8EAD51a",
              borderRadius: 22,
              padding: "28px 28px",
              animationDelay: ".1s",
            }}
          >
            <h2 className="font-display" style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.15, margin: 0 }}>
              No dates on the calendar just yet.
            </h2>
            <p style={{ marginTop: 10, fontSize: 15.5, lineHeight: 1.55, color: "#F8EAD5bb", marginBottom: 0 }}>
              We&apos;re setting up the next few Fridays. Leave your email below and we&apos;ll let you know
              when ordering opens.
            </p>
          </section>
        )}

        <div className="cal-grid" style={{ marginTop: 40 }}>
          {/* Upcoming nights */}
          <section aria-label="Upcoming dates">
            <h2 className="font-display" style={{ fontSize: 26, fontWeight: 900, margin: "0 0 14px" }}>
              Coming up
            </h2>
            {nights.length === 0 ? (
              <p style={{ fontSize: 15, color: "#F8EAD599", margin: 0 }}>Nothing scheduled yet. Check back soon.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
                {nights.map((n) => {
                  const p = dateParts(n.service_date);
                  const pill = nightPill(n, availability, now);
                  return (
                    <li
                      key={n.id}
                      className="cal-night"
                      style={{
                        background: "#3A3E4399",
                        border: "1px solid #F8EAD51a",
                        borderRadius: 16,
                        padding: "14px 18px",
                      }}
                    >
                      <div style={{ textAlign: "center" }}>
                        <span style={{ fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: "#E8C24A", fontWeight: 700 }}>
                          {p.month}
                        </span>
                        <b className="font-display" style={{ display: "block", fontSize: 28, fontWeight: 900, lineHeight: 1 }}>
                          {p.day}
                        </b>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>Friday Night Take</div>
                        <div style={{ fontSize: 14, color: "#F8EAD599", marginTop: 2 }}>
                          {n.service_date === today ? "Tonight. " : `${p.weekday}. `}
                          Pickup {formatPickupWindow(n.service_start, n.last_pickup)}
                        </div>
                        <div style={{ marginTop: 6 }}>
                          <AddToCalendar nightId={n.id} />
                        </div>
                      </div>
                      <div className="cal-night-pill">
                        <Pill {...pill} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Reminder signup */}
          <aside
            id="remind"
            aria-label="Get reminders"
            style={{
              background: "#3A3E4399",
              border: "1px solid #F8EAD51a",
              borderRadius: 22,
              padding: "26px 24px",
              scrollMarginTop: 24,
            }}
          >
            <p style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: "#2F7D4F", fontWeight: 700, margin: 0 }}>
              Never miss a Friday
            </p>
            <h2 className="font-display" style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.2, margin: "8px 0 0" }}>
              We&apos;ll tell you when ordering opens.
            </h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "#F8EAD599", margin: "8px 0 0" }}>
              Drop your email and we&apos;ll send a heads-up when orders open for the next Friday.
            </p>
            <RemindForm />
          </aside>
        </div>
      </main>
    </SiteShell>
  );
}
