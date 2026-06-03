import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { sendConfirmationEmail, sendAdminOrderNotification } from "@/lib/email";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const supabase = await createServiceClient();

    // Find the order + items by stripe_payment_intent_id
    const { data: order } = await supabase
      .from("orders")
      .select("id, code, customer_name, customer_email, customer_phone, pickup_at, subtotal_cents, tip_cents, total_cents, status")
      .eq("stripe_payment_intent_id", pi.id)
      .single();

    if (!order) {
      console.error(`No order found for PaymentIntent ${pi.id}`);
      // Still return 200 — Stripe shouldn't retry for a missing order
      return NextResponse.json({ received: true });
    }

    // Idempotency: skip if already confirmed
    if ((order as { status: string }).status !== "pending_payment") {
      return NextResponse.json({ received: true });
    }

    // Transition to 'new' (visible to kitchen)
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "new" })
      .eq("id", (order as { id: string }).id);

    if (updateError) {
      console.error("Failed to confirm order:", updateError);
      // Return 500 so Stripe retries
      return NextResponse.json({ error: "DB update failed" }, { status: 500 });
    }

    const o = order as {
      id: string;
      code: string;
      customer_name: string;
      customer_email: string;
      customer_phone: string;
      pickup_at: string;
      subtotal_cents: number;
      tip_cents: number;
      total_cents: number;
    };

    console.log(`Order ${o.code} confirmed — pickup ${o.pickup_at}`);

    // Fetch order items for the email
    const { data: items } = await supabase
      .from("order_items")
      .select("pizza_name, quantity, unit_price_cents")
      .eq("order_id", o.id);

    const typedItems = (items ?? []) as { pizza_name: string; quantity: number; unit_price_cents: number }[];

    // Send confirmation email to customer
    try {
      await sendConfirmationEmail({
        to: o.customer_email,
        name: o.customer_name,
        code: o.code,
        pickupAt: o.pickup_at,
        subtotalCents: o.subtotal_cents,
        tipCents: o.tip_cents,
        totalCents: o.total_cents,
        items: typedItems,
      });
    } catch (emailErr) {
      console.error("Confirmation email failed:", emailErr);
    }

    // Notify admin
    try {
      await sendAdminOrderNotification({
        code: o.code,
        customerName: o.customer_name,
        customerPhone: o.customer_phone,
        pickupAt: o.pickup_at,
        totalCents: o.total_cents,
        items: typedItems,
      });
    } catch (emailErr) {
      console.error("Admin notification failed:", emailErr);
    }
  }

  return NextResponse.json({ received: true });
}
