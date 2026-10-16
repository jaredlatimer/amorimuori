import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { findPackage } from "@/lib/event-packages";
import { EVENT_DEPOSIT_KIND, TOKEN_RE, formatEventDate } from "@/lib/event-proposals";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Public: start a Stripe Checkout for a signed proposal's deposit. The amount
// comes from the proposal row (worked out on the server when the owner saved
// it, and frozen at signing); the browser only sends the token.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { token } = (body ?? {}) as { token?: unknown };
  if (typeof token !== "string" || !TOKEN_RE.test(token)) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("event_proposals")
    .select("id, status, client_email, package, guests, event_date, deposit_cents")
    .eq("token", token)
    .maybeSingle();
  if (error) {
    console.error("Deposit load error:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });

  const p = data as {
    id: string; status: string; client_email: string; package: string; guests: number; event_date: string; deposit_cents: number;
  };
  if (p.status === "deposit_paid") return NextResponse.json({ error: "Your deposit is already paid. Thank you!" }, { status: 409 });
  if (p.status !== "signed") return NextResponse.json({ error: "Please sign the proposal first." }, { status: 400 });
  if (!Number.isInteger(p.deposit_cents) || p.deposit_cents < 50) {
    return NextResponse.json({ error: "This deposit can't be paid online. Please contact us." }, { status: 400 });
  }

  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const back = `${SITE}/proposal/${token}`;
  const pkgName = findPackage(p.package)?.name ?? "Event";
  // kind tells the webhook this is a deposit, not a pizza order
  const metadata = { kind: EVENT_DEPOSIT_KIND, proposal_id: p.id };

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: p.client_email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: p.deposit_cents,
            product_data: {
              name: `Event deposit — ${pkgName}, ${p.guests} guests`,
              description: formatEventDate(p.event_date),
            },
          },
        },
      ],
      metadata,
      payment_intent_data: {
        metadata,
        description: `Amori Muori — event deposit, ${formatEventDate(p.event_date)}`,
        receipt_email: p.client_email,
      },
      success_url: `${back}?paid=1`,
      cancel_url: back,
    });
  } catch (stripeErr) {
    console.error("Stripe deposit Checkout error:", stripeErr);
    return NextResponse.json({ error: "Payment setup failed. Please try again." }, { status: 500 });
  }

  // Best-effort: remember the session for the admin side
  await supabase.from("event_proposals").update({ stripe_checkout_session_id: session.id }).eq("id", p.id);

  return NextResponse.json({ url: session.url });
}
