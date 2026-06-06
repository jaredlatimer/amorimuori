import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendPaymentLink } from "@/lib/sms";
import { sendPaymentLinkEmail } from "@/lib/email";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const ET_OFFSET = "-04:00";

function serviceTimeMs(date: string, time: string): number {
  return new Date(`${date}T${time.slice(0, 5)}:00${ET_OFFSET}`).getTime();
}

function roundUpToNearest5(ms: number): number {
  return Math.ceil(ms / (5 * 60_000)) * (5 * 60_000);
}

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateCode(): string {
  return Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join("");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { serviceNightId, quantities, name, phone, email, paymentMethod } = (body ?? {}) as {
    serviceNightId?: string;
    quantities?: Record<string, number>;
    name?: string;
    phone?: string;
    email?: string;
    paymentMethod?: "cash" | "link";
  };

  if (!serviceNightId || !quantities || !name?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const pizzaIds = Object.entries(quantities)
    .filter(([, q]) => (q ?? 0) > 0)
    .map(([id]) => id);

  if (pizzaIds.length === 0) {
    return NextResponse.json({ error: "No pizzas selected" }, { status: 400 });
  }

  const service = await createServiceClient();

  // Fetch service night
  const { data: rawNight } = await service
    .from("service_nights")
    .select("service_date, service_start, last_pickup, nightly_total, sold_out_overrides")
    .eq("id", serviceNightId)
    .single();

  if (!rawNight) return NextResponse.json({ error: "Service night not found" }, { status: 404 });

  const night = rawNight as {
    service_date: string; service_start: string; last_pickup: string;
    nightly_total: number; sold_out_overrides: Record<string, boolean>;
  };

  // Fetch pizzas (never trust client prices)
  const { data: rawPizzas } = await service
    .from("pizzas")
    .select("id, name, price_cents, nightly_cap, is_active")
    .in("id", pizzaIds);

  const pizzas = (rawPizzas ?? []) as { id: string; name: string; price_cents: number; nightly_cap: number; is_active: boolean }[];
  if (pizzas.length !== pizzaIds.length) {
    return NextResponse.json({ error: "Invalid pizza selection" }, { status: 400 });
  }

  const inactive = pizzas.find(p => !p.is_active);
  if (inactive) return NextResponse.json({ error: `${inactive.name} is unavailable` }, { status: 400 });

  // Current inventory for this night
  const { data: existingOrders } = await service
    .from("orders").select("id")
    .eq("service_night_id", serviceNightId)
    .not("status", "in", '("cancelled","refunded")');

  const existingIds = ((existingOrders ?? []) as { id: string }[]).map(o => o.id);
  const pizzaQtys: Record<string, number> = {};
  let totalConfirmed = 0;

  if (existingIds.length > 0) {
    const { data: items } = await service
      .from("order_items").select("pizza_id, quantity").in("order_id", existingIds);
    for (const item of (items ?? []) as { pizza_id: string; quantity: number }[]) {
      pizzaQtys[item.pizza_id] = (pizzaQtys[item.pizza_id] ?? 0) + item.quantity;
      totalConfirmed += item.quantity;
    }
  }

  const poolRemaining = Math.max(0, night.nightly_total - totalConfirmed);
  const totalInOrder = pizzaIds.reduce((s, id) => s + (quantities[id] ?? 0), 0);

  if (totalInOrder > poolRemaining) {
    return NextResponse.json({ error: `Only ${poolRemaining} pizza${poolRemaining === 1 ? "" : "s"} left tonight` }, { status: 400 });
  }

  for (const pizza of pizzas) {
    const ordered = quantities[pizza.id] ?? 0;
    const capRemaining = pizza.nightly_cap - (pizzaQtys[pizza.id] ?? 0);
    if (ordered > capRemaining) {
      return NextResponse.json({ error: `Only ${capRemaining} ${pizza.name} left` }, { status: 400 });
    }
    if (night.sold_out_overrides[pizza.id] === true) {
      return NextResponse.json({ error: `${pizza.name} is sold out` }, { status: 400 });
    }
  }

  // Compute soonest pickup slot
  const { data: activeOrders } = await service
    .from("orders").select("id")
    .eq("service_night_id", serviceNightId)
    .in("status", ["new", "making"]);

  const activeIds = ((activeOrders ?? []) as { id: string }[]).map(o => o.id);
  let queuedAhead = 0;
  if (activeIds.length > 0) {
    const { data: queueItems } = await service
      .from("order_items").select("quantity").in("order_id", activeIds);
    queuedAhead = ((queueItems ?? []) as { quantity: number }[]).reduce((s, i) => s + i.quantity, 0);
  }

  const { data: rawSettings } = await service.from("settings").select("bake_minutes").limit(1).single();
  const bakeMinutes = (rawSettings as { bake_minutes: number } | null)?.bake_minutes ?? 4;

  const serviceStartMs = serviceTimeMs(night.service_date, night.service_start);
  const lastPickupMs = serviceTimeMs(night.service_date, night.last_pickup);
  const readyMs = serviceStartMs + (queuedAhead + totalInOrder) * bakeMinutes * 60_000;
  const pickupMs = Math.max(roundUpToNearest5(readyMs), serviceStartMs);

  if (pickupMs > lastPickupMs) {
    return NextResponse.json({ error: "No pickup slots available — service window is ending" }, { status: 400 });
  }

  const pickupSlot = new Date(pickupMs).toISOString();

  // Totals
  let subtotalCents = 0;
  const lineItems = pizzas.map(pizza => {
    const qty = quantities[pizza.id] ?? 0;
    subtotalCents += pizza.price_cents * qty;
    return { pizza, qty };
  });

  // Unique order code
  let code = "";
  for (let i = 0; i < 10; i++) {
    code = generateCode();
    const { data: existing } = await service.from("orders").select("id").eq("code", code).maybeSingle();
    if (!existing) break;
  }

  const isLink = paymentMethod === "link";

  // Insert order
  const { data: order, error: orderError } = await service
    .from("orders")
    .insert({
      service_night_id: serviceNightId,
      code,
      customer_name: name.trim(),
      customer_phone: phone.trim(),
      customer_email: email?.trim() ?? "",
      pickup_at: pickupSlot,
      status: isLink ? "pending_payment" : "new",
      subtotal_cents: subtotalCents,
      tip_cents: 0,
      total_cents: subtotalCents,
      stripe_payment_intent_id: null,
      cancellable_until: new Date(Date.now() + 15 * 60_000).toISOString(),
    })
    .select("id")
    .single();

  if (orderError || !order) {
    console.error("Walk-in order insert error:", orderError);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }

  const { error: itemsError } = await service.from("order_items").insert(
    lineItems.map(({ pizza, qty }) => ({
      order_id: order.id,
      pizza_id: pizza.id,
      pizza_name: pizza.name,
      unit_price_cents: pizza.price_cents,
      quantity: qty,
    }))
  );

  if (itemsError) {
    console.error("Walk-in items insert error:", itemsError);
    await service.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: "Failed to save order items" }, { status: 500 });
  }

  // Cash — done
  if (!isLink) {
    return NextResponse.json({ code, pickup_at: pickupSlot, total_cents: subtotalCents, payment: "cash" });
  }

  // Payment link — create Stripe Checkout Session
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://amorimuori.com";
  let paymentUrl = "";
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: order.id,
      customer_email: email?.trim() || undefined,
      line_items: lineItems.map(({ pizza, qty }) => ({
        price_data: {
          currency: "usd",
          unit_amount: pizza.price_cents,
          product_data: { name: pizza.name },
        },
        quantity: qty,
      })),
      payment_method_types: ["card"],
      success_url: `${appUrl}/order/confirmation?code=${code}`,
      cancel_url: `${appUrl}/`,
      expires_at: Math.floor(new Date(pickupSlot).getTime() / 1000),
      metadata: { order_id: order.id, order_code: code, walk_in: "true" },
    });
    paymentUrl = session.url ?? "";

    // Store the PaymentIntent ID — existing payment_intent.succeeded webhook handles confirmation
    if (session.payment_intent) {
      await service.from("orders").update({ stripe_payment_intent_id: session.payment_intent as string }).eq("id", order.id);
    }
  } catch (stripeErr) {
    console.error("Stripe Checkout Session error:", stripeErr);
    await service.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: "Payment setup failed" }, { status: 500 });
  }

  // Send payment link via SMS + email (both no-op gracefully if not configured)
  const customerName = name.trim();
  await sendPaymentLink(phone.trim(), customerName, code, paymentUrl).catch(() => {});
  if (email?.trim()) {
    await sendPaymentLinkEmail({ to: email.trim(), name: customerName, code, paymentUrl, pickupAt: pickupSlot, totalCents: subtotalCents }).catch(() => {});
  }

  return NextResponse.json({ code, pickup_at: pickupSlot, total_cents: subtotalCents, payment: "link", paymentUrl });
}
