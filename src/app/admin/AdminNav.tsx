"use client";

import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type IconName = "service" | "nights" | "menu" | "people" | "gear";

interface Section {
  label: string;
  icon: IconName;
  pages: { label: string; href: string }[];
}

// Five sections, grouped by when you use them. Page URLs are unchanged so
// bookmarks and the kitchen tablet keep working.
const SECTIONS: Section[] = [
  {
    label: "Service",
    icon: "service",
    pages: [
      { label: "Board", href: "/admin/service" },
      { label: "Oven view", href: "/admin/kitchen" },
      { label: "Walk-in", href: "/admin/walk-in" },
    ],
  },
  {
    label: "Nights",
    icon: "nights",
    pages: [
      { label: "All nights", href: "/admin/nights" },
    ],
  },
  {
    label: "Menu",
    icon: "menu",
    pages: [
      { label: "Pizzas", href: "/admin/menu" },
      { label: "Costs", href: "/admin/costs" },
    ],
  },
  {
    label: "Customers",
    icon: "people",
    pages: [
      { label: "Customers", href: "/admin/customers" },
      { label: "Rewards", href: "/admin/rewards" },
      { label: "Referrals", href: "/admin/referrals" },
      { label: "Events", href: "/admin/events" },
      { label: "Blast", href: "/admin/blast" },
      { label: "Reminders", href: "/admin/reminders" },
    ],
  },
  {
    label: "Settings",
    icon: "gear",
    pages: [{ label: "Settings", href: "/admin/settings" }],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function activeSection(pathname: string) {
  return SECTIONS.find((s) => s.pages.some((p) => isActive(pathname, p.href))) ?? SECTIONS[0];
}

function Icon({ name }: { name: IconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      {name === "service" && <path d="M3 15h14M4.5 15a5.5 5.5 0 0 1 11 0M10 6.5V5" {...common} />}
      {name === "nights" && (
        <>
          <rect x="3" y="4.5" width="14" height="12" rx="2.5" {...common} />
          <path d="M3 8.5h14M7 3v3M13 3v3" {...common} />
        </>
      )}
      {name === "menu" && (
        <>
          <path d="M10 3 3 16.5h14z" {...common} />
          <circle cx="10" cy="11" r="1.4" fill="currentColor" />
          <circle cx="7.6" cy="14" r="1.1" fill="currentColor" />
          <circle cx="12.4" cy="14" r="1.1" fill="currentColor" />
        </>
      )}
      {name === "people" && (
        <path d="M7.5 9.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6ZM2.5 16a5 5 0 0 1 10 0M13 4.5a2.6 2.6 0 0 1 0 5M14.5 12a4.5 4.5 0 0 1 3 4" {...common} />
      )}
      {name === "gear" && (
        <>
          <circle cx="10" cy="10" r="2.6" {...common} />
          <path d="M10 2.5v2.2M10 15.3v2.2M2.5 10h2.2M15.3 10h2.2M4.7 4.7l1.6 1.6M13.7 13.7l1.6 1.6M4.7 15.3l1.6-1.6M13.7 6.3l1.6-1.6" {...common} />
        </>
      )}
    </svg>
  );
}

function useSignOut() {
  const router = useRouter();
  return async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  };
}

/** Desktop sidebar plus the phone's bottom tab bar. */
export function AdminNav() {
  const pathname = usePathname();
  const signOut = useSignOut();
  const current = activeSection(pathname);

  return (
    <>
      <aside className="admin-side">
        <a href="/admin/service" className="admin-logo font-display">
          Amori Muori
        </a>
        <nav className="admin-side-nav">
          {SECTIONS.map((s) => {
            const on = s === current;
            return (
              <div key={s.label}>
                <a href={s.pages[0].href} className={`admin-side-link${on ? " on" : ""}`}>
                  <Icon name={s.icon} />
                  {s.label}
                </a>
                {on && s.pages.length > 1 && (
                  <div className="admin-side-sub">
                    {s.pages.map((p) => (
                      <a key={p.href} href={p.href} className={isActive(pathname, p.href) ? "on" : undefined}>
                        {p.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <button className="admin-signout" onClick={signOut}>
          Sign out
        </button>
      </aside>

      <nav className="admin-tabbar" aria-label="Sections">
        {SECTIONS.map((s) => (
          <a key={s.label} href={s.pages[0].href} className={s === current ? "on" : undefined}>
            <Icon name={s.icon} />
            {s.label}
          </a>
        ))}
      </nav>
    </>
  );
}

/** On phones, the pages inside the current section as a row of pills. */
export function AdminSubnav() {
  const pathname = usePathname();
  const signOut = useSignOut();
  const current = activeSection(pathname);
  const showSignOut = current.label === "Settings";
  if (current.pages.length < 2 && !showSignOut) return null;

  return (
    <div className="admin-subnav">
      {current.pages.length > 1 &&
        current.pages.map((p) => (
          <a key={p.href} href={p.href} className={isActive(pathname, p.href) ? "on" : undefined}>
            {p.label}
          </a>
        ))}
      {showSignOut && (
        <button onClick={signOut} className="admin-subnav-signout">
          Sign out
        </button>
      )}
    </div>
  );
}
