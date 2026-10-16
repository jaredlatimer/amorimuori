import Image from "next/image";
import { getAvailability, type AvailabilityData } from "@/lib/availability";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { dateParts, formatPickupWindow, type CalendarNight } from "@/lib/calendar";
import { featuredNightStatus, getUpcomingNights, isSoldOut, nightPill } from "@/lib/night-status";
import { todayET } from "@/lib/service-nights";
import { EVENT_PACKAGES, money } from "@/lib/event-packages";
import { FAMILY_BUNDLE } from "@/lib/family-bundle";
import type { Pizza, PizzaCategory } from "@/lib/types";
import { LogoLockup } from "@/components/ui/Logo";
import { StatusPill } from "@/components/ui/StatusPill";
import { RemindForm } from "./calendar/RemindForm";

export const dynamic = "force-dynamic";

const CREAM = "#F8EAD5";
const INK = "#2C2F33";
const INK_SOFT = "#5E5A52";
const BASIL = "#2F7D4F";
const GOLD = "#E8C24A";

type MenuPizza = Pick<Pizza, "id" | "name" | "description" | "category" | "price_cents" | "sort_order" | "image_url">;

// A failed query (or no database at all) shouldn't take the homepage down.
async function safe<T>(load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch (err) {
    console.error("[home] data load failed", err);
    return fallback;
  }
}

const NO_AVAILABILITY: AvailabilityData = {
  isOpen: false,
  serviceNight: null,
  nextOpenAt: null,
  pizzaAvailability: {},
  poolRemaining: 0,
};

// Same menu the order page shows: active pizzas, reds before whites, in menu order.
async function getMenu(): Promise<MenuPizza[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pizzas")
    .select("id, name, description, category, price_cents, sort_order, image_url")
    .eq("is_active", true)
    .order("category")
    .order("sort_order");
  const pizzas = (data ?? []) as MenuPizza[];
  const CATEGORY_ORDER: PizzaCategory[] = ["Pizze Rosse", "Pizze Bianche"];
  const rank = (c: PizzaCategory) => {
    const i = CATEGORY_ORDER.indexOf(c);
    return i === -1 ? CATEGORY_ORDER.length : i;
  };
  return [...pizzas].sort((a, b) => rank(a.category) - rank(b.category) || a.sort_order - b.sort_order);
}

// Global pickup hours, for the structured data when no night is scheduled.
async function getSettingsHours(): Promise<{ service_start: string; last_pickup: string } | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase.from("settings").select("service_start, last_pickup").single();
  return (data as { service_start: string; last_pickup: string } | null) ?? null;
}

// Photos in public/pizzas, keyed by the pizza's name without spaces, accents or "e"
const PIZZA_PHOTOS: Record<string, string> = {
  margherita: "/pizzas/margherita.png",
  diavola: "/pizzas/diavola.png",
  primavera: "/pizzas/primavera.png",
  salsiccefriarielli: "/pizzas/salsicceFriarielli.png",
};

function photoKey(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && w !== "e")
    .join("");
}

const isGlutenFree = (name: string) => /gluten[\s-]*free/i.test(name);
const hasPesto = (name: string) => /pesto/i.test(name);

function dollars(cents: number) {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

const NUMBER_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];

// "17:30:00" → "17:30"
const hhmm = (t: string) => t.slice(0, 5);

const STEPS = [
  {
    k: "01",
    t: "Order Wednesday",
    d: "Ordering opens the Wednesday before each service night. We email you when it does.",
  },
  {
    k: "02",
    t: "Pick your window",
    d: "Choose the soonest slot or schedule a later pickup that suits your evening.",
  },
  {
    k: "03",
    t: "Pay and get the address",
    d: "Pay by card. Your Ashburn Farm pickup spot is revealed the moment payment clears.",
  },
];

const eyebrow: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 2,
  textTransform: "uppercase",
  margin: 0,
};

const h2: React.CSSProperties = {
  fontSize: "clamp(26px, 3.4vw, 32px)",
  fontWeight: 900,
  lineHeight: 1.15,
  margin: "6px 0 0",
};

const sectionLink: React.CSSProperties = {
  color: CREAM,
  fontWeight: 700,
  fontSize: 15,
  textDecoration: "none",
  whiteSpace: "nowrap",
};

function shortDate(serviceDate: string) {
  const p = dateParts(serviceDate);
  return `${p.weekday.slice(0, 3)}, ${p.month} ${p.day}`;
}

