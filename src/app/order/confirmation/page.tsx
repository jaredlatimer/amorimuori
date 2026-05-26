import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
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
      "id, code, customer_name, pickup_at, status, subtotal_cents, tip_cents, total_cents"
    )
    .eq("code", code)
    .single();

  const { data: items } = order
    ? await supabase
        .from("order_items")
        .select("pizza_name, quantity, unit_price_cents")
        .eq("order_id", order.id)
    : { data: [] };

  return (
    <ConfirmationContent
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
