import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Admin "Cancel & refund": refunds the order's card payment in full through Stripe,
 * then marks the order refunded. No cancellation-window limit (unlike the customer
 * self-cancel route). Orders without a PaymentIntent (cash walk-ins) must use the
 * plain Cancel action instead.
 */
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
  const orderId = typeof body?.orderId === "string" ? body.orderId : "";
  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  const service = await createServiceClient();

  const { data: order, error: fetchErr } = await service
    .from("orders")
    .select("id, status, total_cents, stripe_payment_intent_id")
    .eq("id", orderId)
    .single();

  if (fetchErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const o = order as {
    id: string;
    status: string;
    total_cents: number;
    stripe_payment_intent_id: string | null;
  };

  if (o.status === "cancelled" || o.status === "refunded") {
    return NextResponse.json(
      { error: `Order is already ${o.status}` },
      { status: 400 }
    );
  }

  if (o.status === "pending_payment") {
    return NextResponse.json(
      { error: "Order was never paid, so there is nothing to refund" },
      { status: 400 }
    );
  }

  if (!o.stripe_payment_intent_id) {
    return NextResponse.json(
      {
        error:
          "This order has no card payment on file (cash or walk-in). Use Cancel (no refund) instead.",
      },
      { status: 400 }
    );
  }

  let refundedCents = o.total_cents;
  try {
    const refund = await stripe.refunds.create(
      {
        payment_intent: o.stripe_payment_intent_id,
        metadata: { order_id: o.id, refunded_by: user.id },
      },
      { idempotencyKey: `admin-refund-${o.id}` }
    );
    refundedCents = refund.amount;
  } catch (stripeErr) {
    console.error("Admin Stripe refund error:", stripeErr);
    const message =
      stripeErr instanceof Error ? stripeErr.message : "Stripe refund failed";
    return NextResponse.json(
      { error: `Refund failed: ${message}. The order was not changed.` },
      { status: 502 }
    );
  }

  const { error: updateErr } = await service
    .from("orders")
    .update({ status: "refunded" })
    .eq("id", o.id);

  if (updateErr) {
    // The money has already gone back; surface this so the admin knows the order row lags.
    console.error("Order refunded in Stripe but status update failed:", updateErr);
    return NextResponse.json(
      {
        error:
          "The card was refunded, but the order status couldn't be updated. Refresh and try again; the card will not be refunded twice.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, refundedCents });
}
