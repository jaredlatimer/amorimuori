"use client";

import { useEffect, useState } from "react";
import {
  EVENT_KINDS,
  EVENT_PACKAGES,
  GLUTEN_FREE_EXTRA,
  PACKAGE_NOT_SURE,
  STANDARD_MINIMUM,
  estimateEvent,
  explainEstimate,
  findPackage,
  money,
  type EventPackageId,
} from "@/lib/event-packages";

const SLIDER_MIN = 15;
const SLIDER_MAX = 150;

const STEPS = [
  { title: "Tell us the basics", body: "Date, guest count and where." },
  { title: "Get a proposal", body: "Within 24 hours, with your menu." },
  { title: "Hold the date", body: "A 50% deposit locks it in." },
  { title: "We cook", body: "Pizza fired in front of your guests, and we leave it clean." },
];

const celebrazione = findPackage("celebrazione")!;

function todayET() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

/** Packages, the guest-count estimator, the booking steps and the request form. */
export function EventPlanner() {
  const [guests, setGuests] = useState(50);
  const [shown, setShown] = useState<EventPackageId>("amori");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [eventType, setEventType] = useState<string>(EVENT_KINDS[0]);
  const [pkg, setPkg] = useState<string>(PACKAGE_NOT_SURE);
  const [location, setLocation] = useState("");
  const [dietary, setDietary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const shownPkg = findPackage(shown)!;

  // The page is prerendered, so work out "today" in the browser, not at build time
  const [minDate, setMinDate] = useState<string>();
  useEffect(() => setMinDate(todayET()), []);

  function pickPackage(id: EventPackageId) {
    setPkg(id);
    setShown(id);
    document.getElementById("book")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function slide(n: number) {
    setGuests(n);
    setGuestCount(String(n));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Quick checks here; the server checks everything again
    if (!name.trim()) return setError("Please add your name.");
    if (!email.includes("@")) return setError("Please check your email address.");
    if (!eventDate) return setError("Please pick an event date.");
    if (!(parseInt(guestCount) > 0)) return setError("Please add your guest count.");
    if (!location.trim()) return setError("Please tell us where the event is.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/catering-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone: phone || undefined,
          eventDate,
          guestCount: parseInt(guestCount),
          eventType,
          package: pkg,
          location,
          dietaryNotes: dietary || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="ev-packages">
        {EVENT_PACKAGES.map((p) => {
          const premier = p.id === "celebrazione";
          const featured = p.id === "amori";
          return (
            <section key={p.id} className={`ev-card ev-pkg${featured ? " featured" : ""}${premier ? " premier" : ""}`}>
              {p.tag && (
                <span
                  className="ev-tag"
                  style={premier ? { background: "#60403F", color: "#F8EAD5" } : { background: "#E8C24A", color: "#2C2F33" }}
                >
                  {p.tag}
                </span>
              )}
              <span className="ev-eyebrow" style={{ color: premier ? "#60403F" : "#2F7D4F" }}>
                {p.name}
              </span>
              <div className="font-display" style={{ fontSize: 40, fontWeight: 900, lineHeight: 1 }}>
                {money(p.perGuest)}{" "}
                <small style={{ fontFamily: "var(--font-archivo), sans-serif", fontSize: 15, fontWeight: 500, color: "#5E5A52" }}>
                  per guest
                </small>
              </div>
              {p.priceNote && <p style={{ margin: "-4px 0 0", fontSize: 13, color: "#5E5A52" }}>{p.priceNote}</p>}
              <ul>
                {p.includes.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p style={{ margin: 0, fontSize: 13, color: "#5E5A52" }}>{money(p.minimum)} minimum</p>
              <button type="button" className={`am-btn ev-pick${pkg === p.id ? " on" : ""}`} onClick={() => pickPackage(p.id)}>
                {pkg === p.id ? "Picked" : `Pick ${p.name}`}
              </button>
            </section>
          );
        })}
      </div>

      <section className="ev-est">
        <div>
          <h2 className="font-display" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.15, margin: "0 0 8px" }}>
            What would my party cost?
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.55, color: "#F8EAD5e6", margin: "0 0 18px" }}>
            Move the slider to your guest count. Every event has a {money(STANDARD_MINIMUM)} minimum
            ({money(celebrazione.minimum)} for Celebrazione), and a 50% deposit holds your date. Gluten
            free pizzas are {money(GLUTEN_FREE_EXTRA)} each extra, baked in their own separate oven.
          </p>
          <label htmlFor="ev-guests" style={{ display: "block", fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
            Guests: <span style={{ fontVariantNumeric: "tabular-nums" }}>{guests}</span>
          </label>
          <input
            id="ev-guests"
            type="range"
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            step={5}
            value={guests}
            onChange={(e) => slide(parseInt(e.target.value))}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#F8EAD599" }}>
            <span>{SLIDER_MIN}</span>
            <span>{SLIDER_MAX}+</span>
          </div>
        </div>

        <div className="ev-card" aria-live="polite">
          {EVENT_PACKAGES.map((p) => {
            const est = estimateEvent(p, guests);
            return (
              <button
                key={p.id}
                type="button"
                className={`ev-estrow${shown === p.id ? " on" : ""}`}
                onClick={() => setShown(p.id)}
                aria-pressed={shown === p.id}
              >
                <span>
                  {p.name}
                  {p.priceNote ? ` (${p.priceNote.toLowerCase()})` : ""}
                </span>
                <b>{money(est.total)}</b>
              </button>
            );
          })}
          <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.5, color: "#2C2F33" }}>
            <b>How it works out on {shownPkg.name}:</b> {explainEstimate(shownPkg, guests)}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#5E5A52" }}>Tap a package to see its math.</p>
        </div>
      </section>

      <ol className="ev-steps" aria-label="How booking works">
        {STEPS.map((s) => (
          <li key={s.title}>
            <b>{s.title}</b>
            {s.body}
          </li>
        ))}
      </ol>

      <section className="ev-card" id="book" aria-label="Request a date" style={{ marginTop: 44, scrollMarginTop: 24 }}>
        <span className="ev-eyebrow" style={{ color: "#2F7D4F" }}>
          Request a date
        </span>
        <h2 className="font-display" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.15, margin: "6px 0 0" }}>
          Check your date
        </h2>

        {done ? (
          <div style={{ marginTop: 16, background: "#2F7D4F", color: "#F8EAD5", borderRadius: 12, padding: "16px 18px", fontSize: 15, lineHeight: 1.5 }}>
            Thanks, {name.trim().split(" ")[0]}. We got your request and will send a proposal within 24 hours.
          </div>
        ) : (
          <form className="ev-form" onSubmit={submit} noValidate>
            <label>
              Your name
              <input autoComplete="name" autoCapitalize="words" value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              Email
              <input type="email" inputMode="email" autoCapitalize="none" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              Phone (optional)
              <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label>
              Event date
              <input type="date" min={minDate} value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
            </label>
            <label>
              Guests
              <input type="number" inputMode="numeric" min={1} placeholder="e.g. 50" value={guestCount} onChange={(e) => setGuestCount(e.target.value)} required />
            </label>
            <label>
              Kind of event
              <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
                {EVENT_KINDS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
            <label className="full">
              Package
              <select value={pkg} onChange={(e) => setPkg(e.target.value)}>
                <option value={PACKAGE_NOT_SURE}>Not sure yet</option>
                {EVENT_PACKAGES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}, {money(p.perGuest)} per guest
                  </option>
                ))}
              </select>
            </label>
            <label className="full">
              Where is it?
              <input placeholder="Town or venue, e.g. Brambleton" value={location} onChange={(e) => setLocation(e.target.value)} required />
            </label>
            <label className="full">
              Food allergies or dietary needs
              <textarea
                placeholder="e.g. 3 gluten free, 1 nut allergy, 2 vegetarian"
                value={dietary}
                onChange={(e) => setDietary(e.target.value)}
                aria-describedby="ev-diet-note"
              />
            </label>
            <p id="ev-diet-note" className="full" style={{ margin: "-6px 0 0", fontSize: 13, lineHeight: 1.5, color: "#5E5A52" }}>
              {`Gluten free pizzas bake in their own separate oven, for ${money(GLUTEN_FREE_EXTRA)} more per gluten free pizza. `}
              {"Our pesto contains pine nuts. We'll go over every allergy with you before the event."}
            </p>

            {error && (
              <p className="full" role="alert" style={{ margin: 0, fontSize: 14, color: "#60403F", fontWeight: 600 }}>
                {error}
              </p>
            )}

            <div className="full" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="submit"
                disabled={submitting}
                className="am-btn"
                style={{ background: "#2F7D4F", color: "#F8EAD5", borderRadius: 12, padding: "13px 22px", fontSize: 15, opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? "Sending…" : "Send request"}
              </button>
              <span style={{ fontSize: 13, color: "#5E5A52" }}>No payment now. We reply within 24 hours.</span>
            </div>
          </form>
        )}
      </section>
    </>
  );
}
