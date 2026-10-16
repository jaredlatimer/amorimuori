"use client";

import { useState } from "react";

export function RemindersClient({ count }: { count: number }) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent?: number; error?: string } | null>(null);

  async function send() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/send-reminders", { method: "POST" });
      setResult(await res.json());
    } catch {
      setResult({ error: "Network error" });
    }
    setSending(false);
  }

  return (
    <div style={{ paddingTop: 32, maxWidth: 680 }}>
      <h1 className="font-display" style={{ fontSize: 28, fontWeight: 900, margin: "0 0 8px" }}>Reminder list</h1>
      <p style={{ fontSize: 14, color: "#F8EAD577", margin: "0 0 24px" }}>
        People who asked to hear when ordering opens.
      </p>
      <div style={{ background: "#484D52", border: "1px solid #F8EAD510", borderRadius: 16, padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div className="font-display" style={{ fontSize: 36, fontWeight: 900, lineHeight: 1 }}>{count}</div>
            <div style={{ fontSize: 13, color: "#F8EAD555", marginTop: 3 }}>
              {count === 1 ? "signup" : "signups"} waiting to be notified
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <button
              onClick={send}
              disabled={sending || count === 0}
              style={{
                background: count === 0 ? "#2F7D4F44" : sending ? "#2F7D4F88" : "#2F7D4F",
                border: "none", color: "#F8EAD5", borderRadius: 12,
                padding: "11px 22px", fontSize: 14, fontWeight: 700,
                cursor: sending || count === 0 ? "not-allowed" : "pointer",
                fontFamily: "var(--font-archivo), sans-serif",
              }}
            >
              {sending ? "Sending…" : "Send reminder email"}
            </button>
            {result && (
              <span style={{ fontSize: 13, color: result.error ? "#f0a0a0" : "#2F7D4F", fontWeight: 600 }}>
                {result.error ? `Error: ${result.error}` : `✓ Sent to ${result.sent}`}
              </span>
            )}
          </div>
        </div>
        <p style={{ fontSize: 12, color: "#F8EAD555", marginTop: 14, marginBottom: 0 }}>
          Sends an &ldquo;Ordering is open&rdquo; email to everyone on the list. Send it when ordering opens on Wednesday.
        </p>
      </div>
    </div>
  );
}
