import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { explainProposalSteps, moneyCents } from "@/lib/event-packages";
import {
  PROPOSAL_ADMIN_COLUMNS,
  formatEventDate,
  isMissingTable,
  mathForRow,
  type AdminProposal,
} from "@/lib/event-proposals";
import { sendEventProposalEmail } from "@/lib/email";

// The owner pressed "Email to client" (via: "email") or "Copy link" (via: "link").
// Either way the proposal counts as Sent, and a New inquiry moves to Proposal sent.
// The email only goes out from here, so it only ever sends on that click.
export async function POST(request: Request) {
  // Verify admin is authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { proposalId, via } = (body ?? {}) as { proposalId?: string; via?: string };
  if (!proposalId || (via !== "email" && via !== "link")) {
    return NextResponse.json({ error: "Missing proposalId or via" }, { status: 400 });
  }

  const service = await createServiceClient();
  const { data: found, error: loadError } = await service
    .from("event_proposals")
    .select(PROPOSAL_ADMIN_COLUMNS)
    .eq("id", proposalId)
    .maybeSingle();
  if (loadError) {
    console.error("Event proposal load error:", loadError);
    return NextResponse.json(
      { error: isMissingTable(loadError) ? "Run migration 016_venues.sql first" : "Failed to load" },
      { status: 500 }
    );
  }
  if (!found) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  const p = found as unknown as AdminProposal;

  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const proposalUrl = `${SITE}/proposal/${p.token}`;

  if (via === "email") {
    const calc = mathForRow(p);
    if (!calc) return NextResponse.json({ error: "This proposal's package no longer exists" }, { status: 400 });
    try {
      await sendEventProposalEmail({
        to: p.client_email,
        name: p.client_name,
        proposalUrl,
        eventDate: formatEventDate(p.event_date),
        packageName: calc.pkg.name,
        guests: p.guests,
        mathSteps: explainProposalSteps(calc.math),
        depositLabel: moneyCents(calc.math.depositCents),
      });
    } catch (err) {
      console.error("Event proposal email failed:", err);
      return NextResponse.json({ error: "Email failed to send. Try Copy link instead." }, { status: 502 });
    }
  }

  const now = new Date().toISOString();
  let proposal: AdminProposal = p;
  if (p.status === "draft") {
    const { data } = await service
      .from("event_proposals")
      .update({ status: "sent", sent_at: now, updated_at: now })
      .eq("id", p.id)
      .eq("status", "draft")
      .select(PROPOSAL_ADMIN_COLUMNS)
      .maybeSingle();
    if (data) proposal = data as unknown as AdminProposal;
  }

  // Best-effort: move a New inquiry along to Proposal sent
  if (p.inquiry_id) {
    const { error } = await service
      .from("catering_inquiries")
      .update({ status: "proposal_sent", status_updated_at: now })
      .eq("id", p.inquiry_id)
      .eq("status", "new");
    if (error) console.error("Inquiry status update after proposal send failed:", error);
  }

  return NextResponse.json({ ok: true, proposal, url: proposalUrl, emailed: via === "email" });
}
