"use client";

import { useState } from "react";

const EMAIL = /^.+@.+\..+$/;

// Same signup as the closed-ordering page: /api/reminder-signup takes an email only.
export function RemindForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const valid = EMAIL.test(email);

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

  if (state === "done") {
    return (
      <div
        role="status"
        style={{
          marginTop: 16,
          background: "#2F7D4F1f",
          border: "1px solid #2F7D4F",
          borderRadius: 14,
          padding: "16px 18px",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 16 }}>You&apos;re on the list!</div>
        <div style={{ fontSize: 14, color: "#F8EAD5aa", marginTop: 4 }}>
          We&apos;ll email you when ordering opens.
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 16, display: "grid", gap: 10 }}>
      <label htmlFor="remind-email" style={{ fontSize: 13, fontWeight: 600, color: "#F8EAD5cc" }}>
        Email address
      </label>
      <input
        id="remind-email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          width: "100%",
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
          padding: "13px 22px",
          borderRadius: 11,
          fontSize: 15,
          cursor: valid ? "pointer" : "not-allowed",
        }}
      >
        {state === "loading" ? "…" : "Remind me"}
      </button>
      {state === "error" && (
        <p style={{ fontSize: 13, color: "#E8C24A", margin: 0 }}>
          Something went wrong. Please try again.
        </p>
      )}
    </form>
  );
}
