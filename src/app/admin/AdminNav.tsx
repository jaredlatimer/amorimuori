"use client";

import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  const tabs = [
    { label: "Orders", href: "/admin/orders" },
    { label: "Kitchen", href: "/admin/kitchen" },
  ];

  return (
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

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, flex: 1 }}>
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
                borderBottom: active
                  ? "2px solid #2F7D4F"
                  : "2px solid transparent",
                transition: "color 0.15s",
              }}
            >
              {tab.label}
            </a>
          );
        })}
      </div>

      {/* Sign out */}
      <button
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
        }}
      >
        Sign out
      </button>
    </nav>
  );
}
