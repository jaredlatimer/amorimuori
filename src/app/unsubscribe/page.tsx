import { createServiceClient } from "@/lib/supabase/server";
import { verifyUnsubscribeSig } from "@/lib/email";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; sig?: string }>;
}) {
  const { email, sig } = await searchParams;

  let status: "success" | "invalid" | "already" = "invalid";

  if (email && sig && verifyUnsubscribeSig(email, sig)) {
    const supabase = await createServiceClient();
    const { error } = await supabase
      .from("email_unsubscribes")
      .upsert({ email: email.toLowerCase().trim() }, { onConflict: "email" });

    status = error ? "invalid" : "success";
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#484D52",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        fontFamily: "var(--font-archivo), sans-serif",
      }}
    >
      <div
        style={{
          background: "#F8EAD5",
          borderRadius: 20,
          padding: "40px 32px",
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
        }}
      >
        {status === "success" ? (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
            <h1
              style={{
                margin: "0 0 12px",
                fontSize: 24,
                fontWeight: 900,
                color: "#484D52",
                fontFamily: "Georgia, serif",
              }}
            >
              You&rsquo;re unsubscribed
            </h1>
            <p style={{ margin: 0, fontSize: 15, color: "#484D5299", lineHeight: 1.6 }}>
              You won&rsquo;t receive any more marketing emails from Amori Muori.
            </p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✕</div>
            <h1
              style={{
                margin: "0 0 12px",
                fontSize: 24,
                fontWeight: 900,
                color: "#484D52",
                fontFamily: "Georgia, serif",
              }}
            >
              Invalid link
            </h1>
            <p style={{ margin: 0, fontSize: 15, color: "#484D5299", lineHeight: 1.6 }}>
              This unsubscribe link is invalid or has expired. Reply to any email from us to unsubscribe.
            </p>
          </>
        )}
        <a
          href="/"
          style={{
            display: "inline-block",
            marginTop: 28,
            fontSize: 14,
            color: "#2F7D4F",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          ← Back to Amori Muori
        </a>
      </div>
    </div>
  );
}
