import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { sendConfirmationEmail, sendAdminOrderNotification } from "@/lib/email";
import { getCustomerHistory } from "@/lib/customer-history";
import { generateConfirmationCopy, SUBJECT_LINES } from "@/lib/confirmation-copy";
import { getOrCreateReferralCode, redeemReferralReward } from "@/lib/referrals";
import { handleEventDeposit, isEventDepositEvent } from "@/lib/event-deposit";

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

  // Event deposits (metadata.kind = "event_deposit") are handled on their own
  // and return here, so the pizza order logic below never sees them.
  if (isEventDepositEvent(event)) {
    const ok = await handleEventDeposit(event);
    // 500 makes Stripe retry
    return ok
      ? NextResponse.json({ received: true })
      : NextResponse.json({ error: "DB update failed" }, { status: 500 });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const supabase = await createServiceClient();

    // Find the order + items by stripe_payment_intent_id
    const { data: order } = await supabase
      .from("orders")
      .select("id, code, customer_name, customer_email, customer_phone, pickup_at, subtotal_cents, tip_cents, total_cents, status, discount_cents, referral_kind, referral_reward_id")
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
      discount_cents: number | null;
      referral_kind: string | null;
      referral_reward_id: string | null;
    };

    // Referral BOGO: use up the reward this order applied, and make sure the
    // customer has their own code to share
    if (o.referral_reward_id) {
      await redeemReferralReward(supabase, o.referral_reward_id, o.id);
    }
    const referralCode = await getOrCreateReferralCode(supabase, o.customer_email, o.customer_name);

    console.log(`Order ${o.code} confirmed — pickup ${o.pickup_at}`);

    // Fetch order items for the email
    const { data: items } = await supabase
      .from("order_items")
      .select("pizza_name, quantity, unit_price_cents")
      .eq("order_id", o.id);

    const typedItems = (items ?? []) as { pizza_name: string; quantity: number; unit_price_cents: number }[];

    const pizzaList = typedItems
      .map((i) => `${i.quantity}× ${i.pizza_name}`)
      .join(", ");

    const pickupTime = new Date(o.pickup_at).toLocaleTimeString("en-US", {
      hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
    });

    // Generate segmented intro copy + send confirmation email in parallel
    const [history, confirmationCopy] = await (async () => {
      const h = await getCustomerHistory(o.customer_email, o.id);
      const copy = await generateConfirmationCopy(h, pizzaList, pickupTime);
      return [h, copy] as const;
    })();

    // Store generated copy on order (best-effort)
    await supabase.from("orders").update({ confirmation_copy: confirmationCopy }).eq("id", o.id);

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
        discountCents: o.discount_cents ?? 0,
        discountLabel:
          o.referral_kind === "friend"
            ? "Friend BOGO, cheaper pizza free"
            : o.referral_kind === "reward"
            ? "Your BOGO reward, cheaper pizza free"
            : undefined,
        referralCode: referralCode ?? undefined,
        items: typedItems,
        introCopy: confirmationCopy,
        subject: SUBJECT_LINES[history.segment],
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
