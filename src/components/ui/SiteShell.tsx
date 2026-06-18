"use client";

import { LogoLockup } from "./Logo";

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#484D52",
        color: "#F8EAD5",
        fontFamily: "var(--font-archivo), sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "22px 7vw",
          borderBottom: "1px solid #F8EAD514",
        }}
      >
        <a href="/" style={{ textDecoration: "none" }}>
          <LogoLockup />
        </a>
        <a
          href="/"
          style={{
            fontSize: 14,
            color: "#F8EAD5aa",
            textDecoration: "none",
          }}
        >
          ← Back to home
        </a>
      </nav>

      <div style={{ flex: 1 }}>{children}</div>

      <footer
        style={{
          borderTop: "1px solid #F8EAD514",
          padding: "22px 7vw",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <LogoLockup />
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <a href="/privacy" style={{ fontSize: 13, color: "#F8EAD533", textDecoration: "none" }}>Privacy Policy</a>
            <a href="/terms" style={{ fontSize: 13, color: "#F8EAD533", textDecoration: "none" }}>Terms</a>
            <p style={{ fontSize: 13, color: "#F8EAD533", margin: 0 }}>Ashburn Farm, VA</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
