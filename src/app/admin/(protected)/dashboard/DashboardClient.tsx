"use client";

import { useRouter } from "next/navigation";

interface ServiceNightSummary {
  id: string;
  service_date: string;
}

interface Props {
  serviceNightId: string;
  allNights: ServiceNightSummary[];
  children: React.ReactNode;
}

export function DashboardClient({ serviceNightId, allNights, children }: Props) {
  const router = useRouter();
  const todayET = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  return (
    <>
      {allNights.length > 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {[...allNights].reverse().map((n) => {
            const active = n.id === serviceNightId;
            const isPast = n.service_date < todayET;
            return (
              <button
                key={n.id}
                onClick={() => router.push(`/admin/dashboard?nightId=${n.id}`)}
                style={{
                  background: active ? "#F8EAD5" : "transparent",
                  color: active ? "#484D52" : isPast ? "#F8EAD533" : "#F8EAD5aa",
                  border: `1px solid ${active ? "#F8EAD5" : "#F8EAD520"}`,
                  borderRadius: 100,
                  padding: "6px 14px",
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                  fontFamily: "var(--font-archivo), sans-serif",
                }}
              >
                {new Date(n.service_date + "T12:00:00").toLocaleDateString("en-US", {
                  month: "short", day: "numeric",
                })}
                {isPast && " · past"}
              </button>
            );
          })}
        </div>
      )}
      {children}
    </>
  );
}
