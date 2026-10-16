import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { findPackage, proposalMath } from "@/lib/event-packages";
import { PROPOSAL_ADMIN_COLUMNS, isMissingTable, parseProposalInput } from "@/lib/event-proposals";

// Create a proposal from an inquiry (no id), or save changes to one that
// hasn't been signed yet (with id). Totals are worked out here from the
// package, guests, gluten free count and custom lines, never sent by the browser.
export async function POST(request: Request) {
  // Verify admin is authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const b = body as Record<string, unknown>;

  const parsed = parseProposalInput(b);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const input = parsed.value;

  // Saving re-prices at today's package price; once signed, it can't be saved again
  const pkg = findPackage(input.package)!;
  const math = proposalMath(pkg, {
    guests: input.guests,
    glutenFree: input.gluten_free_count,
    customLines: input.custom_lines,
    depositPct: input.deposit_pct,
  });
  const row = {
    ...input,
    per_guest_cents: math.perGuestCents,
    minimum_cents: math.minimumCents,
    total_cents: math.totalCents,
    deposit_cents: math.depositCents,
    updated_at: new Date().toISOString(),
  };

  const service = await createServiceClient();
  const id = typeof b.id === "string" && b.id ? b.id : null;

  const fail = (error: { code?: string } | null, what: string) => {
    console.error(`Event proposal ${what} error:`, error);
    return NextResponse.json(
      { error: isMissingTable(error) ? "Run migration 016_venues.sql first" : `Failed to ${what}` },
      { status: 500 }
    );
  };

  if (id) {
    // Once the client has signed, the terms are locked
    const { data, error } = await service
      .from("event_proposals")
      .update(row)
      .eq("id", id)
      .in("status", ["draft", "sent"])
      .select(PROPOSAL_ADMIN_COLUMNS)
      .maybeSingle();
    if (error) return fail(error, "save");
    if (!data) return NextResponse.json({ error: "Not found, or already signed (signed proposals can't be changed)" }, { status: 409 });
    return NextResponse.json({ ok: true, proposal: data });
  }

  const inquiryId = typeof b.inquiryId === "string" && b.inquiryId ? b.inquiryId : null;
  // 32 random bytes → 43 base64url characters. This is the client's only key to the page.
  const token = randomBytes(32).toString("base64url");

  const { data, error } = await service
    .from("event_proposals")
    .insert({ ...row, inquiry_id: inquiryId, token, status: "draft" })
    .select(PROPOSAL_ADMIN_COLUMNS)
    .single();
  if (error) return fail(error, "create");

  return NextResponse.json({ ok: true, proposal: data });
}
