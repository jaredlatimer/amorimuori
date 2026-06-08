import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getCustomerHistory } from "@/lib/customer-history";
import { generatePostPickupCopy, SUBJECT_LINES } from "@/lib/post-pickup-copy";
import { sendPostPickupEmail } from "@/lib/email";

export async function GET(request: Request) {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  // Find orders picked up 15+ minutes ago that haven't had a thank-you sent
  const { data: candidates } = await supabase
    .from("orders")
    .select("id, code, customer_name, customer_email, pickup_at, picked_up_at")
    .eq("status", "picked_up")
    .lte("picked_up_at", fifteenMinutesAgo)
    .is("post_pickup_sent_at", null)
    .not("customer_email", "eq", "");

  const orders = (candidates ?? []) as {
    id: string;
    code: string;
    customer_name: string;
    customer_email: string;
    pickup_at: string;
    picked_up_at: string;
  }[];

  // Early exit if nothing to do
  if (orders.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  let sent = 0;

  for (const order of orders) {
    try {
      // Fetch items for this order
      const { data: items } = await supabase
        .from("order_items")
        .select("pizza_name, quantity")
        .eq("order_id", order.id);

      const typedItems = (items ?? []) as { pizza_name: string; quantity: number }[];
      const pizzaList = typedItems.map((i) => `${i.quantity}× ${i.pizza_name}`).join(", ");

      // Get customer history and generate copy
      const history = await getCustomerHistory(order.customer_email, order.id);
      const copy = await generatePostPickupCopy(history, pizzaList);

      // Mark as sent first (idempotency — prevents double-send if email fails)
      await supabase
        .from("orders")
        .update({ post_pickup_sent_at: new Date().toISOString(), post_pickup_copy: copy })
        .eq("id", order.id);

      // Send the email
      await sendPostPickupEmail({
        to: order.customer_email,
        name: order.customer_name,
        code: order.code,
        introCopy: copy,
        subject: SUBJECT_LINES[history.segment],
      });

      sent++;
    } catch (err) {
      console.error(`Post-pickup email failed for order ${order.code}:`, err);
    }
  }

  return NextResponse.json({ sent });
}
