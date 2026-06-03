"use client";

import { useState } from "react";

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

export function BlastClient({ recipientCount, recipients }: { recipientCount: number; recipients: string[] }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [step, setStep] = useState<"compose" | "confirm" | "sending" | "done">("compose");
  const [sentCount, setSentCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const canSend = subject.trim().length > 0 && body.trim().length > 0 && recipientCount > 0;

  async function send() {
    setStep("sending");
    setError(null);
    try {
      const res = await fetch("/api/admin/send-blast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, eventDate: eventDate || undefined }),
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

  const formattedDate = eventDate
    ? new Date(eventDate + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      })
    : null;

  if (step === "done") {
    return (
      <div style={{ paddingTop: 32, maxWidth: 600 }}>
        <div style={{ background: "#2F7D4F22", border: "1px solid #2F7D4F44", borderRadius: 16, padding: "32px 28px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
          <h2 className="font-display" style={{ fontSize: 24, fontWeight: 900, margin: "0 0 8px", color: "#F8EAD5" }}>
            Blast sent
          </h2>
          <p style={{ fontSize: 15, color: "#F8EAD5aa", margin: "0 0 24px" }}>
            Delivered to {sentCount} customer{sentCount !== 1 ? "s" : ""}.
          </p>
          <button
            onClick={() => { setSubject(""); setBody(""); setEventDate(""); setStep("compose"); }}
            style={{ background: "transparent", border: "1px solid #F8EAD520", color: "#F8EAD5aa", borderRadius: 10, padding: "10px 22px", fontSize: 14, cursor: "pointer", fontFamily: "var(--font-archivo), sans-serif" }}
          >
            Send another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 32, maxWidth: 600 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>Blast</h1>
        <span style={{ background: "#484D52", border: "1px solid #F8EAD515", borderRadius: 100, padding: "5px 14px", fontSize: 13, fontWeight: 700, color: recipientCount > 0 ? "#F8EAD5cc" : "#F8EAD544" }}>
          {recipientCount} recipient{recipientCount !== 1 ? "s" : ""}
        </span>
      </div>

      {recipientCount === 0 ? (
        <p style={{ color: "#F8EAD544", fontSize: 14, marginBottom: 24 }}>
          No eligible recipients yet — customers appear here once their order is picked up.
        </p>
      ) : (
        <div style={{ marginBottom: 28, background: "#3A3E43", borderRadius: 12, padding: "14px 16px" }}>
          <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "#F8EAD555", letterSpacing: 0.8, textTransform: "uppercase" }}>
            Recipients
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {recipients.map((email) => (
              <span key={email} style={{ fontSize: 13, color: "#F8EAD5aa", background: "#484D52", borderRadius: 6, padding: "4px 10px" }}>
                {email}
              </span>
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
              placeholder="Friday Night Take is back — order now"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Event date <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "#F8EAD544" }}>(optional)</span></label>
            <input
              type="date"
              style={{ ...inputStyle, colorScheme: "dark" }}
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Message</label>
            <textarea
              style={{ ...inputStyle, resize: "vertical", minHeight: 160, lineHeight: 1.6 }}
              placeholder={"We're firing up the oven again this Friday. Come grab a pizza — spots are limited."}
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
              Send to {recipientCount} people →
            </button>
          </div>
        </div>
      )}

      {step === "confirm" && (
        <div style={{ background: "#3A3E43", border: "1px solid #F8EAD510", borderRadius: 16, padding: "28px 24px" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px", color: "#F8EAD5" }}>
            Ready to send?
          </h2>
          <p style={{ fontSize: 14, color: "#F8EAD5aa", margin: "0 0 6px" }}>
            <strong style={{ color: "#F8EAD5" }}>{subject}</strong>
          </p>
          {formattedDate && (
            <p style={{ fontSize: 13, color: "#2F7D4F", margin: "0 0 6px", fontWeight: 700 }}>{formattedDate}</p>
          )}
          <p style={{ fontSize: 13, color: "#F8EAD566", margin: "0 0 24px", lineHeight: 1.5 }}>
            This will email <strong style={{ color: "#F8EAD5" }}>{recipientCount} past customers</strong>. This can&rsquo;t be undone.
          </p>
          {error && (
            <p style={{ fontSize: 13, color: "#E05555", marginBottom: 16 }}>{error}</p>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => setStep("compose")}
              style={{ flex: "1 1 100px", background: "transparent", border: "1px solid #F8EAD520", color: "#F8EAD5aa", borderRadius: 10, padding: "12px", fontSize: 14, cursor: "pointer", fontFamily: "var(--font-archivo), sans-serif" }}
            >
              Go back
            </button>
            <button
              onClick={send}
              style={{ flex: "2 1 180px", background: "#2F7D4F", border: "none", color: "#F8EAD5", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font-archivo), sans-serif" }}
            >
              Yes, send it
            </button>
          </div>
        </div>
      )}

      {step === "sending" && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#F8EAD5aa", fontSize: 16 }}>
          Sending…
        </div>
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
            {/* Modal header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #F8EAD510" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#F8EAD577", letterSpacing: 0.5 }}>Email preview</span>
              <button onClick={() => setShowPreview(false)} style={{ background: "transparent", border: "none", color: "#F8EAD566", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 0 }}>×</button>
            </div>

            {/* Simulated email */}
            <div style={{ padding: "28px 20px" }}>
              {/* Outer bg */}
              <div style={{ background: "#484D52", borderRadius: 12, padding: "28px 20px" }}>
                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#F8EAD5aa", fontFamily: "Arial, sans-serif" }}>Amori Muori</p>
                  <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#F8EAD5", lineHeight: 1.2, fontFamily: "Georgia, serif" }}>{subject || "Your subject line"}</h2>
                  {formattedDate && (
                    <p style={{ margin: "8px 0 0", fontSize: 15, fontWeight: 700, color: "#2F7D4F", fontFamily: "Arial, sans-serif" }}>{formattedDate}</p>
                  )}
                </div>

                {/* Card */}
                <div style={{ background: "#F8EAD5", borderRadius: 12, padding: "22px 20px" }}>
                  {body ? (
                    body.split("\n").filter(l => l.trim()).map((line, i) => (
                      <p key={i} style={{ margin: "0 0 10px", fontSize: 15, color: "#484D52", lineHeight: 1.6, fontFamily: "Arial, sans-serif" }}>{line}</p>
                    ))
                  ) : (
                    <p style={{ margin: 0, fontSize: 15, color: "#484D5255", fontStyle: "italic", fontFamily: "Arial, sans-serif" }}>Your message will appear here.</p>
                  )}
                  {formattedDate && (
                    <div style={{ textAlign: "center", marginTop: 18 }}>
                      <span style={{ display: "inline-block", background: "#2F7D4F", color: "#F8EAD5", fontSize: 14, fontWeight: 700, padding: "12px 28px", borderRadius: 100, fontFamily: "Arial, sans-serif" }}>
                        Order now →
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <p style={{ textAlign: "center", fontSize: 11, color: "#F8EAD533", marginTop: 16, fontFamily: "Arial, sans-serif", lineHeight: 1.6 }}>
                  You&rsquo;re receiving this because you&rsquo;ve ordered from Amori Muori.<br />
                  <span style={{ textDecoration: "underline", color: "#F8EAD544" }}>Unsubscribe</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
