// Dough batch math, from the Gig Vault spreadsheet. Pure functions, no I/O.

export type DoughSchedule = "same-day" | "24-hour" | "48-hour";

export const DOUGH_SCHEDULES: { key: DoughSchedule; label: string }[] = [
  { key: "same-day", label: "Same-day" },
  { key: "24-hour", label: "24-hour" },
  { key: "48-hour", label: "48-hour" },
];

/** Percentages are stored as the owner types them: 62 means 62%. */
export interface DoughFormula {
  ball_g: number;
  buffer_pct: number;
  hydration_pct: number;
  salt_pct: number;
  yeast_pct: number;
  schedule: DoughSchedule;
}

export const DEFAULT_DOUGH_FORMULA: DoughFormula = {
  ball_g: 260,
  buffer_pct: 3,
  hydration_pct: 62,
  salt_pct: 2.8,
  yeast_pct: 0.08,
  schedule: "48-hour",
};

/** Dough columns on the settings row (migration 015). */
export const DOUGH_COLUMNS = [
  "dough_ball_g",
  "dough_buffer_pct",
  "dough_hydration_pct",
  "dough_salt_pct",
  "dough_yeast_pct",
  "dough_schedule",
] as const;

/** A pizza uses gluten free dough if its name says so. */
export function isGlutenFree(pizzaName: string) {
  return pizzaName.toLowerCase().includes("gluten free");
}

function isSchedule(v: unknown): v is DoughSchedule {
  return v === "same-day" || v === "24-hour" || v === "48-hour";
}

/**
 * Reads the dough formula off a settings row. Returns null when the columns
 * aren't there yet (migration not run), so the caller can fall back to defaults.
 */
export function formulaFromSettingsRow(row: Record<string, unknown> | null | undefined): DoughFormula | null {
  if (!row || !("dough_ball_g" in row)) return null;
  const num = (v: unknown, fallback: number) => {
    const n = Number(v);
    return v != null && Number.isFinite(n) ? n : fallback;
  };
  const d = DEFAULT_DOUGH_FORMULA;
  return {
    ball_g: num(row.dough_ball_g, d.ball_g),
    buffer_pct: num(row.dough_buffer_pct, d.buffer_pct),
    hydration_pct: num(row.dough_hydration_pct, d.hydration_pct),
    salt_pct: num(row.dough_salt_pct, d.salt_pct),
    yeast_pct: num(row.dough_yeast_pct, d.yeast_pct),
    schedule: isSchedule(row.dough_schedule) ? row.dough_schedule : d.schedule,
  };
}

