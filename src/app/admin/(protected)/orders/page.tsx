import { redirect } from "next/navigation";
import { defaultNightId } from "@/lib/default-night";

export const dynamic = "force-dynamic";

// Orders now live on each night's page; this keeps old links working
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ nightId?: string }>;
}) {
  const { nightId } = await searchParams;
  const id = nightId ?? (await defaultNightId());
  redirect(id ? `/admin/nights/${id}?tab=orders` : "/admin/nights");
}
