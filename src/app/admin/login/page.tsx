import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/admin/orders");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#484D52",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "var(--font-archivo), sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <h1
          className="font-display"
          style={{
            fontSize: 32,
            fontWeight: 900,
            color: "#F8EAD5",
            margin: "0 0 8px",
            textAlign: "center",
          }}
        >
          Amori Muori
        </h1>
        <p
          style={{
            color: "#F8EAD566",
            textAlign: "center",
            fontSize: 15,
            margin: "0 0 32px",
          }}
        >
          Admin
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
