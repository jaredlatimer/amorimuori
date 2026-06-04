"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  const tabs = [
    { label: "Orders", href: "/admin/orders" },
    { label: "Kitchen", href: "/admin/kitchen" },
    { label: "Walk-in", href: "/admin/walk-in" },
    { label: "Inventory", href: "/admin/inventory" },
    { label: "Menu", href: "/admin/menu" },
    { label: "Dashboard", href: "/admin/dashboard" },
    { label: "Blast", href: "/admin/blast" },
    { label: "Settings", href: "/admin/settings" },
  ];

  return (
    <>
      <nav
        style={{
          background: "#484D52",
          borderBottom: "1px solid #F8EAD510",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          gap: 0,
          height: 56,
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        {/* Logo */}
        <span
          className="font-display"
          style={{
            fontSize: 18,
            fontWeight: 900,
            color: "#F8EAD5",
            marginRight: 32,
            letterSpacing: -0.3,
            flexShrink: 0,
          }}
        >
          Amori Muori
        </span>

        {/* Tabs — desktop only */}
        <div className="admin-nav-tabs" style={{ display: "flex", gap: 4, flex: 1 }}>
          {tabs.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <a
                key={tab.href}
                href={tab.href}
                style={{
                  padding: "0 16px",
                  height: 56,
                  display: "flex",
                  alignItems: "center",
                  fontSize: 14,
                  fontWeight: 700,
                  color: active ? "#F8EAD5" : "#F8EAD566",
                  textDecoration: "none",
                  borderBottom: active ? "2px solid #2F7D4F" : "2px solid transparent",
                  transition: "color 0.15s",
                }}
              >
                {tab.label}
              </a>
            );
          })}
        </div>

        {/* Sign out — desktop only */}
        <button
          className="admin-nav-signout"
          onClick={signOut}
          style={{
            background: "transparent",
            border: "1px solid #F8EAD520",
            color: "#F8EAD566",
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 13,
            cursor: "pointer",
            flexShrink: 0,
            fontFamily: "var(--font-archivo), sans-serif",
          }}
        >
          Sign out
        </button>

        {/* Hamburger — mobile only */}
        <button
          className="admin-nav-hamburger"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: "none",
            color: "#F8EAD5",
            cursor: "pointer",
            padding: 6,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {menuOpen ? (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <line x1="4" y1="4" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="18" y1="4" x2="4" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <line x1="3" y1="6" x2="19" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="3" y1="11" x2="19" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="3" y1="16" x2="19" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div
          style={{
            position: "fixed",
            top: 56,
            left: 0,
            right: 0,
            bottom: 0,
            background: "#3A3E43",
            zIndex: 49,
            display: "flex",
            flexDirection: "column",
            padding: "8px 0",
            overflowY: "auto",
          }}
        >
          {tabs.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <a
                key={tab.href}
                href={tab.href}
                onClick={() => setMenuOpen(false)}
                style={{
                  padding: "15px 24px",
                  fontSize: 17,
                  fontWeight: 700,
                  color: active ? "#F8EAD5" : "#F8EAD577",
                  textDecoration: "none",
                  borderLeft: `3px solid ${active ? "#2F7D4F" : "transparent"}`,
                  background: active ? "#F8EAD508" : "transparent",
                  fontFamily: "var(--font-archivo), sans-serif",
                }}
              >
                {tab.label}
              </a>
            );
          })}
          <div style={{ marginTop: "auto", padding: "16px 24px", borderTop: "1px solid #F8EAD510" }}>
            <button
              onClick={() => { setMenuOpen(false); signOut(); }}
              style={{
                background: "transparent",
                border: "1px solid #F8EAD520",
                color: "#F8EAD566",
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 14,
                cursor: "pointer",
                fontFamily: "var(--font-archivo), sans-serif",
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
