import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateReminderCopy } from "@/lib/reminder-copy";
import { sendOrdersOpenEmail } from "@/lib/email";

const ORDER_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://amorimuori.com";

export async function GET(request: Request) {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const isTest = url.searchParams.get("test") === "1";

  const supabase = await createServiceClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  // ── Find next enabled Friday ──────────────────────────────────────────────
  const { data: rawNight } = await supabase
    .from("service_nights")
    .select("id, service_date, reminder_sent_at, reminder_copy")
    .eq("is_enabled", true)
    .gte("service_date", today)
    .order("service_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!rawNight) {
    return NextResponse.json({ skipped: true, reason: "No upcoming service night" });
  }

  const night = rawNight as {
    id: string;
    service_date: string;
    reminder_sent_at: string | null;
    reminder_copy: string | null;
  };

  // ── Idempotency guard (skip in test mode) ────────────────────────────────
  if (night.reminder_sent_at && !isTest) {
    return NextResponse.json({ skipped: true, reason: "Already sent" });
  }

  // ── Active pizzas ─────────────────────────────────────────────────────────
  const { data: rawPizzas } = await supabase
    .from("pizzas")
    .select("id, name, description, price_cents, is_special, is_active, allergens, created_at")
    .eq("is_active", true)
    .order("category");

  const pizzas = (rawPizzas ?? []) as {
    id: string; name: string; description: string; price_cents: number;
    is_special: boolean; is_active: boolean; allergens: string[]; created_at: string;
  }[];

  if (pizzas.length === 0) {
    return NextResponse.json({ skipped: true, reason: "No active pizzas" });
  }

  // ── Last week's data ──────────────────────────────────────────────────────
  const { data: lastNightRaw } = await supabase
    .from("service_nights")
    .select("id, service_date, nightly_total")
    .lt("service_date", today)
    .order("service_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  let lastWeek: { soldOutPizzas: { name: string }[]; totalOrders: number; allSoldOut: boolean } | null = null;

  if (lastNightRaw) {
    const ln = lastNightRaw as { id: string; service_date: string; nightly_total: number };

    const { data: lastOrders } = await supabase
      .from("orders")
      .select("id")
      .eq("service_night_id", ln.id)
      .not("status", "in", '("cancelled","refunded","pending_payment")');

    const lastOrderIds = ((lastOrders ?? []) as { id: string }[]).map((o) => o.id);
    const totalOrders = lastOrderIds.length;

    const pizzaQtys: Record<string, number> = {};
    if (lastOrderIds.length > 0) {
      const { data: items } = await supabase
        .from("order_items")
        .select("pizza_id, quantity")
        .in("order_id", lastOrderIds);
      for (const item of (items ?? []) as { pizza_id: string; quantity: number }[]) {
        pizzaQtys[item.pizza_id] = (pizzaQtys[item.pizza_id] ?? 0) + item.quantity;
      }
    }

    // A pizza sold out if it hit its nightly_cap
    const { data: pizzaCaps } = await supabase
      .from("pizzas")
      .select("id, name, nightly_cap");

    const soldOutPizzas: { name: string }[] = [];
    for (const p of (pizzaCaps ?? []) as { id: string; name: string; nightly_cap: number }[]) {
      if ((pizzaQtys[p.id] ?? 0) >= p.nightly_cap) {
        soldOutPizzas.push({ name: p.name });
      }
    }

    const totalSold = Object.values(pizzaQtys).reduce((s, q) => s + q, 0);
    lastWeek = { soldOutPizzas, totalOrders, allSoldOut: totalSold >= ln.nightly_total };
  }

  // ── Generate copy ─────────────────────────────────────────────────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const copy = await generateReminderCopy({
    pizzas: pizzas.map((p) => ({
      name: p.name,
      description: p.description,
      isSpecial: p.is_special,
      isNew: p.created_at > sevenDaysAgo,
      allergens: p.allergens ?? [],
    })),
    lastWeek,
  });

  // Store copy on service night
  await supabase.from("service_nights").update({ reminder_copy: copy }).eq("id", night.id);

  // ── Build recipient list (deduped, excluding unsubscribes) ────────────────
  const [{ data: signups }, { data: pastCustomers }, { data: unsubs }] = await Promise.all([
    supabase.from("reminder_signups").select("email"),
    supabase.from("orders").select("customer_email").eq("status", "picked_up"),
    supabase.from("email_unsubscribes").select("email"),
  ]);

  const unsubSet = new Set(
    ((unsubs ?? []) as { email: string }[]).map((u) => u.email.toLowerCase())
  );

  const allEmails = new Set<string>();
  for (const s of (signups ?? []) as { email: string }[]) {
    if (s.email && !unsubSet.has(s.email.toLowerCase())) allEmails.add(s.email.toLowerCase());
  }
  for (const o of (pastCustomers ?? []) as { customer_email: string }[]) {
    if (o.customer_email && !unsubSet.has(o.customer_email.toLowerCase())) allEmails.add(o.customer_email.toLowerCase());
  }

  if (allEmails.size === 0) {
    return NextResponse.json({ skipped: true, reason: "No recipients" });
  }

  // ── Send in batches of 50 (test mode: only send to admin) ────────────────
  const TEST_EMAIL = process.env.ADMIN_EMAIL ?? "jared@latimerart.design";
  const emailList = isTest ? [TEST_EMAIL] : Array.from(allEmails);
  const BATCH = 50;
  let sent = 0;

  for (let i = 0; i < emailList.length; i += BATCH) {
    const chunk = emailList.slice(i, i + BATCH);
    await Promise.all(
      chunk.map((email) =>
        sendOrdersOpenEmail({
          to: email,
          introCopy: copy,
          serviceDate: night.service_date,
          pizzas: pizzas.map((p) => ({
            name: p.name,
            description: p.description,
            price_cents: p.price_cents,
            is_special: p.is_special,
            allergens: p.allergens ?? [],
          })),
          orderUrl: ORDER_URL,
        }).catch((err) => console.error(`Failed to send to ${email}:`, err))
      )
    );
    sent += chunk.length;
  }

  // ── Mark sent (skip in test mode) ────────────────────────────────────────
  if (!isTest) {
    await supabase
      .from("service_nights")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", night.id);
  }

  return NextResponse.json({ sent, recipients: isTest ? "test only" : emailList.length });
}
