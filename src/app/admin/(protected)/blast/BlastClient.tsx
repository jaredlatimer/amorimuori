"use client";

import { useState } from "react";

interface CurrentOrderRecipient {
  customer_name: string;
  customer_email: string;
  code: string;
  pickup_at: string;
}

interface Props {
  pastRecipients: string[];
  currentNight: { serviceDate: string; recipients: CurrentOrderRecipient[] } | null;
}

const inputStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #F8EAD520",
  background: "#3A3E43",
  color: "#F8EAD5",
  fontSize: 15,
  fontFamily: "var(--font-archivo), sans-serif",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#F8EAD577",
  letterSpacing: 0.8,
  textTransform: "uppercase",
  marginBottom: 6,
  display: "block",
};

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  });
}

export function BlastClient({ pastRecipients, currentNight }: Props) {
  const [audience, setAudience] = useState<"past" | "current_orders">("current_orders");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [step, setStep] = useState<"compose" | "confirm" | "sending" | "done">("compose");
  const [sentCount, setSentCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isTest, setIsTest] = useState(false);

  const currentRecipients = currentNight?.recipients ?? [];
  const recipientCount = audience === "current_orders" ? currentRecipients.length : pastRecipients.length;
  const canSend = subject.trim().length > 0 && body.trim().length > 0 && (isTest || recipientCount > 0);

  const previewRecipient = currentRecipients[0];
  const formattedEventDate = eventDate
    ? new Date(eventDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : null;

  async function send() {
    setStep("sending");
    setError(null);
    try {
      const res = await fetch("/api/admin/send-blast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          body,
          audience,
          test: isTest || undefined,
          eventDate: audience === "past" ? (eventDate || undefined) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unknown error");
      setSentCount(json.sent);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
      setStep("confirm");
    }
  }

  if (step === "done") {
    return (
      <div style={{ paddingTop: 32, maxWidth: 600 }}>
        <div style={{ background: "#2F7D4F22", border: "1px solid #2F7D4F44", borderRadius: 16, padding: "32px 28px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
          <h2 className="font-display" style={{ fontSize: 24, fontWeight: 900, margin: "0 0 8px", color: "#F8EAD5" }}>
            {isTest ? "Test sent" : "Blast sent"}
          </h2>
          <p style={{ fontSize: 15, color: "#F8EAD5aa", margin: "0 0 24px" }}>
            {isTest ? "Delivered to jared@latimerart.design." : `Delivered to ${sentCount} customer${sentCount !== 1 ? "s" : ""}.`}
          </p>
          <button
            onClick={() => { setSubject(""); setBody(""); setEventDate(""); setStep("compose"); }}
            style={{ background: "transparent", border: "1px solid #F8EAD520", color: "#F8EAD5aa", borderRadius: 10, padding: "10px 22px", fontSize: 14, cursor: "pointer", fontFamily: "var(--font-archivo), sans-serif" }}
          >
            {isTest ? "Try another" : "Send another"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 32, maxWidth: 600 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>Blast</h1>
        <div style={{ display: "flex", background: "#3A3E43", borderRadius: 10, padding: 3, gap: 2 }}>
          {([
            { value: false, label: "Live" },
            { value: true, label: "Send Test" },
          ] as const).map(({ value, label }) => {
            const active = isTest === value;
            return (
              <button
                key={String(value)}
                onClick={() => setIsTest(value)}
                style={{
                  padding: "7px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: active ? (value ? "#C9A227" : "#484D52") : "transparent",
                  color: active ? (value ? "#22252a" : "#F8EAD5") : "#F8EAD555",
                  fontSize: 13, fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "var(--font-archivo), sans-serif",
                  transition: "background 0.15s",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {isTest && (
        <div style={{ marginBottom: 24, background: "#C9A22718", border: "1px solid #C9A22744", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "#C9A227", fontWeight: 700 }}>Test mode</span>
          <span style={{ fontSize: 13, color: "#F8EAD5aa" }}>Sending only to Jared Latimer · jared@latimerart.design</span>
        </div>
      )}

      {/* Audience toggle */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Audience</label>
        <div style={{ display: "flex", gap: 8 }}>
          {([
            { value: "current_orders", label: "Tonight's orders", count: currentRecipients.length, disabled: !currentNight },
            { value: "past", label: "Past customers", count: pastRecipients.length, disabled: false },
          ] as const).map(({ value, label, count, disabled }) => {
            const active = audience === value;
            const isDisabled = disabled || isTest;
            return (
              <button
                key={value}
                onClick={() => !isDisabled && setAudience(value)}
                disabled={isDisabled}
                style={{
                  flex: 1,
                  padding: "11px 14px",
                  borderRadius: 10,
                  border: `1px solid ${active && !isTest ? "#2F7D4F" : "#F8EAD520"}`,
                  background: active && !isTest ? "#2F7D4F22" : "transparent",
                  color: isDisabled ? "#F8EAD533" : active ? "#2F7D4F" : "#F8EAD5aa",
                  fontSize: 14, fontWeight: 700,
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-archivo), sans-serif",
                  textAlign: "left",
                }}
              >
                {label}
                <span style={{ display: "block", fontSize: 12, fontWeight: 400, marginTop: 2, color: isDisabled ? "#F8EAD522" : active ? "#2F7D4Faa" : "#F8EAD544" }}>
                  {disabled ? "No service night" : `${count} recipient${count !== 1 ? "s" : ""}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recipient list */}
      {!isTest && audience === "current_orders" && currentNight && (
        <div style={{ marginBottom: 24, background: "#3A3E43", borderRadius: 12, padding: "14px 16px" }}>
          <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "#F8EAD555", letterSpacing: 0.8, textTransform: "uppercase" }}>
            {formatDate(currentNight.serviceDate)} · {currentRecipients.length} with email
          </p>
          {currentRecipients.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#F8EAD533" }}>No orders with email on file yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {currentRecipients.map((r) => (
                <div key={r.code} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: 13, color: "#F8EAD5aa" }}>{r.customer_name}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#2F7D4F" }}>{formatTime(r.pickup_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!isTest && audience === "past" && pastRecipients.length > 0 && (
        <div style={{ marginBottom: 24, background: "#3A3E43", borderRadius: 12, padding: "14px 16px" }}>
          <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "#F8EAD555", letterSpacing: 0.8, textTransform: "uppercase" }}>Recipients</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {pastRecipients.map((email) => (
              <span key={email} style={{ fontSize: 13, color: "#F8EAD5aa", background: "#484D52", borderRadius: 6, padding: "4px 10px" }}>{email}</span>
            ))}
          </div>
        </div>
      )}

      {step === "compose" && (
        <div style={{ display: "grid", gap: 18 }}>
          <div>
            <label style={labelStyle}>Subject line</label>
            <input
              style={inputStyle}
              placeholder={audience === "current_orders" ? "See you tonight!" : "Friday Night Take is back — order now"}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {audience === "past" && (
            <div>
              <label style={labelStyle}>Event date <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#F8EAD544" }}>(optional)</span></label>
              <input
                type="date"
                style={{ ...inputStyle, colorScheme: "dark" }}
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
          )}

          <div>
            <label style={labelStyle}>Message</label>
            {audience === "current_orders" && (
              <p style={{ fontSize: 12, color: "#F8EAD555", margin: "0 0 8px", lineHeight: 1.5 }}>
                Each email will open with "Hi [Name]," and close with their pickup time.
              </p>
            )}
            <textarea
              style={{ ...inputStyle, resize: "vertical", minHeight: 140, lineHeight: 1.6 }}
              placeholder={audience === "current_orders"
                ? "Pizza's coming off the oven right on time — see you tonight!"
                : "We're firing up the oven again this Friday. Come grab a pizza — spots are limited."}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => setShowPreview(true)}
              disabled={!canSend}
              style={{ flex: "1 1 120px", background: "transparent", border: "1px solid #F8EAD520", color: canSend ? "#F8EAD5" : "#F8EAD533", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700, cursor: canSend ? "pointer" : "not-allowed", fontFamily: "var(--font-archivo), sans-serif" }}
            >
              Preview
            </button>
            <button
              onClick={() => setStep("confirm")}
              disabled={!canSend}
              style={{ flex: "2 1 200px", background: canSend ? "#2F7D4F" : "#2F7D4F44", border: "none", color: "#F8EAD5", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700, cursor: canSend ? "pointer" : "not-allowed", fontFamily: "var(--font-archivo), sans-serif" }}
            >
              {isTest
                ? "Send test →"
                : `Send to ${recipientCount} ${audience === "current_orders" ? "customer" : "people"}${recipientCount !== 1 ? "s" : ""} →`}
            </button>
          </div>
        </div>
      )}

      {step === "confirm" && (
        <div style={{ background: "#3A3E43", border: "1px solid #F8EAD510", borderRadius: 16, padding: "28px 24px" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: "#F8EAD5" }}>Ready to send?</h2>
          <p style={{ fontSize: 14, color: "#F8EAD5aa", margin: "0 0 6px" }}>
            <strong style={{ color: "#F8EAD5" }}>{subject}</strong>
          </p>
          <p style={{ fontSize: 13, color: "#F8EAD566", margin: "0 0 24px", lineHeight: 1.5 }}>
            {isTest
              ? <>This is a <strong style={{ color: "#C9A227" }}>test</strong> — sending only to <strong style={{ color: "#F8EAD5" }}>jared@latimerart.design</strong>. No real customers will receive this.</>
              : audience === "current_orders"
                ? <>This will send a <strong style={{ color: "#F8EAD5" }}>personalized email</strong> to <strong style={{ color: "#F8EAD5" }}>{recipientCount} customer{recipientCount !== 1 ? "s" : ""}</strong> with their specific pickup time. This can&rsquo;t be undone.</>
                : <>This will email <strong style={{ color: "#F8EAD5" }}>{recipientCount} past customers</strong>. This can&rsquo;t be undone.</>
            }
          </p>
          {error && <p style={{ fontSize: 13, color: "#E05555", marginBottom: 16 }}>{error}</p>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => setStep("compose")} style={{ flex: "1 1 100px", background: "transparent", border: "1px solid #F8EAD520", color: "#F8EAD5aa", borderRadius: 10, padding: "12px", fontSize: 14, cursor: "pointer", fontFamily: "var(--font-archivo), sans-serif" }}>
              Go back
            </button>
            <button onClick={send} style={{ flex: "2 1 180px", background: "#2F7D4F", border: "none", color: "#F8EAD5", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-archivo), sans-serif" }}>
              Yes, send it
            </button>
          </div>
        </div>
      )}

      {step === "sending" && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#F8EAD5aa", fontSize: 16 }}>Sending…</div>
      )}

      {/* Preview modal */}
      {showPreview && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
          onClick={() => setShowPreview(false)}
        >
          <div
            style={{ background: "#484D52", borderRadius: 20, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #F8EAD510" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#F8EAD577", letterSpacing: 0.5 }}>Email preview</span>
              <button onClick={() => setShowPreview(false)} style={{ background: "transparent", border: "none", color: "#F8EAD566", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 0 }}>×</button>
            </div>

            <div style={{ padding: "28px 20px" }}>
              <div style={{ background: "#3A3E43", borderRadius: 12, padding: "28px 20px" }}>
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#F8EAD5aa", fontFamily: "Arial, sans-serif" }}>Amori Muori</p>
                  <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#F8EAD5", lineHeight: 1.2, fontFamily: "Georgia, serif" }}>{subject || "Your subject line"}</h2>
                  {audience === "past" && formattedEventDate && (
                    <p style={{ margin: "8px 0 0", fontSize: 15, fontWeight: 700, color: "#2F7D4F", fontFamily: "Arial, sans-serif" }}>{formattedEventDate}</p>
                  )}
                </div>

                <div style={{ background: "#F8EAD5", borderRadius: 12, padding: "22px 20px" }}>
                  {audience === "current_orders" && (
                    <p style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700, color: "#484D52", fontFamily: "Arial, sans-serif" }}>
                      Hi {previewRecipient?.customer_name ?? "[Name]"},
                    </p>
                  )}
                  {body ? (
                    body.split("\n").filter(l => l.trim()).map((line, i) => (
                      <p key={i} style={{ margin: "0 0 10px", fontSize: 15, color: "#484D52", lineHeight: 1.6, fontFamily: "Arial, sans-serif" }}>{line}</p>
                    ))
                  ) : (
                    <p style={{ margin: 0, fontSize: 15, color: "#484D5255", fontStyle: "italic", fontFamily: "Arial, sans-serif" }}>Your message will appear here.</p>
                  )}

                  {audience === "current_orders" && previewRecipient && (
                    <div style={{ marginTop: 16, background: "#2F7D4F18", border: "1px solid #2F7D4F44", borderRadius: 10, padding: "14px 16px" }}>
                      <p style={{ margin: "0 0 4px", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "#2F7D4F", fontWeight: 700, fontFamily: "Arial, sans-serif" }}>Your pickup</p>
                      <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#2F7D4F", fontFamily: "Arial, sans-serif" }}>{formatTime(previewRecipient.pickup_at)}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: "#484D5299", fontFamily: "Arial, sans-serif" }}>Order {previewRecipient.code} · Ashburn Farm, VA</p>
                    </div>
                  )}

                  {audience === "past" && formattedEventDate && (
                    <div style={{ textAlign: "center", marginTop: 18 }}>
                      <span style={{ display: "inline-block", background: "#2F7D4F", color: "#F8EAD5", fontSize: 14, fontWeight: 700, padding: "12px 28px", borderRadius: 100, fontFamily: "Arial, sans-serif" }}>
                        Order now →
                      </span>
                    </div>
                  )}
                </div>

                <p style={{ textAlign: "center", fontSize: 11, color: "#F8EAD533", marginTop: 16, fontFamily: "Arial, sans-serif", lineHeight: 1.6 }}>
                  {audience === "current_orders"
                    ? "You're receiving this because you have an order tonight."
                    : "You're receiving this because you've ordered from Amori Muori."}
                  <br /><span style={{ textDecoration: "underline", color: "#F8EAD544" }}>Unsubscribe</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