/** Checks a formula sent from the form. Returns an error message, or null if it's fine. */
export function validateFormula(f: Partial<DoughFormula>): string | null {
  const inRange = (v: unknown, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  if (!inRange(f.ball_g, 50, 1000)) return "Ball weight should be between 50 and 1000 g.";
  if (!inRange(f.buffer_pct, 0, 50)) return "Spare dough should be between 0 and 50%.";
  if (!inRange(f.hydration_pct, 40, 100)) return "Hydration should be between 40 and 100%.";
  if (!inRange(f.salt_pct, 0, 10)) return "Salt should be between 0 and 10%.";
  if (!inRange(f.yeast_pct, 0, 5)) return "Yeast should be between 0 and 5%.";
  if (!isSchedule(f.schedule)) return "Pick a fermentation schedule.";
  return null;
}

export interface DoughBatch {
  balls: number;
  baseDough_g: number;   // balls × ball weight, before spare
  totalDough_g: number;  // with spare
  percentSum: number;    // 1 + hydration + salt + yeast
  flour_g: number;
  water_g: number;
  salt_g: number;
  yeast_g: number;       // 1 decimal place
  flour_lb: number;      // 1 decimal place
}

const GRAMS_PER_LB = 453.6;
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * total = balls × ball weight × (1 + buffer)
 * flour = total ÷ (1 + hydration + salt + yeast); the rest are flour × their %.
 * Each ingredient works off unrounded flour; rounding is only for display.
 */
export function calcDoughBatch(balls: number, f: DoughFormula): DoughBatch {
  const b = Math.max(0, Math.floor(balls));
  const hydration = f.hydration_pct / 100;
  const salt = f.salt_pct / 100;
  const yeast = f.yeast_pct / 100;
  const base = b * f.ball_g;
  const total = base * (1 + f.buffer_pct / 100);
  const percentSum = 1 + hydration + salt + yeast;
  const flour = total / percentSum;
  return {
    balls: b,
    baseDough_g: Math.round(base),
    totalDough_g: Math.round(total),
    percentSum,
    flour_g: Math.round(flour),
    water_g: Math.round(flour * hydration),
    salt_g: Math.round(flour * salt),
    yeast_g: round1(flour * yeast),
    flour_lb: round1(flour / GRAMS_PER_LB),
  };
}

// ── Countdown ────────────────────────────────────────────────────────────────

export interface DoughStep {
  /** Wall-clock time in the restaurant's time zone, as "YYYY-MM-DDTHH:MM". */
  at: string;
  label: string;
}

/**
 * Works the dough timeline back from the first pickup.
 * Dates and times are plain wall-clock values (no time zone math): the
 * service date plus its start time, e.g. "2026-11-06" and "18:00:00".
 */
export function doughCountdown(serviceDate: string, firstPickup: string, schedule: DoughSchedule): DoughStep[] {
  const [hh, mm] = firstPickup.split(":").map(Number);
  // Treat wall-clock as UTC so adding hours never trips over DST
  const pickup = Date.UTC(
    Number(serviceDate.slice(0, 4)), Number(serviceDate.slice(5, 7)) - 1, Number(serviceDate.slice(8, 10)),
    hh || 0, mm || 0,
  );
  const HOUR = 3_600_000;
  const hoursBefore = (h: number) => pickup - h * HOUR;
  const daysBeforeAt = (days: number, hour: number, minute = 0) => {
    const d = new Date(pickup);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - days, hour, minute);
  };
  const clock = (t: number) => formatStepTime(new Date(t).toISOString().slice(0, 16)).split(", ").pop();
  const step = (t: number, label: string): DoughStep => ({ at: new Date(t).toISOString().slice(0, 16), label });

  if (schedule === "48-hour") {
    return [
      step(daysBeforeAt(2, 9), "Mix. Leave it at room temperature for 1 hour."),
      step(daysBeforeAt(2, 10), "Into the fridge."),
      step(hoursBefore(6), "Ball the dough."),
      step(hoursBefore(4), `Earliest it's ready to stretch. Should be ready by ${clock(hoursBefore(2))}.`),
      step(pickup, "First pickup."),
    ];
  }
  if (schedule === "24-hour") {
    return [
      step(daysBeforeAt(1, 13), "Mix. Leave it at room temperature for 1 to 2 hours."),
      step(daysBeforeAt(1, 14), "Into the fridge, by 3:00 pm at the latest."),
      step(hoursBefore(6), "Ball the dough."),
      step(pickup, "First pickup."),
    ];
  }
  return [
    step(hoursBefore(8), "Mix. Leave it at room temperature for 2 hours."),
    step(hoursBefore(6), "Ball the dough. Let the balls proof 4 to 6 hours."),
    step(hoursBefore(2), "Earliest it's ready to stretch. Should be ready by first pickup."),
    step(pickup, "First pickup."),
  ];
}

/** "Wed, Nov 4, 9:00 am" for a wall-clock "YYYY-MM-DDTHH:MM". */
export function formatStepTime(at: string) {
  const d = new Date(at + ":00Z");
  const day = d.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
  const time = d
    .toLocaleTimeString("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit" })
    // Newer ICU puts a narrow no-break space before AM/PM
    .replace(/\s*AM$/, " am")
    .replace(/\s*PM$/, " pm");
  return `${day}, ${time}`;
}
