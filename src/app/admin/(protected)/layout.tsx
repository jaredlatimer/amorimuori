import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminNav, AdminSubnav } from "../AdminNav";

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
      className="admin-shell"
      style={{
        minHeight: "100vh",
        background: "#3A3E43",
        color: "#F8EAD5",
        fontFamily: "var(--font-archivo), sans-serif",
      }}
    >
      <AdminNav />
      <main className="admin-main">
        <AdminSubnav />
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>{children}</div>
      </main>
    </div>
  );
}