function NextNightCard({ availability, today }: { availability: AvailabilityData; today: string }) {
  const night = availability.serviceNight;
  const status = featuredNightStatus(availability);

  if (!night || !status) {
    return (
      <section aria-label="Next service" className="home-card rise" style={{ animationDelay: ".15s" }}>
        <p style={{ ...eyebrow, color: BASIL }}>Next Friday Night Take</p>
        <h2 className="font-display" style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.15, margin: 0 }}>
          No dates on the calendar yet
        </h2>
        <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.55, color: INK_SOFT }}>
          We&apos;re setting up the next few Fridays. Leave your email and we&apos;ll let you know when
          ordering opens.
        </p>
        <div className="home-actions">
          <a href="#remind" className="am-btn home-btn home-btn-primary">
            Remind me
          </a>
          <a href="/calendar" className="am-btn home-btn home-btn-ghost">
            All dates
          </a>
        </div>
      </section>
    );
  }

  const soldOut = availability.isOpen && isSoldOut(availability);
  const left = availability.poolRemaining;
  const total = night.nightly_total;
  const pct = total > 0 ? Math.max(0, Math.min(100, (left / total) * 100)) : 0;

  return (
    <section aria-label="Next service" className="home-card rise" style={{ animationDelay: ".15s" }}>
      <p style={{ ...eyebrow, color: BASIL }}>{night.service_date === today ? "Tonight" : "Next Friday Night Take"}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <b className="font-display" style={{ fontSize: 44, fontWeight: 900, lineHeight: 1 }}>
          {shortDate(night.service_date)}
        </b>
        <StatusPill {...status} />
      </div>
      <dl className="home-kv">
        <dt>Pickup</dt>
        <dd>{formatPickupWindow(night.service_start, night.last_pickup)}, pick your window</dd>
        <dt>Where</dt>
        <dd>Ashburn Farm. Exact spot sent after you pay.</dd>
        <dt>Pizzas</dt>
        <dd>
          {soldOut
            ? `All ${total} spoken for`
            : availability.isOpen
              ? `${left} of ${total} left`
              : `${total} for the night`}
        </dd>
      </dl>
      {availability.isOpen && (
        <div
          className="home-meter"
          role="meter"
          aria-label="Pizzas left"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={left}
        >
          <i style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="home-actions">
        {night.id !== "dev-mock" && (
          <a href={`/api/calendar/${night.id}`} download className="am-btn home-btn home-btn-primary">
            Add to my calendar
          </a>
        )}
        <a href="/calendar" className="am-btn home-btn home-btn-ghost">
          All dates
        </a>
      </div>
    </section>
  );
}

function PizzaPhoto({ pizza }: { pizza: MenuPizza }) {
  const local = PIZZA_PHOTOS[photoKey(pizza.name)];
  if (local) {
    return (
      <div className="home-pz-pic">
        <Image src={local} alt="" fill sizes="(max-width: 760px) 45vw, 200px" style={{ objectFit: "contain" }} />
      </div>
    );
  }
  if (pizza.image_url) {
    return (
      <div className="home-pz-pic">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pizza.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </div>
    );
  }
  return (
    <div className="home-pz-pic" aria-hidden="true">
      <div className="home-pz-placeholder" />
    </div>
  );
}

function ComingUpRow({ night, availability, now, today }: { night: CalendarNight; availability: AvailabilityData; now: number; today: string }) {
  const p = dateParts(night.service_date);
  const pill = nightPill(night, availability, now);
  return (
    <li className="cal-night" style={{ background: "#3A3E4399", border: "1px solid #F8EAD51a", borderRadius: 16, padding: "14px 18px" }}>
      <div style={{ textAlign: "center" }}>
        <span style={{ fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: GOLD, fontWeight: 700 }}>{p.month}</span>
        <b className="font-display" style={{ display: "block", fontSize: 28, fontWeight: 900, lineHeight: 1 }}>
          {p.day}
        </b>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="font-display" style={{ fontWeight: 700, fontSize: 18 }}>Friday Night Take</div>
        <div style={{ fontSize: 14, color: "#F8EAD599", marginTop: 2 }}>
          {night.service_date === today ? "Tonight. " : `${p.weekday}. `}
          Pickup {formatPickupWindow(night.service_start, night.last_pickup)}
        </div>
      </div>
      <div className="cal-night-pill">
        <StatusPill {...pill} />
      </div>
    </li>
  );
}

export default async function Home() {
  const [availability, upcoming, menu, settingsHours] = await Promise.all([
    safe(getAvailability, NO_AVAILABILITY),
    safe(() => getUpcomingNights(3), [] as CalendarNight[]),
    safe(getMenu, [] as MenuPizza[]),
    safe(getSettingsHours, null),
  ]);
  const now = Date.now();
  const today = todayET();
  const isOpen = availability.isOpen;
  const soldOut = isOpen && isSoldOut(availability);
  const openDayName = availability.nextOpenAt
    ? new Date(availability.nextOpenAt).toLocaleDateString("en-US", { weekday: "long", timeZone: "America/New_York" })
    : "Wednesday";

  const menuHeading =
    menu.length > 0 ? `${NUMBER_WORDS[menu.length] ?? menu.length} pizza${menu.length === 1 ? "" : "s"}, fired to order` : "The menu";

  const hours = availability.serviceNight ?? settingsHours;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FoodEstablishment",
    name: "Amori Muori",
    url: "https://amorimuori.com",
    description: "Authentic Neapolitan pizza, made to order every Friday in Ashburn Farm, VA. 900° wood-fired oven, 60-second bake.",
    servesCuisine: "Neapolitan Pizza",
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      streetAddress: "42852 Crossbow Ct",
      addressLocality: "Ashburn",
      addressRegion: "VA",
      postalCode: "20147",
      addressCountry: "US",
    },
    areaServed: {
      "@type": "City",
      name: "Ashburn, VA",
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "Friday",
      opens: hours ? hhmm(hours.service_start) : "17:30",
      closes: hours ? hhmm(hours.last_pickup) : "21:00",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div
        style={{
          minHeight: "100vh",
          background: "#484D52",
          position: "relative",
          overflow: "hidden",
          fontFamily: "var(--font-archivo), sans-serif",
          color: CREAM,
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

        <div className="home-wrap">
          {/* Nav */}
          <header className="home-nav">
            <a href="/" aria-label="Amori Muori home" style={{ textDecoration: "none" }}>
              <LogoLockup />
            </a>
            <nav aria-label="Site" className="home-nav-links">
              <a href="/order">Order</a>
              <a href="/calendar">Calendar</a>
              <a href="/events">Events</a>
              <a href="/order" className="am-btn home-btn home-btn-primary home-nav-cta">
                {isOpen ? "Order now" : `Opens ${openDayName}`}
              </a>
            </nav>
          </header>

          <main>
            {/* Hero */}
            <section className="home-hero">
              <div>
                <div
                  className="rise"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 9,
                    background: "#2F7D4F25",
                    border: "1px solid #2F7D4F66",
                    color: CREAM,
                    padding: "7px 15px",
                    borderRadius: 100,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: BASIL, display: "inline-block", flexShrink: 0 }} />
                  Friday Night Take · Ashburn Farm, VA
                </div>

                <h1
                  className="font-display rise"
                  style={{
                    fontSize: "clamp(40px, 6.4vw, 72px)",
                    fontWeight: 900,
                    lineHeight: 0.98,
                    letterSpacing: -1,
                    margin: "22px 0 0",
                    animationDelay: ".05s",
                  }}
                >
                  Authentic Neapolitan pizza,{" "}
                  <span style={{ fontStyle: "italic", color: "#FFF0DA" }}>made for Fridays.</span>
                </h1>

                <p
                  className="rise"
                  style={{
                    margin: "22px 0 0",
                    maxWidth: 540,
                    fontSize: 18,
                    lineHeight: 1.55,
                    color: "#F8EAD5cc",
                    animationDelay: ".1s",
                  }}
                >
                  Fired at 900°, 60-second bake, made fresh in{" "}
                  <strong style={{ color: CREAM }}>Ashburn Farm</strong>. Pre-order online, pick a pickup time,
                  and we&apos;ll have it ready. We also bring the oven to your party.
                </p>

                <div className="home-actions rise" style={{ marginTop: 30, animationDelay: ".14s" }}>
                  {isOpen && !soldOut ? (
                    <a href="/order" className="am-btn home-btn home-btn-primary home-btn-lg">
                      Order now
                    </a>
                  ) : (
                    <a href="#remind" className="am-btn home-btn home-btn-primary home-btn-lg">
                      Remind me
                    </a>
                  )}
                  <a href="#menu" className="am-btn home-btn home-btn-outline home-btn-lg">
                    See the menu
                  </a>
                </div>
              </div>

              <NextNightCard availability={availability} today={today} />
            </section>

            {/* Menu */}
            <section id="menu" aria-label="Menu" className="home-sec">
              <div className="home-sec-head">
                <div>
                  <p style={{ ...eyebrow, color: GOLD }}>On the menu</p>
                  <h2 className="font-display" style={h2}>
                    {menuHeading}
                  </h2>
                </div>
                <a href="/order" style={sectionLink}>
                  Order →
                </a>
              </div>

              {menu.length > 0 ? (
                <ul className="home-menu">
                  {menu.map((pizza) => (
                    <li key={pizza.id} className="home-pz">
                      <PizzaPhoto pizza={pizza} />
                      <b className="font-display" style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>
                        {pizza.name}
                      </b>
                      <span style={{ fontWeight: 700, color: GOLD }}>{dollars(pizza.price_cents)}</span>
                      {pizza.description && <p>{pizza.description}</p>}
                      {isGlutenFree(pizza.name) && <p className="home-pz-flag">Bakes in a separate oven.</p>}
                      {hasPesto(pizza.name) && <p className="home-pz-flag">Pesto contains pine nuts.</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ fontSize: 15, color: "#F8EAD599", margin: 0 }}>
                  The menu is on the <a href="/order" style={{ color: CREAM }}>order page</a>.
                </p>
              )}

              <p className="home-note">
                {`Order ${FAMILY_BUNDLE.minPizzas} or more pizzas and get ${dollars(FAMILY_BUNDLE.discountCents)} off. `}
                Share your code after you order: on a friend&apos;s first order of two pizzas, the cheaper one is free.
                When they pick up, you get the same deal on your next order.
              </p>
            </section>

            {/* How it works */}
            <section aria-label="How Friday works" className="home-sec">
              <div className="home-sec-head">
                <div>
                  <p style={{ ...eyebrow, color: GOLD }}>How Friday works</p>
                  <h2 className="font-display" style={h2}>
                    Three steps, no lines
                  </h2>
                </div>
              </div>
              <div className="home-three">
                {STEPS.map((s) => (
                  <div
                    key={s.k}
                    style={{ background: "#3A3E4399", border: "1px solid #F8EAD51a", borderRadius: 18, padding: "22px 22px" }}
                  >
                    <div className="font-display" style={{ fontSize: 30, color: BASIL, fontWeight: 900, lineHeight: 1 }}>
                      {s.k}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 17, marginTop: 10 }}>{s.t}</div>
                    <div style={{ color: "#F8EAD599", fontSize: 14.5, marginTop: 6, lineHeight: 1.5 }}>{s.d}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Coming up + Events */}
            <div className="home-sec home-split">
              <section aria-label="Coming up">
                <div className="home-sec-head">
                  <div>
                    <p style={{ ...eyebrow, color: GOLD }}>Calendar</p>
                    <h2 className="font-display" style={h2}>
                      Coming up
                    </h2>
                  </div>
                  <a href="/calendar" style={sectionLink}>
                    Full calendar →
                  </a>
                </div>
                {upcoming.length === 0 ? (
                  <p style={{ fontSize: 15, color: "#F8EAD599", margin: 0 }}>
                    Nothing scheduled yet. <a href="#remind" style={{ color: CREAM }}>Get a reminder</a> when the next Friday is set.
                  </p>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
                    {upcoming.map((n) => (
                      <ComingUpRow key={n.id} night={n} availability={availability} now={now} today={today} />
                    ))}
                  </ul>
                )}
              </section>

              <section aria-label="Events" className="home-card">
                <p style={{ ...eyebrow, color: BASIL }}>Events</p>
                <h2 className="font-display" style={{ ...h2, margin: 0, color: INK }}>
                  Bring the oven to your party.
                </h2>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: INK_SOFT }}>
                  We set up our canopy and oven, cook in front of your guests, and clean up after. Gluten free on
                  request.
                </p>
                <ul className="home-mini-pk">
                  {EVENT_PACKAGES.map((pkg) => (
                    <li key={pkg.id}>
                      <b className="font-display">{pkg.name}</b>
                      <span>
                        {money(pkg.perGuest)} per guest
                        {pkg.priceNote ? `, ${pkg.priceNote.toLowerCase()}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                <div>
                  <a href="/events" className="am-btn home-btn home-btn-primary">
                    Plan your event
                  </a>
                </div>
              </section>
            </div>

            {/* Reminder band */}
            <section id="remind" aria-label="Get reminders" className="home-band">
              <div>
                <h2 className="font-display" style={{ ...h2, margin: 0 }}>
                  Never miss a Friday
                </h2>
                <p style={{ margin: "8px 0 0", color: "#F8EAD5cc", fontSize: 15.5, lineHeight: 1.55 }}>
                  One email the Wednesday before each service night. Nothing else.
                </p>
              </div>
              <div style={{ minWidth: 0 }}>
                <RemindForm />
              </div>
            </section>
          </main>

          {/* Footer */}
          <footer className="home-foot">
            <span>Amori Muori · Ashburn Farm, VA</span>
            <nav aria-label="Footer" className="home-foot-links">
              <a href="/calendar">Calendar</a>
              <a href="/events">Events</a>
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
            </nav>
          </footer>
        </div>
      </div>
    </>
  );
}
