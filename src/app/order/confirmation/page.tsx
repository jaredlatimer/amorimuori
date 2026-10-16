import { Suspense } from "react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getOrCreateReferralCode } from "@/lib/referrals";
import { ConfirmationContent } from "./ConfirmationContent";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string>>;
}

async function ConfirmationLoader({ code }: { code: string }) {
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, code, customer_name, pickup_at, status, subtotal_cents, tip_cents, total_cents, cancellable_until, discount_cents, bundle_discount_cents, referral_kind"
    )
    .eq("code", code)
    .single();

  const { data: items } = order
    ? await supabase
        .from("order_items")
        .select("pizza_name, quantity, unit_price_cents")
        .eq("order_id", order.id)
    : { data: [] };

  // The customer's own code to share, once the order is paid
  let referralCode: string | null = null;
  if (order && order.status !== "pending_payment") {
    const service = await createServiceClient();
    const { data: owner } = await service
      .from("orders")
      .select("customer_email, customer_name")
      .eq("id", order.id)
      .single();
    const o = owner as { customer_email: string; customer_name: string } | null;
    if (o) referralCode = await getOrCreateReferralCode(service, o.customer_email, o.customer_name);
  }

  return (
    <ConfirmationContent
      referralCode={referralCode}
      order={
        order as {
          id: string;
          code: string;
          customer_name: string;
          pickup_at: string;
          status: string;
          subtotal_cents: number;
          tip_cents: number;
          total_cents: number;
          cancellable_until: string;
          discount_cents: number | null;
          bundle_discount_cents: number | null;
          referral_kind: string | null;
        } | null
      }
      items={
        (items ?? []) as {
          pizza_name: string;
          quantity: number;
          unit_price_cents: number;
        }[]
      }
    />
  );
}

export default async function ConfirmationPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const code = params.code ?? "";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#484D52",
        color: "#F8EAD5",
        fontFamily: "var(--font-archivo), sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      {!code ? (
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#F8EAD599" }}>No order found.</p>
          <a
            href="/order"
            style={{ color: "#2F7D4F", textDecoration: "none", marginTop: 16, display: "block" }}
          >
            ← Back to order
          </a>
        </div>
      ) : (
        <Suspense
          fallback={
            <div style={{ color: "#F8EAD566", fontSize: 18 }}>
              Confirming your order…
            </div>
          }
        >
          <ConfirmationLoader code={code} />
        </Suspense>
      )}
    </div>
  );
}
