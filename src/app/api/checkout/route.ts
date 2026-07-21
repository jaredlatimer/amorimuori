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

  const { serviceNightId, quantities, pickupSlot, tipPct, name, phone, email, smsOptIn } =
    body as {
      serviceNightId: string;
      quantities: Record<string, number>;
      pickupSlot: string;
      tipPct: number | null;
      name: string;
      phone: string;
      email: string;
      smsOptIn?: boolean;
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

  // ── Validate service night (one fetch covers window + sold-out + service date) ─
  let serviceDate: string | null = null;
  let soldOutOverrides: Record<string, boolean> = {};

  if (!isDevMock) {
    const isDevTools =
      process.env.NODE_ENV === "development" ||
      process.env.NEXT_PUBLIC_DEV_TOOLS === "1";
    let devWindowOpen = false;
    if (isDevTools) {
      const cookieStore = await cookies();
      devWindowOpen = cookieStore.get("dev_window")?.value === "open";
    }

    const { data: night } = await supabase
      .from("service_nights")
      .select("is_enabled, order_open_at, order_close_at, service_date, sold_out_overrides")
      .eq("id", serviceNightId)
      .single();

    if (!devWindowOpen) {
      if (
        !night ||
        !night.is_enabled ||
        night.order_open_at > now ||
        now > night.order_close_at
      ) {
        return NextResponse.json({ error: "Ordering is not open" }, { status: 400 });
      }
    }

    const n = night as {
      service_date: string;
      sold_out_overrides: Record<string, boolean>;
    } | null;
    serviceDate = n?.service_date ?? null;
    soldOutOverrides = n?.sold_out_overrides ?? {};
  }

  // ── Fetch pizza prices from DB — never trust the client ───────────────────────
  const pizzaIds = Object.keys(quantities).filter((id) => (quantities[id] ?? 0) > 0);
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

  const typedPizzas = pizzas as { id: string; name: string; price_cents: number; is_active: boolean }[];

  const unavailable = typedPizzas.find((p) => !p.is_active);
  if (unavailable) {
    return NextResponse.json(
      { error: `${unavailable.name} is no longer available` },
      { status: 400 }
    );
  }

  // Check sold-out overrides (server-enforced — no-op for dev-mock since overrides = {})
  const soldOut = typedPizzas.find((p) => soldOutOverrides[p.id] === true);
  if (soldOut) {
    return NextResponse.json({ error: `${soldOut.name} is sold out` }, { status: 400 });
  }

  // ── Calculate totals server-side ───────────────────────────────────────────────
  let subtotalCents = 0;
  const lineItems = typedPizzas.map((pizza) => {
    const q = quantities[pizza.id] ?? 0;
    subtotalCents += pizza.price_cents * q;
    return { pizza, qty: q };
  });

  const tipAmt = tipPct != null ? Math.round(subtotalCents * (tipPct / 100)) : 0;
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

  // ── Cancellation window ───────────────────────────────────────────────────────
  // Pre-service orders (placed days before the Friday service): flat 15-min window
  // from placement — kitchen isn't running, no timing pressure.
  //
  // Same-day orders (placed while service is live): count back from pickup time
  // by bake time + 5-min buffer — now timing matters.
  //
  // Date comparison uses ET so late-night orders (UTC next-day) match correctly.

  const { data: settings } = await supabase
    .from("settings")
    .select("bake_minutes")
    .single();
  const bakeMinutes = (settings as { bake_minutes: number } | null)?.bake_minutes ?? 4;
  const totalPizzas = lineItems.reduce((sum, { qty }) => sum + qty, 0);

  const orderDateET = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const isDuringService = !isDevMock && serviceDate === orderDateET;

  const cancellableUntil = isDuringService
    ? new Date(
        Math.max(
          Date.now(),
          new Date(pickupSlot).getTime() - totalPizzas * bakeMinutes * 60 * 1000 - 5 * 60 * 1000
        )
      ).toISOString()
    : new Date(Date.now() + 15 * 60 * 1000).toISOString();

  // ── Oven window ───────────────────────────────────────────────────────────────
  // The oven is occupied from (pickup_time − pizzas × bake_minutes) until pickup_time.
  // Two orders conflict when their oven windows overlap.
  const ovenEndTime = pickupSlot;
  const ovenStartTime = new Date(
    new Date(pickupSlot).getTime() - totalPizzas * bakeMinutes * 60 * 1000
  ).toISOString();

  // ── Slot conflict check ───────────────────────────────────────────────────────
  // Reject if any active order's oven window overlaps with this one.
  if (!isDevMock) {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: ovenConflict } = await supabase
      .from("orders")
      .select("id, customer_email")
      .eq("service_night_id", serviceNightId)
      .or(
        `status.in.(new,making,ready),and(status.eq.pending_payment,placed_at.gte.${thirtyMinutesAgo})`
      )
      .not("oven_start_time", "is", null)
      .lt("oven_start_time", ovenEndTime)
      .gt("oven_end_time", ovenStartTime)
      .maybeSingle();

    if (ovenConflict && (ovenConflict as { id: string; customer_email: string }).customer_email !== email) {
      return NextResponse.json(
        { error: "That pickup time is no longer available. Please go back and choose a different slot.", slotTaken: true },
        { status: 409 }
      );
    }
  }

  // ── Reuse or create order ─────────────────────────────────────────────────────
  // If the customer already has a pending_payment order for this service night,
  // update it in place rather than creating a duplicate.
  let order: { id: string };
  let existingPiId: string | null = null;
  let isReused = false;

  const { data: existingOrder } = isDevMock
    ? { data: null }
    : await supabase
        .from("orders")
        .select("id, code, stripe_payment_intent_id")
        .eq("service_night_id", serviceNightId)
        .eq("customer_email", email)
        .eq("status", "pending_payment")
        .maybeSingle();

  if (existingOrder) {
    const existing = existingOrder as { id: string; code: string; stripe_payment_intent_id: string | null };
    existingPiId = existing.stripe_payment_intent_id;
    code = existing.code;
    isReused = true;

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        customer_name: name,
        customer_phone: phone,
        pickup_at: pickupSlot,
        subtotal_cents: subtotalCents,
        tip_cents: tipAmt,
        total_cents: totalCents,
        cancellable_until: cancellableUntil,
        stripe_payment_intent_id: null,
        sms_opt_in: smsOptIn ?? false,
        oven_start_time: ovenStartTime,
        oven_end_time: ovenEndTime,
        slot_locked_at: now,
      })
      .eq("id", existing.id);

    if (updateError) {
      console.error("Order update error:", updateError);
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
    }

    await supabase.from("order_items").delete().eq("order_id", existing.id);
    order = { id: existing.id };
  } else {
    const { data: insertedOrder, error: orderError } = await supabase
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
        sms_opt_in: smsOptIn ?? false,
        oven_start_time: ovenStartTime,
        oven_end_time: ovenEndTime,
        slot_locked_at: now,
      })
      .select("id")
      .single();

    if (orderError || !insertedOrder) {
      console.error("Order insert error:", orderError);
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    order = insertedOrder;
  }

  // ── Insert order items ────────────────────────────────────────────────────────
  const items = lineItems.map(({ pizza, qty }) => ({
    order_id: order.id,
    pizza_id: pizza.id,
    pizza_name: pizza.name,
    unit_price_cents: pizza.price_cents,
    quantity: qty,
  }));

  const { error: itemsError } = await supabase.from("order_items").insert(items);

  if (itemsError) {
    console.error("Order items error:", itemsError);
    if (!isReused) await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: "Failed to save order items" }, { status: 500 });
  }

  // Cancel the previous Stripe PaymentIntent if we're reusing an order
  if (existingPiId) {
    try {
      await stripe.paymentIntents.cancel(existingPiId);
    } catch {
      // Best-effort — don't block checkout if cancel fails
    }
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
      payment_method_types: ["card"],
    });
  } catch (stripeErr) {
    console.error("Stripe PaymentIntent error:", stripeErr);
    if (!isReused) await supabase.from("orders").delete().eq("id", order.id);
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
