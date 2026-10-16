import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { buildContract } from "@/lib/event-contract";
import { TOKEN_RE, type ProposalRow } from "@/lib/event-proposals";

// Public: the client signs their proposal. The token is the only key, so a
// bad or unknown token gets the same 404 and nothing about other proposals.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { token, name, agree } = (body ?? {}) as { token?: unknown; name?: unknown; agree?: unknown };

  if (typeof token !== "string" || !TOKEN_RE.test(token)) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }
  const signedName = typeof name === "string" ? name.trim().replace(/\s+/g, " ").slice(0, 120) : "";
  if (signedName.length < 2) return NextResponse.json({ error: "Please type your full name to sign." }, { status: 400 });
  if (agree !== true) return NextResponse.json({ error: "Please tick “I agree to these terms” to sign." }, { status: 400 });

  const supabase = await createServiceClient();
  const { data: found, error: loadError } = await supabase
    .from("event_proposals")
    .select("id, status, signed_at, client_name, client_email, client_phone, package, guests, event_date, start_time, end_time, location, gluten_free_count, custom_lines, dietary_notes, deposit_pct, per_guest_cents, minimum_cents")
    .eq("token", token)
    .maybeSingle();
  if (loadError) {
    console.error("Proposal sign load error:", loadError);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
  if (!found) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });

  const p = found as unknown as ProposalRow;
  if (p.signed_at || (p.status !== "draft" && p.status !== "sent")) {
    return NextResponse.json({ error: "This proposal has already been signed." }, { status: 409 });
  }

  // Freeze the exact words being agreed to, so later edits to the template don't change a signed contract
  const contract = buildContract(p);
  if (contract.length === 0) {
    return NextResponse.json({ error: "This proposal can't be signed right now. Please contact us." }, { status: 400 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    null;
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;
  const now = new Date().toISOString();

  // Only the first signature counts, even if two tabs press Sign at once
  const { data: signed, error } = await supabase
    .from("event_proposals")
    .update({
      status: "signed",
      signed_name: signedName,
      signed_at: now,
      signed_ip: ip,
      signed_user_agent: userAgent,
      signed_contract: contract,
      updated_at: now,
    })
    .eq("id", p.id)
    .is("signed_at", null)
    .in("status", ["draft", "sent"])
    .select("signed_name, signed_at")
    .maybeSingle();

  if (error) {
    console.error("Proposal sign error:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
  if (!signed) return NextResponse.json({ error: "This proposal has already been signed." }, { status: 409 });

  return NextResponse.json({ ok: true, signedName: signed.signed_name, signedAt: signed.signed_at });
}
