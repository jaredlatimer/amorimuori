// Share links for a customer's referral code. Safe to import from client components.

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://amorimuori.com").replace(/\/$/, "");

// Which share button a guest's link came from. Keep in sync with the check in
// supabase/migrations/012_referral_via.sql.
export const REFERRAL_VIAS = ["text", "email", "link"] as const;
export type ReferralVia = (typeof REFERRAL_VIAS)[number];

export function parseReferralVia(raw: unknown): ReferralVia | null {
  return REFERRAL_VIAS.find((v) => v === raw) ?? null;
}

export function referralShareLink(code: string, via: ReferralVia): string {
  return `${APP_URL}/order?ref=${encodeURIComponent(code)}&via=${via}`;
}

/** Prefilled text message, email and link for the confirmation page's share buttons. */
export function referralShareMessages(code: string, customerName: string) {
  const first = customerName.trim().split(" ")[0] ?? "";
  const textLink = referralShareLink(code, "text");
  const emailLink = referralShareLink(code, "email");
  return {
    text:
      `${first || "A friend"} sent you a pizza: use code ${code} at Amori Muori and the cheaper of two pizzas ` +
      `is free on your first order. Neapolitan, Fridays in Ashburn Farm. ${textLink}`,
    emailSubject: first ? `A free pizza from ${first}` : "A free pizza for you",
    emailBody:
      `${first || "A friend"} thinks you'd love Amori Muori, Neapolitan pizza on Fridays in Ashburn Farm. ` +
      `Use code ${code} on your first order and the cheaper of two pizzas is free.\n\n${emailLink}`,
    link: referralShareLink(code, "link"),
  };
}
