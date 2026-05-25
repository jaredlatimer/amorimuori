import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export interface PizzaAvailability {
  id: string;
  remaining: number;
  soldOut: boolean;
}

export interface ActiveServiceNight {
  id: string;
  service_date: string;
  order_open_at: string;
  order_close_at: string;
  nightly_total: number;
  service_start: string;
  last_pickup: string;
}

export interface AvailabilityData {
  isOpen: boolean;
  serviceNight: ActiveServiceNight | null;
  nextOpenAt: string | null;
  pizzaAvailability: Record<string, PizzaAvailability>;
  poolRemaining: number;
}

interface ServiceNightRow {
  id: string;
  service_date: string;
  nightly_total: number;
  service_start: string;
  last_pickup: string;
  order_open_at: string;
  order_close_at: string;
  sold_out_overrides: Record<string, boolean>;
}

interface OrderRow {
  id: string;
}

interface OrderItemRow {
  pizza_id: string;
  quantity: number;
}

interface PizzaRow {
  id: string;
  nightly_cap: number;
}

export async function getAvailability(): Promise<AvailabilityData> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const isDev = process.env.NODE_ENV === "development";
  const cookieStore = isDev ? await cookies() : null;
  const windowOverride = cookieStore?.get("dev_window")?.value ?? "auto";

  // Nearest enabled service night whose ordering window hasn't closed yet
  const { data: rawNight } = await supabase
    .from("service_nights")
    .select(
      "id, service_date, nightly_total, service_start, last_pickup, order_open_at, order_close_at, sold_out_overrides"
    )
    .eq("is_enabled", true)
    .gt("order_close_at", now)
    .order("service_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  let serviceNight = rawNight as ServiceNightRow | null;

  // Dev: synthesize a mock service night so the window override always works
  // even when no real service nights exist in the DB yet.
  if (!serviceNight && isDev && windowOverride === "open") {
    const today = new Date().toISOString().slice(0, 10);
    serviceNight = {
      id: "dev-mock",
      service_date: today,
      nightly_total: 50,
      service_start: "18:00",
      last_pickup: "21:00",
      order_open_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      order_close_at: new Date(Date.now() + 86400000 * 3).toISOString(),
      sold_out_overrides: {},
    };
  }

  if (!serviceNight) {
    return {
      isOpen: false,
      serviceNight: null,
      nextOpenAt: null,
      pizzaAvailability: {},
      poolRemaining: 0,
    };
  }

  let isOpen =
    serviceNight.order_open_at <= now && now <= serviceNight.order_close_at;

  if (isDev && windowOverride === "open") isOpen = true;
  if (isDev && windowOverride === "closed") isOpen = false;

  // Confirmed order IDs for this night (cancelled orders excluded)
  const { data: rawOrders } = await supabase
    .from("orders")
    .select("id")
    .eq("service_night_id", serviceNight.id)
    .neq("status", "cancelled");

  const orders = (rawOrders ?? []) as OrderRow[];
  const orderIds = orders.map((o) => o.id);

  const pizzaQtys: Record<string, number> = {};
  let totalConfirmed = 0;

  if (orderIds.length > 0) {
    const { data: rawItems } = await supabase
      .from("order_items")
      .select("pizza_id, quantity")
      .in("order_id", orderIds);

    const items = (rawItems ?? []) as OrderItemRow[];
    for (const item of items) {
      pizzaQtys[item.pizza_id] =
        (pizzaQtys[item.pizza_id] ?? 0) + item.quantity;
      totalConfirmed += item.quantity;
    }
  }

  const poolRemaining = Math.max(
    0,
    serviceNight.nightly_total - totalConfirmed
  );

  // Per-pizza remaining
  const { data: rawPizzas } = await supabase
    .from("pizzas")
    .select("id, nightly_cap")
    .eq("is_active", true);

  const pizzas = (rawPizzas ?? []) as PizzaRow[];
  const soldOutOverrides = (serviceNight.sold_out_overrides ?? {}) as Record<
    string,
    boolean
  >;

  const pizzaAvailability: Record<string, PizzaAvailability> = {};

  for (const pizza of pizzas) {
    const confirmed = pizzaQtys[pizza.id] ?? 0;
    const soldOut = soldOutOverrides[pizza.id] === true;
    const capRemaining = pizza.nightly_cap - confirmed;
    const remaining = soldOut
      ? 0
      : Math.max(0, Math.min(capRemaining, poolRemaining));
    pizzaAvailability[pizza.id] = { id: pizza.id, remaining, soldOut };
  }

  return {
    isOpen,
    serviceNight: {
      id: serviceNight.id,
      service_date: serviceNight.service_date,
      order_open_at: serviceNight.order_open_at,
      order_close_at: serviceNight.order_close_at,
      nightly_total: serviceNight.nightly_total,
      service_start: serviceNight.service_start,
      last_pickup: serviceNight.last_pickup,
    },
    nextOpenAt: !isOpen ? serviceNight.order_open_at : null,
    pizzaAvailability,
    poolRemaining,
  };
}
