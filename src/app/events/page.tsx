import type { Metadata } from "next";
import { SiteShell } from "@/components/ui/SiteShell";
import { EventPlanner } from "./EventPlanner";

export const metadata: Metadata = {
  title: "Private Events — Amori Muori",
  description:
    "Neapolitan pizza cooked in front of your guests. We set up tables, a canopy and the oven, then clean up after. Packages from $22 per guest in Northern Virginia.",
};

const FACTS = [
  { big: "90 sec", small: "per pizza in the oven" },
  { big: "5", small: "pizzas on the menu, gluten free included" },
  { big: "24 hr", small: "to get your proposal" },
];

export default function EventsPage() {
  return (
    <SiteShell>
      <main className="ev-wrap">
        <div className="ev-hero rise">
          <div>
            <p className="ev-eyebrow" style={{ color: "#E8C24A", margin: 0 }}>
              Private events
            </p>
            <h1
              className="font-display"
              style={{ fontSize: "clamp(34px, 6vw, 56px)", fontWeight: 900, lineHeight: 1.05, margin: "12px 0 14px" }}
            >
              Bring the oven to your party.
            </h1>
            <p style={{ maxWidth: "60ch", fontSize: 18, lineHeight: 1.55, color: "#F8EAD5e6", margin: "0 0 26px" }}>
              We set up our tables, canopy and oven, fire Neapolitan pizza in front of your
              guests, and clean up after. You get to enjoy your own event.
            </p>
            <a
              href="#book"
              className="am-btn"
              style={{ background: "#2F7D4F", color: "#F8EAD5", borderRadius: 100, padding: "14px 28px", fontSize: 16 }}
            >
              Check your date
            </a>
          </div>
          <div className="ev-facts">
            {FACTS.map((f) => (
              <div key={f.big} className="ev-fact">
                <b>{f.big}</b>
                <span>{f.small}</span>
              </div>
            ))}
          </div>
        </div>

        <EventPlanner />
      </main>
    </SiteShell>
  );
}
