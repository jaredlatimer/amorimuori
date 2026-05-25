"use client";

import { useState, useEffect } from "react";

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
  nextOpenAt: string | null;
}

export function OrderingClosed({ nextOpenAt }: OrderingClosedProps) {
  const countdown = useCountdown(nextOpenAt ?? "");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );

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

  const openDate = nextOpenAt
    ? new Date(nextOpenAt).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: "America/New_York",
      })
    : null;

  return (
    <div
      style={{
        padding: "70px 0 90px",
        maxWidth: 560,
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
          marginBottom: 26,
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
          fontSize: "clamp(34px, 6vw, 52px)",
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: -0.5,
          animationDelay: ".05s",
        }}
      >
        We open Wednesday.
      </h2>

      <p
        className="rise"
        style={{
          marginTop: 18,
          fontSize: 17,
          lineHeight: 1.55,
          color: "#F8EAD5cc",
          animationDelay: ".1s",
        }}
      >
        Friday Night Take orders open every{" "}
        <strong style={{ color: "#F8EAD5" }}>Wednesday at 12:00 AM</strong> and
        close{" "}
        <strong style={{ color: "#F8EAD5" }}>Friday at 8:40 PM</strong>. Check
        back then to reserve your pickup window.
      </p>

      {/* Countdown card */}
      {nextOpenAt && (
        <div
          className="rise"
          style={{
            marginTop: 30,
            display: "inline-flex",
            flexDirection: "column",
            gap: 4,
            background: "#3A3E4399",
            border: "1px solid #F8EAD51a",
            borderRadius: 18,
            padding: "22px 34px",
            animationDelay: ".15s",
          }}
        >
          <span
            style={{
              fontSize: 12,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "#F8EAD588",
              fontWeight: 700,
            }}
          >
            Ordering opens in
          </span>

          {countdown.total > 0 ? (
            <div style={{ display: "flex", gap: 18, justifyContent: "center" }}>
              {[
                { value: countdown.days, label: "days" },
                { value: countdown.hours, label: "hrs" },
                { value: countdown.mins, label: "min" },
                { value: countdown.secs, label: "sec" },
              ].map(({ value, label }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <span
                    className="font-display"
                    style={{
                      fontSize: 40,
                      fontWeight: 900,
                      color: "#2F7D4F",
                      lineHeight: 1,
                    }}
                  >
                    {pad(value)}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      color: "#F8EAD566",
                    }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <span
              className="font-display"
              style={{ fontSize: 40, fontWeight: 900, color: "#2F7D4F", lineHeight: 1 }}
            >
              Opening soon
            </span>
          )}

          {openDate && (
            <span style={{ fontSize: 13, color: "#F8EAD599", marginTop: 4 }}>
              {openDate}
            </span>
          )}
        </div>
      )}

      {/* Email reminder capture */}
      <div
        className="rise"
        style={{
          marginTop: 34,
          maxWidth: 420,
          marginLeft: "auto",
          marginRight: "auto",
          animationDelay: ".2s",
        }}
      >
        {state === "done" ? (
          <div
            style={{
              background: "#2F7D4F1f",
              border: "1px solid #2F7D4F",
              borderRadius: 16,
              padding: "20px 22px",
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 6 }}>✓</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              You&apos;re on the list!
            </div>
            <div
              style={{ fontSize: 14, color: "#F8EAD5aa", marginTop: 4 }}
            >
              We&apos;ll email you Wednesday when ordering opens.
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
              Want a heads-up?
            </div>
            <div
              style={{
                fontSize: 14,
                color: "#F8EAD5aa",
                marginBottom: 14,
              }}
            >
              Drop your email and we&apos;ll remind you the moment ordering
              opens Wednesday.
            </div>
            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", gap: 8 }}
            >
              <input
                type="email"
                required
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "13px 15px",
                  borderRadius: 11,
                  border: "1.5px solid #F8EAD533",
                  fontSize: 15,
                  background: "#3A3E43cc",
                  color: "#F8EAD5",
                  fontFamily: "var(--font-archivo), sans-serif",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={state === "loading" || !/^.+@.+\..+$/.test(email)}
                className="am-btn"
                style={{
                  background:
                    /^.+@.+\..+$/.test(email)
                      ? "#2F7D4F"
                      : "#F8EAD522",
                  color: "#F8EAD5",
                  padding: "0 22px",
                  borderRadius: 11,
                  fontSize: 15,
                  whiteSpace: "nowrap",
                  cursor: /^.+@.+\..+$/.test(email) ? "pointer" : "not-allowed",
                }}
              >
                {state === "loading" ? "…" : "Notify me"}
              </button>
            </form>
            {state === "error" && (
              <p
                style={{ fontSize: 13, color: "#60403F", marginTop: 8 }}
              >
                Something went wrong — try again.
              </p>
            )}
          </>
        )}
      </div>

      {/* Back to home */}
      <div
        className="rise"
        style={{ marginTop: 26, animationDelay: ".25s" }}
      >
        <a
          href="/"
          className="am-btn"
          style={{
            background: "transparent",
            color: "#F8EAD5",
            padding: "13px 26px",
            borderRadius: 100,
            fontSize: 15,
            border: "1.5px solid #F8EAD544",
          }}
        >
          ← Back to home
        </a>
      </div>
    </div>
  );
}
