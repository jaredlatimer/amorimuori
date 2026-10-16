// Stripe webhook handling for event deposits. The webhook route sends an
// event here only when its metadata.kind is EVENT_DEPOSIT_KIND, so pizza
// orders never reach this code and this code never touches orders.

import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { EVENT_DEPOSIT_KIND } from "./event-proposals";

export function isEventDepositEvent(event: Stripe.Event): boolean {
  if (event.type !== "payment_intent.succeeded" && event.type !== "checkout.session.completed") return false;
  const obj = event.data.object as { metadata?: Stripe.Metadata | null };
  return obj.metadata?.kind === EVENT_DEPOSIT_KIND;
}

/**
 * Marks the proposal Deposit paid and its inquiry Booked. Both
 * checkout.session.completed and payment_intent.succeeded can arrive for
 * the same payment; whichever comes first does the work, the other is a no-op.
 * Returns false when the database update failed, so Stripe retries.
 */
export async function handleEventDeposit(event: Stripe.Event): Promise<boolean> {
  let proposalId: string | undefined;
  let amountCents: number;
  let paymentIntentId: string | null;

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== "paid") return true; // not paid yet; nothing to do
    proposalId = session.metadata?.proposal_id;
    amountCents = session.amount_total ?? 0;
    paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  } else {
    const pi = event.data.object as Stripe.PaymentIntent;
    proposalId = pi.metadata?.proposal_id;
    amountCents = pi.amount_received;
    paymentIntentId = pi.id;
  }

  if (!proposalId) {
    console.error(`Event deposit ${event.id} has no proposal_id in metadata`);
    return true;
  }

  const supabase = await createServiceClient();
  const { data: proposal, error: loadError } = await supabase
    .from("event_proposals")
    .select("id, status, inquiry_id, deposit_cents")
    .eq("id", proposalId)
    .maybeSingle();
  if (loadError) {
    console.error("Event deposit load error:", loadError);
    return false;
  }
  if (!proposal) {
    console.error(`No event proposal ${proposalId} for deposit ${event.id}`);
    return true;
  }

  const p = proposal as { id: string; status: string; inquiry_id: string | null; deposit_cents: number };
  if (p.status === "deposit_paid") return true; // already handled

  // The session was created for exactly deposit_cents; anything else needs a human look
  if (amountCents !== p.deposit_cents) {
    console.error(`Event deposit amount mismatch for proposal ${p.id}: paid ${amountCents}, expected ${p.deposit_cents}`);
    return true;
  }

  const now = new Date().toISOString();

  // Inquiry first: if this fails, the proposal is still Signed and Stripe's retry does both
  if (p.inquiry_id) {
    const { error } = await supabase
      .from("catering_inquiries")
      .update({ status: "booked", status_updated_at: now })
      .eq("id", p.inquiry_id);
    if (error) {
      console.error("Inquiry booked update error:", error);
      return false;
    }
  }

  const { error: updateError } = await supabase
    .from("event_proposals")
    .update({ status: "deposit_paid", deposit_paid_at: now, stripe_payment_intent_id: paymentIntentId, updated_at: now })
    .eq("id", p.id)
    .neq("status", "deposit_paid");
  if (updateError) {
    console.error("Event deposit update error:", updateError);
    return false;
  }

  console.log(`Event deposit paid for proposal ${p.id}`);
  return true;
}
