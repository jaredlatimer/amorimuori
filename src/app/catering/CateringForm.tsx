"use client";

import { useState } from "react";

const EVENT_TYPES = ["Birthday", "Corporate", "Wedding", "Block party", "Graduation", "Other"];

const inputStyle: React.CSSProperties = {
  padding: "13px 15px",
  borderRadius: 11,
  border: "1.5px solid #F8EAD522",
  fontSize: 15,
  background: "#3A3E43",
  color: "#F8EAD5",
  fontFamily: "var(--font-archivo), sans-serif",
  width: "100%",
  outline: "none",
  boxSizing: "border-box",
  WebkitAppearance: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: "#F8EAD577",
  marginBottom: 7,
};

export function CateringForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [eventType, setEventType] = useState("");
  const [servingWindow, setServingWindow] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit =
    name.trim().length > 0 &&
    email.includes("@") &&
    phone.trim().length > 0 &&
    eventDate.length > 0 &&
    location.trim().length > 0 &&
    parseInt(guestCount) > 0 &&
    eventType.length > 0 &&
    !submitting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/catering-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, email, phone, eventDate, location,
          guestCount: parseInt(guestCount),
          eventType,
          servingWindow: servingWindow || undefined,
          notes: notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div
        style={{
          marginTop: 40,
          background: "#2F7D4F22",
          border: "1px solid #2F7D4F55",
          borderRadius: 20,
          padding: "40px 28px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 12 }}>🍕</div>
        <h2 className="font-display" style={{ fontSize: 26, fontWeight: 900, margin: "0 0 10px", color: "#F8EAD5" }}>
          Got it — we&apos;ll be in touch.
        </h2>
        <p style={{ fontSize: 15, color: "#F8EAD5aa", margin: 0, lineHeight: 1.6 }}>
          Thanks, {name.split(" ")[0]}. We&apos;ll review the details and reach out
          within a couple of days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 36, display: "grid", gap: 18 }}>
      <div>
        <label style={labelStyle}>Your name *</label>
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} autoCapitalize="words" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>Email *</label>
          <input style={inputStyle} type="email" inputMode="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Phone *</label>
          <input style={inputStyle} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>Event date *</label>
          <input style={inputStyle} type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Guest count *</label>
          <input style={inputStyle} type="number" inputMode="numeric" min="1" placeholder="e.g. 40" value={guestCount} onChange={(e) => setGuestCount(e.target.value)} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Event location *</label>
        <input style={inputStyle} placeholder="City or neighborhood" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>

      <div>
        <label style={labelStyle}>Event type *</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {EVENT_TYPES.map((t) => {
            const active = eventType === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setEventType(t)}
                style={{
                  background: active ? "#2F7D4F" : "transparent",
                  color: "#F8EAD5",
                  border: `1.5px solid ${active ? "#2F7D4F" : "#F8EAD533"}`,
                  borderRadius: 100,
                  padding: "9px 16px",
                  fontSize: 14,
                  fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                  fontFamily: "var(--font-archivo), sans-serif",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Serving window (optional)</label>
        <input style={inputStyle} placeholder="e.g. 5–8 PM" value={servingWindow} onChange={(e) => setServingWindow(e.target.value)} />
      </div>

      <div>
        <label style={labelStyle}>Anything else? (optional)</label>
        <textarea
          style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
          placeholder="Dietary needs, venue details, questions…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && (
        <p style={{ fontSize: 14, color: "#E05555", margin: 0, lineHeight: 1.4 }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="am-btn"
        style={{
          background: canSubmit ? "#2F7D4F" : "#2F7D4F44",
          color: "#F8EAD5",
          border: "none",
          borderRadius: 14,
          padding: "17px",
          fontSize: 17,
          fontWeight: 700,
          cursor: canSubmit ? "pointer" : "not-allowed",
          fontFamily: "var(--font-archivo), sans-serif",
          marginTop: 6,
        }}
      >
        {submitting ? "Sending…" : "Send inquiry"}
      </button>
    </form>
  );
}
