export function formatNightDate(d: string, weekday: "short" | "long" = "short") {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday, month: "short", day: "numeric" });
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" });
}

/** A plain-words status for a Friday, plus a tone for its pill. */
export function nightStatus(
  n: { service_date: string; is_enabled: boolean; order_open_at: string; order_close_at: string },
  today: string,
  now = Date.now()
): { label: string; tone: "live" | "open" | "soon" | "closed" | "off" | "done" } {
  if (!n.is_enabled) return { label: "Skipped", tone: "off" };
  if (n.service_date < today) return { label: "Done", tone: "done" };
  if (n.service_date === today) return { label: "Tonight", tone: "live" };
  if (now < new Date(n.order_open_at).getTime()) return { label: `Opens ${shortDate(n.order_open_at)}`, tone: "soon" };
  if (now < new Date(n.order_close_at).getTime()) return { label: "Taking orders", tone: "open" };
  return { label: "Ordering closed", tone: "closed" };
}
