import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { INQUIRY_STATUSES, type InquiryStatus } from "@/lib/event-packages";

export async function POST(request: Request) {
  // Verify admin is authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { inquiryId, status } = (body ?? {}) as { inquiryId?: string; status?: InquiryStatus };
  if (!inquiryId || !INQUIRY_STATUSES.some((s) => s.id === status)) {
    return NextResponse.json({ error: "Missing inquiryId or status" }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data, error } = await service
    .from("catering_inquiries")
    .update({ status, status_updated_at: new Date().toISOString() })
    .eq("id", inquiryId)
    .select("id, status, status_updated_at")
    .maybeSingle();

  if (error) {
    console.error("Event inquiry status error:", error);
    const missingColumn = error.code === "PGRST204" || error.code === "42703";
    return NextResponse.json(
      { error: missingColumn ? "Run migration 011_events.sql first" : "Failed to update" },
      { status: 500 }
    );
  }
  if (!data) return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });

  return NextResponse.json({ ok: true, inquiry: data });
}
