import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";

  if (!code) {
    return NextResponse.json({ error: "Order code required" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, status, cancellable_until, total_cents, stripe_payment_intent_id")
    .eq("code", code)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const o = order as {
    id: string;
    status: string;
    cancellable_until: string;
    total_cents: number;
    stripe_payment_intent_id: string | null;
  };

  if (o.status === "cancelled" || o.status === "refunded") {
    return NextResponse.json({ error: "Order is already cancelled" }, { status: 400 });
  }

  if (o.status !== "new") {
    return NextResponse.json(
      { error: "Order cannot be cancelled — it's already being prepared" },
      { status: 400 }
    );
  }

  const now = new Date();
  if (new Date(o.cancellable_until) <= now) {
    return NextResponse.json(
      { error: "Cancellation window has closed" },
      { status: 400 }
    );
  }

  // Issue Stripe refund
  if (o.stripe_payment_intent_id) {
    try {
      await stripe.refunds.create({ payment_intent: o.stripe_payment_intent_id });
    } catch (stripeErr) {
      console.error("Stripe refund error:", stripeErr);
      return NextResponse.json({ error: "Refund failed — please contact us" }, { status: 500 });
    }
  }

  // Mark order cancelled
  await supabase.from("orders").update({ status: "cancelled" }).eq("id", o.id);

  return NextResponse.json({ ok: true, refunded: o.total_cents });
}
