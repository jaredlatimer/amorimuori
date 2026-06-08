import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendOrderInOven, sendOrderReady } from "@/lib/sms";

type OrderStatus =
  | "new"
  | "making"
  | "ready"
  | "picked_up"
  | "cancelled"
  | "refunded";

export async function POST(request: Request) {
  // Verify admin is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.orderId || !body.status) {
    return NextResponse.json({ error: "Missing orderId or status" }, { status: 400 });
  }

  const { orderId, status } = body as { orderId: string; status: OrderStatus };

  const service = await createServiceClient();

  // Fetch the order (need phone, code, pickup_at for SMS)
  const { data: order, error: fetchErr } = await service
    .from("orders")
    .select("id, code, customer_phone, pickup_at, status")
    .eq("id", orderId)
    .single();

  if (fetchErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const typedOrder = order as {
    id: string;
    code: string;
    customer_phone: string;
    pickup_at: string;
    status: OrderStatus;
  };

  // Update the status — record picked_up_at timestamp when marking picked up
  const updatePayload: Record<string, unknown> = { status };
  if (status === "picked_up") {
    updatePayload.picked_up_at = new Date().toISOString();
  }

  const { error: updateErr } = await service
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId);

  if (updateErr) {
    console.error("Order status update error:", updateErr);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }

  // Fire SMS for key transitions (fire-and-forget — don't block the response)
  if (status === "making") {
    const etaMinutes = Math.max(
      1,
      Math.ceil((new Date(typedOrder.pickup_at).getTime() - Date.now()) / 60000)
    );
    sendOrderInOven(typedOrder.customer_phone, typedOrder.code, etaMinutes).catch(
      (err) => console.error("SMS (in_oven) error:", err)
    );
  } else if (status === "ready") {
    sendOrderReady(typedOrder.customer_phone, typedOrder.code).catch(
      (err) => console.error("SMS (ready) error:", err)
    );
  }

  return NextResponse.json({ ok: true });
}
