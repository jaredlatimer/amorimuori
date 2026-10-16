import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/ui/SiteShell";
import { ContractView } from "@/components/ContractView";
import { createServiceClient } from "@/lib/supabase/server";
import { buildContract, readSignedContract } from "@/lib/event-contract";
import { explainProposalSteps, moneyCents } from "@/lib/event-packages";
import {
  TOKEN_RE,
  formatEventDate,
  formatTimeWindow,
  isMissingTable,
  mathForRow,
  type ProposalRow,
} from "@/lib/event-proposals";
import { ProposalActions } from "./ProposalActions";

export const dynamic = "force-dynamic";

// The link is the key: keep it out of search engines and out of the Referer
// header when the client goes on to Stripe
export const metadata: Metadata = {
  title: "Your event proposal",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// Only what the client needs to see. Never the inquiry notes, IP or user agent.
const PUBLIC_COLUMNS =
  "id, status, client_name, client_email, client_phone, package, guests, event_date, start_time, end_time, location, " +
  "gluten_free_count, custom_lines, dietary_notes, deposit_pct, per_guest_cents, minimum_cents, total_cents, deposit_cents, " +
  "signed_name, signed_at, signed_contract, deposit_paid_at";

type PublicProposal = Pick<
  ProposalRow,
  | "id" | "status" | "client_name" | "client_email" | "client_phone" | "package" | "guests" | "event_date" | "start_time"
  | "end_time" | "location" | "gluten_free_count" | "custom_lines" | "dietary_notes" | "deposit_pct" | "per_guest_cents"
  | "minimum_cents" | "total_cents" | "deposit_cents" | "signed_name" | "signed_at" | "signed_contract" | "deposit_paid_at"
>;

export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string }>;
}) {
  const { token } = await params;
  const { paid } = await searchParams;
  if (!TOKEN_RE.test(token)) notFound();

  const supabase = await createServiceClient();
  const { data, error } = await supabase.from("event_proposals").select(PUBLIC_COLUMNS).eq("token", token).maybeSingle();

  if (error) {
    if (!isMissingTable(error)) console.error("Proposal page load error:", error);
    return (
      <SiteShell>
        <main style={{ maxWidth: 720, margin: "0 auto", padding: "60px 24px 80px" }}>
          <h1 className="font-display" style={{ fontSize: 32, fontWeight: 900 }}>Proposal unavailable</h1>
          <p style={{ color: "#F8EAD5cc", lineHeight: 1.6 }}>
            We couldn&apos;t open this proposal right now. Please try again later, or reply to the email we sent you.
          </p>
        </main>
      </SiteShell>
    );
  }
  if (!data) notFound();

  const p = data as unknown as PublicProposal;
  const calc = mathForRow(p);
  if (!calc) notFound();
  const { pkg, math } = calc;

  const signed = !!p.signed_at;
  const sections = (signed && readSignedContract(p.signed_contract)) || buildContract(p);
  const date = formatEventDate(p.event_date);

  return (
    <SiteShell>
      <style>{CSS}</style>
      <main className="pp-wrap">
        <p className="pp-eyebrow">Event proposal</p>
        <h1 className="font-display" style={{ fontSize: "clamp(30px, 5vw, 44px)", fontWeight: 900, lineHeight: 1.1, margin: "10px 0 8px" }}>
          Pizza for {p.client_name}&apos;s event
        </h1>
        <p style={{ color: "#F8EAD5cc", fontSize: 17, margin: "0 0 24px" }}>
          {date} · {formatTimeWindow(p.start_time, p.end_time)}
        </p>

        {p.status === "deposit_paid" ? (
          <p className="pp-banner ok">Your deposit is paid and your date is booked. We can&apos;t wait to cook for you!</p>
        ) : paid === "1" && signed ? (
          <p className="pp-banner">Thank you! Your payment is going through. This page will say Booked once it&apos;s confirmed (refresh in a minute).</p>
        ) : null}

        <section className="pp-card">
          <dl className="pp-facts">
            <div><dt>Date</dt><dd>{date}</dd></div>
            <div><dt>Serving</dt><dd>{formatTimeWindow(p.start_time, p.end_time)}</dd></div>
            <div><dt>Where</dt><dd>{p.location}</dd></div>
            <div><dt>Guests</dt><dd>{p.guests}</dd></div>
            <div><dt>Package</dt><dd>{pkg.name}</dd></div>
            {p.gluten_free_count > 0 && <div><dt>Gluten free</dt><dd>{p.gluten_free_count} pizzas</dd></div>}
          </dl>

          <h2 className="pp-h2">How the price adds up</h2>
          <ol className="pp-steps">
            {explainProposalSteps(math).map((s) => <li key={s}>{s}</li>)}
          </ol>
          <div className="pp-totals">
            <div><span>Total</span><b>{moneyCents(math.totalCents)}</b></div>
            <div><span>Deposit now ({math.depositPct}%)</span><b>{moneyCents(math.depositCents)}</b></div>
            <div><span>Balance on the day</span><b>{moneyCents(math.balanceCents)}</b></div>
          </div>
        </section>

        <h2 className="pp-h2" style={{ marginTop: 34 }}>The agreement</h2>
        <p style={{ color: "#F8EAD5aa", fontSize: 14, margin: "0 0 14px" }}>Please read it all the way through. It&apos;s written in plain words on purpose.</p>
        <div className="pp-card pp-contract">
          <ContractView sections={sections} />
        </div>

        <ProposalActions
          token={token}
          status={p.status}
          signedName={p.signed_name}
          signedAt={p.signed_at}
          depositLabel={moneyCents(p.deposit_cents)}
        />
      </main>
    </SiteShell>
  );
}

const CSS = `
.pp-wrap { max-width: 760px; margin: 0 auto; padding: 48px 20px 80px; }
.pp-eyebrow { color: #E8C24A; margin: 0; font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
.pp-banner { background: #E8C24A22; border: 1px solid #E8C24A66; border-radius: 14px; padding: 12px 16px; margin: 0 0 20px; line-height: 1.5; }
.pp-banner.ok { background: #2F7D4F33; border-color: #2F7D4F; }
.pp-card { background: #3A3E43; border: 1px solid #F8EAD514; border-radius: 22px; padding: 22px; }
.pp-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px 18px; margin: 0 0 8px; }
.pp-facts dt { font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #F8EAD577; }
.pp-facts dd { margin: 3px 0 0; font-size: 15px; overflow-wrap: anywhere; }
.pp-h2 { font-size: 18px; font-weight: 900; margin: 20px 0 10px; }
.pp-steps { margin: 0; padding-left: 20px; line-height: 1.7; font-variant-numeric: tabular-nums; }
.pp-totals { display: grid; gap: 6px; margin-top: 16px; padding-top: 14px; border-top: 1px solid #F8EAD522; font-variant-numeric: tabular-nums; }
.pp-totals div { display: flex; justify-content: space-between; gap: 12px; }
.pp-totals span { color: #F8EAD5cc; }
.contract section + section { margin-top: 18px; }
.contract h3 { font-size: 15px; font-weight: 900; margin: 0 0 6px; }
.contract p { margin: 0 0 6px; line-height: 1.6; color: #F8EAD5e6; font-size: 15px; }
@media print {
  nav, footer, .pp-noprint { display: none !important; }
  * { background: transparent !important; color: #000 !important; border-color: #ccc !important; }
  .pp-wrap { padding: 0; }
}
`;
