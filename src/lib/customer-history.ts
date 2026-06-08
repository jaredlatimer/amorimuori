import { createServiceClient } from "@/lib/supabase/server";

export type CustomerSegment = "first_time" | "returning" | "lapsed" | "regular";

export type CustomerHistory = {
  totalOrders: number;
  mostRecentOrderDate: string | null;
  weeksSinceLastOrder: number | null;
  isFirstOrder: boolean;
  isRegular: boolean;
  isLapsed: boolean;
  segment: CustomerSegment;
};

export async function getCustomerHistory(
  email: string,
  excludeOrderId: string
): Promise<CustomerHistory> {
  const supabase = await createServiceClient();

  const { data } = await supabase
    .from("orders")
    .select("id, placed_at")
    .eq("customer_email", email)
    .neq("id", excludeOrderId)
    .not("status", "in", '("cancelled","refunded","pending_payment")')
    .order("placed_at", { ascending: false });

  const orders = (data ?? []) as { id: string; placed_at: string }[];
  const totalOrders = orders.length;
  const mostRecentOrderDate = orders[0]?.placed_at ?? null;

  const weeksSinceLastOrder = mostRecentOrderDate
    ? Math.floor(
        (Date.now() - new Date(mostRecentOrderDate).getTime()) /
          (7 * 24 * 60 * 60 * 1000)
      )
    : null;

  const isFirstOrder = totalOrders === 0;
  const isRegular = totalOrders >= 4;
  const isLapsed =
    totalOrders >= 2 &&
    weeksSinceLastOrder !== null &&
    weeksSinceLastOrder > 4;

  // Priority order: first_time → lapsed → regular → returning
  let segment: CustomerSegment;
  if (isFirstOrder) segment = "first_time";
  else if (isLapsed) segment = "lapsed";
  else if (isRegular) segment = "regular";
  else segment = "returning";

  return {
    totalOrders,
    mostRecentOrderDate,
    weeksSinceLastOrder,
    isFirstOrder,
    isRegular,
    isLapsed,
    segment,
  };
}
