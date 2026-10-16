const ET = "America/New_York";
const SITE_URL = "https://amorimuori.com";

export interface CalendarNight {
  id: string;
  service_date: string;
  service_start: string;
  last_pickup: string;
  order_open_at: string;
  order_close_at: string;
}

// "17:30:00" → "5:30 pm"
export function formatClock(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

// "17:00:00", "20:00:00" → "5:00 to 8:00 pm"
export function formatPickupWindow(start: string, end: string): string {
  const a = formatClock(start);
  const b = formatClock(end);
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)} to ${b}` : `${a} to ${b}`;
}

// "2026-11-06" → parts for the date box
export function dateParts(serviceDate: string) {
  const d = new Date(`${serviceDate}T12:00:00Z`);
  return {
    month: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
    day: d.getUTCDate(),
    weekday: d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
    long: d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }),
  };
}

// ISO timestamp → "Wed, Nov 4" in ET
export function formatShortDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: ET });
}

// ISO timestamp → "Wednesday, Nov 4 at 10:00 am" in ET
export function formatOpensAt(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: ET });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: ET }).toLowerCase();
  return `${day} at ${time}`;
}

// ── .ics ─────────────────────────────────────────────────────────────────────

// "2026-11-06" + "17:00:00" → "20261106T170000" (floating, paired with TZID)
function icsLocal(date: string, time: string) {
  return `${date.replace(/-/g, "")}T${time.slice(0, 5).replace(":", "")}00`;
}

function icsUtc(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// RFC 5545: lines over 75 octets continue on the next line after a space
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  out.push(rest);
  return out.join("\r\n");
}

const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:America/New_York",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0400",
  "TZNAME:EDT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0400",
  "TZOFFSETTO:-0500",
  "TZNAME:EST",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** A one-event calendar file for a night's pickup window, in Eastern time. */
export function buildNightIcs(night: CalendarNight, now = new Date()): string {
  const description =
    `Pre-order your pizza and pick a pickup time at ${SITE_URL}/order.\n` +
    `Ordering opens ${formatOpensAt(night.order_open_at)} and closes ${formatOpensAt(night.order_close_at)}.\n` +
    `We share the pickup spot once your order is paid.`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Amori Muori//Friday Night Take//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...VTIMEZONE,
    "BEGIN:VEVENT",
    `UID:${night.id}@amorimuori.com`,
    `DTSTAMP:${icsUtc(now)}`,
    `DTSTART;TZID=${ET}:${icsLocal(night.service_date, night.service_start)}`,
    `DTEND;TZID=${ET}:${icsLocal(night.service_date, night.last_pickup)}`,
    `SUMMARY:${icsEscape("Amori Muori: Friday Night Take pickup")}`,
    `DESCRIPTION:${icsEscape(description)}`,
    `LOCATION:${icsEscape("Ashburn Farm, VA")}`,
    `URL:${SITE_URL}/order`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.map(fold).join("\r\n") + "\r\n";
}
