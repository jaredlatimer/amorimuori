import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { ContractView } from "@/components/ContractView";
import { BUSINESS_LEGAL_NAME, CONTRACT_REVIEW_NOTE, buildContract, readSignedContract } from "@/lib/event-contract";
import { moneyCents } from "@/lib/event-packages";
import { isMissingTable, proposalStatusLabel, type ProposalRow } from "@/lib/event-proposals";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function stamp(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit",
    timeZone: "America/New_York", timeZoneName: "short",
  });
}

// The contract as signed, for printing or saving as PDF from the browser.
// The admin layout has already checked that someone is signed in.
export default async function ProposalPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createServiceClient();
  const { data, error } = await supabase.from("event_proposals").select("*").eq("id", id).maybeSingle();
  if (error) {
    return (
      <p style={{ paddingTop: 32 }}>
        {isMissingTable(error) ? "Run migration 016_venues.sql first." : "Couldn't load this proposal. Check the server logs."}
      </p>
    );
  }
  if (!data) notFound();

  const p = data as ProposalRow;
  const sections = readSignedContract(p.signed_contract) ?? buildContract(p);

  return (
    <div style={{ paddingTop: 32, maxWidth: 820 }}>
      <style>{CSS}</style>
      <div className="pr-noprint" style={{ display: "grid", gap: 12, marginBottom: 18 }}>
        <p style={{ background: "#60403F55", border: "1px solid #C9A22766", borderRadius: 12, padding: "10px 14px", fontSize: 13.5, margin: 0 }}>
          {CONTRACT_REVIEW_NOTE}
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <a href="/admin/events" style={{ color: "#F8EAD5aa", fontSize: 14 }}>← Events</a>
          <PrintButton />
          {!p.signed_at && <span style={{ color: "#E8C24A", fontSize: 14 }}>Not signed yet: this is the current wording, not a signed copy.</span>}
        </div>
      </div>

      <article className="pr-paper">
        <h1>Event catering agreement</h1>
        <p className="pr-sub">
          {BUSINESS_LEGAL_NAME} and {p.client_name} · Status: {proposalStatusLabel(p.status)} · Total {moneyCents(p.total_cents)}, deposit{" "}
          {moneyCents(p.deposit_cents)}
        </p>
        <ContractView sections={sections} />

        <section className="pr-sig">
          <h3>Signature</h3>
          {p.signed_at ? (
            <dl>
              <dt>Signed by</dt><dd className="pr-name">{p.signed_name}</dd>
              <dt>Signed at</dt><dd>{stamp(p.signed_at)}</dd>
              <dt>IP address</dt><dd>{p.signed_ip ?? "Not recorded"}</dd>
              <dt>Browser</dt><dd>{p.signed_user_agent ?? "Not recorded"}</dd>
              <dt>How</dt><dd>Typed full name and ticked &ldquo;I agree to these terms&rdquo; on the proposal page</dd>
              {p.deposit_paid_at && (<><dt>Deposit paid</dt><dd>{stamp(p.deposit_paid_at)}</dd></>)}
              <dt>Reference</dt><dd>{p.id}</dd>
            </dl>
          ) : (
            <p>Not signed yet.</p>
          )}
        </section>
      </article>
    </div>
  );
}

const CSS = `
.pr-paper { background: #fff; color: #1d1d1d; border-radius: 6px; padding: 40px 44px; font-family: Georgia, serif; }
.pr-paper h1 { font-size: 26px; margin: 0 0 4px; }
.pr-sub { color: #555; font-size: 13px; margin: 0 0 26px; font-family: Arial, sans-serif; }
.pr-paper .contract section + section { margin-top: 16px; }
.pr-paper .contract h3, .pr-sig h3 { font-size: 15px; margin: 0 0 6px; font-family: Arial, sans-serif; }
.pr-paper .contract p { margin: 0 0 5px; line-height: 1.55; font-size: 14px; }
.pr-sig { margin-top: 30px; padding-top: 16px; border-top: 1px solid #ccc; font-size: 14px; }
.pr-sig dl { display: grid; grid-template-columns: 120px 1fr; gap: 6px 12px; margin: 0; }
.pr-sig dt { color: #555; font-family: Arial, sans-serif; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; padding-top: 2px; }
.pr-sig dd { margin: 0; overflow-wrap: anywhere; }
.pr-name { font-style: italic; font-size: 22px; }
@media print {
  .admin-side, .admin-tabbar, .admin-subnav, .pr-noprint { display: none !important; }
  .admin-shell, .admin-main { background: #fff !important; padding: 0 !important; margin: 0 !important; }
  .pr-paper { padding: 0; border-radius: 0; }
}
`;
