import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";

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

    // Find the order by stripe_payment_intent_id
    const { data: order } = await supabase
      .from("orders")
      .select("id, code, customer_name, customer_email, pickup_at, total_cents, status")
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

    console.log(
      `Order ${(order as { code: string }).code} confirmed — pickup ${(order as { pickup_at: string }).pickup_at}`
    );

    // TODO Phase 5: send confirmation email via Resend
    // await sendConfirmationEmail({
    //   to: order.customer_email,
    //   name: order.customer_name,
    //   code: order.code,
    //   pickupAt: order.pickup_at,
    //   totalCents: order.total_cents,
    //   address: "42852 Crossbow Ct, Ashburn, VA 20147",
    // });
  }

  return NextResponse.json({ received: true });
}
