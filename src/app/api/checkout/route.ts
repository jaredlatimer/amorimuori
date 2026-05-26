import { NextResponse } from "next/server";
import Stripe from "stripe";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const DEV_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += DEV_CHARS[Math.floor(Math.random() * DEV_CHARS.length)];
  }
  return code;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { serviceNightId, quantities, pickupSlot, tipPct, name, phone, email } =
    body as {
      serviceNightId: string;
      quantities: Record<string, number>;
      pickupSlot: string;
      tipPct: number | null;
      name: string;
      phone: string;
      email: string;
    };

  if (!serviceNightId || !quantities || !pickupSlot || !name || !phone || !email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const isDevMock =
    (process.env.NODE_ENV === "development" ||
      process.env.NEXT_PUBLIC_DEV_TOOLS === "1") &&
    serviceNightId === "dev-mock";

  const supabase = await createServiceClient();
  const now = new Date().toISOString();

  // ── Validate service night ────────────────────────────────────────────────────
  if (!isDevMock) {
    // Dev: bypass ordering window when dev_window=open cookie is set
    const isDevTools =
      process.env.NODE_ENV === "development" ||
      process.env.NEXT_PUBLIC_DEV_TOOLS === "1";
    let devWindowOpen = false;
    if (isDevTools) {
      const cookieStore = await cookies();
      devWindowOpen = cookieStore.get("dev_window")?.value === "open";
    }

    if (!devWindowOpen) {
      const { data: night } = await supabase
        .from("service_nights")
        .select("is_enabled, order_open_at, order_close_at")
        .eq("id", serviceNightId)
        .single();

      if (
        !night ||
        !night.is_enabled ||
        night.order_open_at > now ||
        now > night.order_close_at
      ) {
        return NextResponse.json({ error: "Ordering is not open" }, { status: 400 });
      }
    }
  }

  // ── Fetch pizza prices from DB — never trust the client ───────────────────────
  const pizzaIds = Object.keys(quantities).filter(
    (id) => (quantities[id] ?? 0) > 0
  );
  if (pizzaIds.length === 0) {
    return NextResponse.json({ error: "No pizzas selected" }, { status: 400 });
  }

  const { data: pizzas, error: pizzaError } = await supabase
    .from("pizzas")
    .select("id, name, price_cents, is_active")
    .in("id", pizzaIds);

  if (pizzaError || !pizzas || pizzas.length !== pizzaIds.length) {
    return NextResponse.json({ error: "Invalid pizza selection" }, { status: 400 });
  }

  const typedPizzas = (pizzas as { id: string; name: string; price_cents: number; is_active: boolean }[]);

  const unavailable = typedPizzas.find((p) => !p.is_active);
  if (unavailable) {
    return NextResponse.json(
      { error: `${unavailable.name} is no longer available` },
      { status: 400 }
    );
  }

  // Check sold-out overrides (server-enforced — cannot be bypassed by client)
  if (!isDevMock) {
    const { data: nightOverrides } = await supabase
      .from("service_nights")
      .select("sold_out_overrides")
      .eq("id", serviceNightId)
      .single();
    const overrides = ((nightOverrides as { sold_out_overrides: Record<string, boolean> } | null)?.sold_out_overrides ?? {}) as Record<string, boolean>;
    const soldOut = typedPizzas.find((p) => overrides[p.id] === true);
    if (soldOut) {
      return NextResponse.json({ error: `${soldOut.name} is sold out` }, { status: 400 });
    }
  }

  // ── Calculate totals server-side ───────────────────────────────────────────────
  let subtotalCents = 0;
  const lineItems = typedPizzas.map((pizza) => {
    const q = quantities[pizza.id] ?? 0;
    subtotalCents += pizza.price_cents * q;
    return { pizza, qty: q };
  });

  const tipAmt =
    tipPct != null ? Math.round(subtotalCents * (tipPct / 100)) : 0;
  const totalCents = subtotalCents + tipAmt;

  if (totalCents <= 0) {
    return NextResponse.json({ error: "Invalid total" }, { status: 400 });
  }

  // ── Generate unique order code ────────────────────────────────────────────────
  let code = "";
  for (let attempt = 0; attempt < 10; attempt++) {
    code = generateCode();
    const { data: existing } = await supabase
      .from("orders")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (!existing) break;
  }

  // ── Cancellation window: count back from pickup by bake time + 5-min buffer ──
  const { data: settings } = await supabase
    .from("settings")
    .select("bake_minutes")
    .single();
  const bakeMinutes = (settings as { bake_minutes: number } | null)?.bake_minutes ?? 4;
  const totalPizzas = lineItems.reduce((sum, { qty }) => sum + qty, 0);
  const BUFFER_MS = 5 * 60 * 1000;
  const cancellableUntil = new Date(
    Math.max(Date.now(), new Date(pickupSlot).getTime() - totalPizzas * bakeMinutes * 60 * 1000 - BUFFER_MS)
  ).toISOString();

  // ── Insert pending_payment order ──────────────────────────────────────────────

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      service_night_id: isDevMock ? null : serviceNightId,
      code,
      customer_name: name,
      customer_phone: phone,
      customer_email: email,
      pickup_at: pickupSlot,
      status: "pending_payment",
      subtotal_cents: subtotalCents,
      tip_cents: tipAmt,
      total_cents: totalCents,
      cancellable_until: cancellableUntil,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("Order insert error:", orderError);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }

  // ── Insert order items ────────────────────────────────────────────────────────
  const items = lineItems.map(({ pizza, qty }) => ({
    order_id: order.id,
    pizza_id: pizza.id,
    pizza_name: pizza.name,
    unit_price_cents: pizza.price_cents,
    quantity: qty,
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(items);

  if (itemsError) {
    console.error("Order items error:", itemsError);
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: "Failed to save order items" }, { status: 500 });
  }

  // ── Create Stripe PaymentIntent ───────────────────────────────────────────────
  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: "usd",
      metadata: {
        order_id: order.id,
        order_code: code,
        service_night_id: serviceNightId,
      },
      receipt_email: email,
      description: `Amori Muori — Order ${code}`,
      automatic_payment_methods: { enabled: true },
    });
  } catch (stripeErr) {
    console.error("Stripe PaymentIntent error:", stripeErr);
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: "Payment setup failed" }, { status: 500 });
  }

  // Store the PI id on the order (best-effort)
  await supabase
    .from("orders")
    .update({ stripe_payment_intent_id: paymentIntent.id })
    .eq("id", order.id);

  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
    orderId: order.id,
    code,
    totalCents,
  });
}
