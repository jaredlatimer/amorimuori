export interface ScheduleDefaults {
  service_start: string;
  last_pickup: string;
  order_close_time: string;
  nightly_pool: number;
}

export function todayET() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function getUpcomingFridays(n = 16): string[] {
  const results: string[] = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  const daysUntilFriday = (5 - day + 7) % 7;
  d.setDate(d.getDate() + (daysUntilFriday === 0 ? 0 : daysUntilFriday));
  for (let i = 0; i < n; i++) {
    results.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 7);
  }
  return results;
}

export function makeOrderOpenAt(fridayDate: string): string {
  // Wednesday before at 10 AM ET
  const friday = new Date(fridayDate + "T12:00:00Z");
  const wednesday = new Date(friday);
  wednesday.setDate(friday.getDate() - 2);
  const ymd = wednesday.toISOString().slice(0, 10);
  return `${ymd}T10:00:00-04:00`;
}

export function makeOrderCloseAt(fridayDate: string, settings: Pick<ScheduleDefaults, "order_close_time">): string {
  const t = settings.order_close_time.slice(0, 5);
  return `${fridayDate}T${t}:00-04:00`;
}

