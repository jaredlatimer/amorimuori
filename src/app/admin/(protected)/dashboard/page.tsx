import { redirect } from "next/navigation";
import { defaultNightId } from "@/lib/default-night";

export const dynamic = "force-dynamic";

// This page now lives on each night's page; this keeps old links working
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ nightId?: string }>;
}) {
  const { nightId } = await searchParams;
  const id = nightId ?? (await defaultNightId());
  redirect(id ? `/admin/nights/${id}?tab=results` : "/admin/nights");
}
