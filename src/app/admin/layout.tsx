import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "./AdminNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#3A3E43",
        color: "#F8EAD5",
        fontFamily: "var(--font-archivo), sans-serif",
      }}
    >
      <AdminNav />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 60px" }}>
        {children}
      </main>
    </div>
  );
}
