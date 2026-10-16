"use client";

import { useState, useEffect } from "react";
import { dateParts, formatOpensAt, formatPickupWindow } from "@/lib/calendar";
import type { ActiveServiceNight } from "@/lib/availability";

interface CountdownParts {
  days: number;
  hours: number;
  mins: number;
  secs: number;
  total: number;
}

function useCountdown(targetIso: string): CountdownParts {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const target = new Date(targetIso).getTime();
    const tick = () => setTotal(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  return {
    total,
    days: Math.floor(total / 86400000),
    hours: Math.floor((total % 86400000) / 3600000),
    mins: Math.floor((total % 3600000) / 60000),
    secs: Math.floor((total % 60000) / 1000),
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

interface OrderingClosedProps {
  // Next enabled night whose ordering window hasn't closed; null when none is scheduled
  night: ActiveServiceNight | null;
}

const EMAIL = /^.+@.+\..+$/;

const eyebrow: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: 2,
  textTransform: "uppercase",
  fontWeight: 700,
  margin: 0,
};

const card: React.CSSProperties = {
  marginTop: 30,
  textAlign: "left",
  background: "#3A3E4399",
  border: "1px solid #F8EAD51a",
  borderRadius: 22,
  padding: "22px 22px",
};

export function OrderingClosed({ night }: OrderingClosedProps) {
  const countdown = useCountdown(night?.order_open_at ?? "");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const valid = EMAIL.test(email);
  const parts = night ? dateParts(night.service_date) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    const res = await fetch("/api/reminder-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setState(res.ok ? "done" : "error");
  }

  return (
    <div
      style={{
        padding: "60px 0 90px",
        maxWidth: 600,
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      {/* Oxblood badge */}
      <div
        className="rise"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 9,
          background: "#60403F33",
          border: "1px solid #60403F88",
          color: "#F8EAD5",
          padding: "7px 15px",
          borderRadius: 100,
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 22,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 99,
            background: "#60403F",
            display: "inline-block",
          }}
        />
        Ordering is closed right now
      </div>

      <h2
        className="font-display rise"
        style={{
          fontSize: "clamp(32px, 5.5vw, 46px)",
          fontWeight: 900,
          lineHeight: 1.02,
          letterSpacing: -0.5,
          textWrap: "balance",
          animationDelay: ".05s",
        }}
      >
        {parts ? <>Next pizza night: {parts.long}.</> : "Our next pizza night isn\u2019t set yet."}
      </h2>

      <p
        className="rise"
        style={{
          margin: "14px auto 0",
          maxWidth: 470,
          fontSize: 16.5,
          lineHeight: 1.55,
          color: "#F8EAD5cc",
          animationDelay: ".1s",
        }}
      >
        {night ? (
          <>We don&apos;t bake every Friday, so each night gets its own ordering window. See all upcoming dates on </>
        ) : (
          <>We&apos;re picking the next few Fridays now. Ordering opens the Wednesday before each one, and new dates go up on </>
        )}
        <a href="/calendar" style={{ color: "#F8EAD5", textDecoration: "underline", textUnderlineOffset: 3 }}>
          our calendar
        </a>
        {night ? "." : " first."}
      </p>

      {/* Next night, same treatment as the calendar's featured night */}
      {night && parts && (
        <section
          aria-label="Next Friday Night Take"
          className="cal-next rise"
          style={{
            marginTop: 28,
            textAlign: "left",
            background: "#2F7D4F1f",
            border: "1px solid #2F7D4F55",
            borderRadius: 22,
            padding: 22,
            animationDelay: ".15s",
          }}
        >
          <div className="cal-datebox" style={{ background: "#3A3E43", borderRadius: 16, padding: "14px 10px" }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#E8C24A" }}>
              {parts.month}
            </span>
            <span className="font-display" style={{ fontSize: 44, fontWeight: 900, lineHeight: 1 }}>
              {parts.day}
            </span>
            <span style={{ fontSize: 13, color: "#F8EAD5aa" }}>{parts.weekday}</span>
          </div>

          <div style={{ minWidth: 0, display: "grid", gap: 9 }}>
            <p style={{ ...eyebrow, color: "#2F7D4F" }}>Next Friday Night Take</p>
            <h3 className="font-display" style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.15, margin: 0 }}>
              Pickup {formatPickupWindow(night.service_start, night.last_pickup)}
            </h3>
            <span
              style={{
                justifySelf: "start",
                background: "#E8C24A",
                color: "#3A3E43",
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 100,
                padding: "4px 11px",
              }}
            >
              Orders open {formatOpensAt(night.order_open_at)}
            </span>
            <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "#F8EAD5bb", margin: 0 }}>
              {night.nightly_total} pizzas this night. Ordering stays open until{" "}
              {formatOpensAt(night.order_close_at)} or until we sell out.
            </p>

            <div
              aria-label="Ordering opens in"
              style={{ display: "flex", gap: 16, alignItems: "baseline", flexWrap: "wrap", fontVariantNumeric: "tabular-nums" }}
            >
              <span style={{ ...eyebrow, fontSize: 12, letterSpacing: 1.5, color: "#F8EAD588" }}>Opens in</span>
              {countdown.total > 0 ? (
                [
                  { value: countdown.days, label: "days" },
                  { value: countdown.hours, label: "hrs" },
                  { value: countdown.mins, label: "min" },
                  { value: countdown.secs, label: "sec" },
                ].map(({ value, label }) => (
                  <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <span className="font-display" style={{ fontSize: 30, fontWeight: 900, color: "#2F7D4F", lineHeight: 1 }}>
                      {pad(value)}
                    </span>
                    <span style={{ fontSize: 10.5, letterSpacing: 1.5, textTransform: "uppercase", color: "#F8EAD566" }}>
                      {label}
                    </span>
                  </div>
                ))
              ) : (
                <span className="font-display" style={{ fontSize: 24, fontWeight: 900, color: "#2F7D4F" }}>
                  Opening soon
                </span>
              )}
            </div>

            {night.id !== "dev-mock" && (
              <div style={{ marginTop: 4 }}>
                <a
                  href={`/api/calendar/${night.id}`}
                  download
                  className="am-btn"
                  style={{
                    background: "transparent",
                    color: "#F8EAD5",
                    padding: "12px 22px",
                    borderRadius: 100,
                    fontSize: 15,
                    border: "1.5px solid #F8EAD544",
                  }}
                >
                  Add to my calendar
                </a>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Email reminder capture */}
      <div className="rise" style={{ ...card, animationDelay: ".2s" }}>
        {state === "done" ? (
          <div role="status">
            <div style={{ fontWeight: 700, fontSize: 16 }}>You&apos;re on the list!</div>
            <div style={{ fontSize: 14, color: "#F8EAD5aa", marginTop: 4 }}>
              We&apos;ll email you when ordering opens for our next pizza night.
            </div>
          </div>
        ) : (
          <>
            <p style={{ ...eyebrow, color: "#2F7D4F" }}>Never miss a Friday</p>
            <h3 className="font-display" style={{ fontSize: 21, fontWeight: 900, lineHeight: 1.2, margin: "6px 0 0" }}>
              We&apos;ll tell you when ordering opens.
            </h3>
            <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "#F8EAD5bb", margin: "6px 0 0" }}>
              Drop your email and we&apos;ll send a heads-up when orders open for the next pizza night.
            </p>
            <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <input
                type="email"
                required
                autoComplete="email"
                aria-label="Email address"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "13px 15px",
                  borderRadius: 11,
                  border: "1.5px solid #F8EAD533",
                  fontSize: 16,
                  background: "#3A3E43cc",
                  color: "#F8EAD5",
                  fontFamily: "var(--font-archivo), sans-serif",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={state === "loading" || !valid}
                className="am-btn"
                style={{
                  background: valid ? "#2F7D4F" : "#F8EAD522",
                  color: "#F8EAD5",
                  padding: "0 20px",
                  borderRadius: 11,
                  fontSize: 15,
                  whiteSpace: "nowrap",
                  cursor: valid ? "pointer" : "not-allowed",
                }}
              >
                {state === "loading" ? "\u2026" : "Notify me"}
              </button>
            </form>
            {state === "error" && (
              <p style={{ fontSize: 13, color: "#E8C24A", marginTop: 8 }}>
                We couldn&apos;t save your email. Check it and try again.
              </p>
            )}
          </>
        )}
      </div>

      {/* Private events */}
      <div
        className="rise"
        style={{
          marginTop: 16,
          textAlign: "left",
          display: "flex",
          gap: 16,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          border: "1.5px dashed #E8C24A66",
          borderRadius: 22,
          padding: "20px 22px",
          animationDelay: ".25s",
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 260px" }}>
          <p style={{ ...eyebrow, color: "#E8C24A" }}>Private events</p>
          <h3 className="font-display" style={{ fontSize: 21, fontWeight: 900, lineHeight: 1.2, margin: "6px 0 0" }}>
            {night ? "Can\u2019t wait for a Friday? Bring the oven to your party." : "Hosting something? We\u2019ll bring the pizza to you."}
          </h3>
          <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "#F8EAD5bb", margin: "6px 0 0" }}>
            We set up our tables, canopy and oven, fire pizza for your guests, and clean up after.
            Packages from $22 per guest.
          </p>
        </div>
        <a
          href="/events#book"
          className="am-btn"
          style={{ background: "#E8C24A", color: "#3A3E43", padding: "12px 22px", borderRadius: 100, fontSize: 15 }}
        >
          Check your date
        </a>
      </div>

      {/* Footer links: arrows point outward */}
      <div
        className="rise"
        style={{
          marginTop: 24,
          display: "flex",
          gap: 18,
          justifyContent: "space-between",
          flexWrap: "wrap",
          fontSize: 14.5,
          fontWeight: 600,
          animationDelay: ".3s",
        }}
      >
        <a href="/" style={{ color: "#F8EAD5cc" }}>← Back to home</a>
        <a href="/calendar" style={{ color: "#F8EAD5cc" }}>{night ? "See all dates" : "See the calendar"} →</a>
      </div>
    </div>
  );
}
