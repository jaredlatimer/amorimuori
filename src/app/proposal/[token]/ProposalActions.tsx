"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProposalStatus } from "@/lib/event-proposals";

function signedOn(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  });
}

// Sign, then pay the deposit. The server decides the amount; this only sends the token.
export function ProposalActions({
  token,
  status,
  signedName,
  signedAt,
  depositLabel,
}: {
  token: string;
  status: ProposalStatus;
  signedName: string | null;
  signedAt: string | null;
  depositLabel: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/proposal/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, agree }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Couldn't sign. Please try again.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function payDeposit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/proposal/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) throw new Error(json.error ?? "Payment setup failed. Please try again.");
      window.location.href = json.url as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment setup failed. Please try again.");
      setBusy(false);
    }
  }

  const signed = !!signedAt;

  return (
    <section className="pp-card" style={{ marginTop: 22 }}>
      <style>{CSS}</style>
      {signed ? (
        <>
          <p style={{ margin: 0, fontSize: 13, color: "#F8EAD577", textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700 }}>Signed</p>
          <p className="pp-sig">{signedName}</p>
          <p style={{ margin: 0, color: "#F8EAD5aa", fontSize: 14 }}>Signed electronically on {signedOn(signedAt!)} (Eastern time).</p>
        </>
      ) : (
        <form onSubmit={sign} className="pp-noprint" style={{ display: "grid", gap: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>Sign the agreement</h2>
          <label style={{ display: "grid", gap: 6, fontSize: 14, color: "#F8EAD5cc" }}>
            Type your full name
            <input
              className="pp-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
              minLength={2}
              maxLength={120}
            />
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 15, lineHeight: 1.5 }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 4, width: 18, height: 18 }} />
            I agree to these terms
          </label>
          <button type="submit" className="am-btn pp-btn" disabled={busy || !agree || name.trim().length < 2}>
            {busy ? "Signing…" : "Sign"}
          </button>
        </form>
      )}

      {error && <p role="alert" style={{ color: "#E8C24A", fontSize: 14, margin: "12px 0 0" }}>{error}</p>}

      <div className="pp-noprint" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
        {status === "signed" && (
          <button type="button" className="am-btn pp-btn" disabled={busy} onClick={payDeposit}>
            {busy ? "Opening payment…" : `Pay deposit (${depositLabel})`}
          </button>
        )}
        {signed && (
          <button type="button" className="am-btn pp-btn ghost" onClick={() => window.print()}>
            Print a copy
          </button>
        )}
      </div>
    </section>
  );
}

const CSS = `
.pp-input { font: 400 17px var(--font-archivo), sans-serif; color: #F8EAD5; background: #484D52; border: 1px solid #F8EAD533; border-radius: 12px; padding: 12px 14px; }
.pp-input:focus { outline: 2px solid #E8C24A; outline-offset: 1px; }
.pp-btn { background: #2F7D4F; color: #F8EAD5; border-radius: 100px; padding: 14px 28px; font-size: 16px; border: none; cursor: pointer; justify-self: start; }
.pp-btn:disabled { opacity: .5; cursor: default; }
.pp-btn.ghost { background: transparent; border: 1px solid #F8EAD544; }
.pp-sig { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; font-size: 30px; margin: 6px 0; }
`;
