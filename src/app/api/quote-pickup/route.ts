import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// All service nights in 2026 (May–Nov) fall in EDT = UTC-4.
// If service extends into winter, update this offset.
const ET_OFFSET = "-04:00";

function serviceTimeMs(date: string, time: string): number {
  const t = time.slice(0, 5); // "HH:MM"
  return new Date(`${date}T${t}:00${ET_OFFSET}`).getTime();
}

function roundUpToNearest5(ms: number): number {
  const five = 5 * 60 * 1000;
  return Math.ceil(ms / five) * five;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body.serviceNightId !== "string" ||
    typeof body.quantities !== "object"
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { serviceNightId, quantities } = body as {
    serviceNightId: string;
    quantities: Record<string, number>;
  };

  const orderPizzas = Object.values(quantities).reduce(
    (sum, q) => sum + (Number(q) || 0),
    0
  );

  if (orderPizzas <= 0) {
    return NextResponse.json({ error: "No pizzas" }, { status: 400 });
  }

  const supabase = await createClient();

  // Dev: return mock slots when using the synthetic dev service night
  const isDevTools = process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_DEV_TOOLS === "1";
  if (isDevTools && serviceNightId === "dev-mock") {
    // Dev: generate slots relative to now so testing works at any hour
    const nowMs = Date.now();
    const bakeMinutes = 4;
    const readyMs = nowMs + orderPizzas * bakeMinutes * 60_000;
    const firstSlotMs = roundUpToNearest5(Math.max(readyMs, nowMs + 5 * 60_000));
    const lastPickupMs = firstSlotMs + 3 * 60 * 60_000; // 3-hour window
    const slots: string[] = [];
    for (let t = firstSlotMs; t <= lastPickupMs && slots.length < 12; t += 15 * 60_000) {
      slots.push(new Date(t).toISOString());
    }
    return NextResponse.json({ slots });
  }

  // Fetch service night
  const { data: rawNight } = await supabase
    .from("service_nights")
    .select(
      "service_date, service_start, last_pickup, order_open_at, order_close_at, is_enabled"
    )
    .eq("id", serviceNightId)
    .single();

  if (!rawNight) {
    return NextResponse.json(
      { error: "Service night not found" },
      { status: 404 }
    );
  }

  const night = rawNight as {
    service_date: string;
    service_start: string;
    last_pickup: string;
    order_open_at: string;
    order_close_at: string;
    is_enabled: boolean;
  };

  // Verify ordering window is open (dev: bypass with dev_window=open cookie)
  const now = new Date().toISOString();
  let devWindowOpen = false;
  if (isDevTools) {
    const cookieStore = await cookies();
    devWindowOpen = cookieStore.get("dev_window")?.value === "open";
  }
  if (
    !devWindowOpen &&
    (!night.is_enabled ||
      night.order_open_at > now ||
      now > night.order_close_at)
  ) {
    return NextResponse.json(
      { error: "Ordering is not open" },
      { status: 400 }
    );
  }

  // Pizzas queued ahead = sum of quantities on new/making orders for this night
  const { data: activeOrders } = await supabase
    .from("orders")
    .select("id")
    .eq("service_night_id", serviceNightId)
    .in("status", ["new", "making"]);

  let queuedAhead = 0;
  const orderIds = ((activeOrders ?? []) as { id: string }[]).map((o) => o.id);

  if (orderIds.length > 0) {
    const { data: items } = await supabase
      .from("order_items")
      .select("quantity")
      .in("order_id", orderIds);

    queuedAhead = ((items ?? []) as { quantity: number }[]).reduce(
      (sum, item) => sum + item.quantity,
      0
    );
  }

  // Bake minutes from settings
  const { data: rawSettings } = await supabase
    .from("settings")
    .select("bake_minutes")
    .limit(1)
    .single();

  const bakeMinutes =
    (rawSettings as { bake_minutes: number } | null)?.bake_minutes ?? 4;

  // Dev: add simulated queue size from cookie
  if (process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_DEV_TOOLS === "1") {
    const cookieStore = await cookies();
    const devQueue = parseInt(cookieStore.get("dev_queue")?.value ?? "0");
    if (!isNaN(devQueue) && devQueue > 0) queuedAhead += devQueue;
  }

  // Compute earliest ready time
  const serviceStartMs = serviceTimeMs(night.service_date, night.service_start);
  const lastPickupMs = serviceTimeMs(night.service_date, night.last_pickup);

  const readyMs =
    serviceStartMs + (queuedAhead + orderPizzas) * bakeMinutes * 60_000;

  const earliestSlotMs = roundUpToNearest5(readyMs);
  const firstSlotMs = Math.max(earliestSlotMs, serviceStartMs);

  // Generate slots: 15-min increments up to last pickup, max 12
  const slots: string[] = [];
  const fifteen = 15 * 60_000;

  for (
    let t = firstSlotMs;
    t <= lastPickupMs && slots.length < 12;
    t += fifteen
  ) {
    slots.push(new Date(t).toISOString());
  }

  return NextResponse.json({ slots });
}
