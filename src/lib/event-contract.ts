// The event contract, in plain words, with the proposal's details filled
// in. The client reads it on /proposal/[token]; the admin print view shows
// the copy frozen at signing. Change wording here and every new proposal
// picks it up; contracts already signed keep the words they were signed with.

import { GLUTEN_FREE_EXTRA, explainProposalSteps, moneyCents } from "./event-packages";
import { formatEventDate, formatTimeWindow, mathForRow, type MathFields, type ProposalRow } from "./event-proposals";

/** The name on the contract. Change this once there is a registered business name. */
export const BUSINESS_LEGAL_NAME = "Amori Muori";
export const BUSINESS_LOCATION = "Ashburn, VA";

/** Shown in Admin only, never on the client's page. */
export const CONTRACT_REVIEW_NOTE =
  "Contract wording is a template; have a Virginia attorney review it before sending your first one.";

/** Cancelling this many days or more before the event gets the deposit back, minus the fee. */
export const CANCEL_REFUND_DAYS = 14;
export const CANCEL_FEE_CENTS = 100_00;
/** How long we have to find a new date after a severe-weather call. */
export const WEATHER_RESCHEDULE_DAYS = 60;

export interface ContractSection {
  heading: string;
  paragraphs: string[];
}

/** A signed contract's frozen sections (event_proposals.signed_contract), if the stored JSON looks right. */
export function readSignedContract(v: unknown): ContractSection[] | null {
  if (!Array.isArray(v)) return null;
  const ok = v.every(
    (s) => s && typeof s.heading === "string" && Array.isArray(s.paragraphs) && s.paragraphs.every((p: unknown) => typeof p === "string")
  );
  return ok ? (v as ContractSection[]) : null;
}

type ContractInput = MathFields &
  Pick<ProposalRow, "client_name" | "client_email" | "client_phone" | "event_date" | "start_time" | "end_time" | "location" | "dietary_notes">;

export function buildContract(p: ContractInput): ContractSection[] {
  const calc = mathForRow(p);
  if (!calc) return [];
  const { pkg, math } = calc;
  const date = formatEventDate(p.event_date);
  const time = formatTimeWindow(p.start_time, p.end_time);
  const contact = [p.client_email, p.client_phone].filter(Boolean).join(", ");
  const refundIfEarly = moneyCents(Math.max(0, math.depositCents - CANCEL_FEE_CENTS));

  return [
    {
      heading: "1. Who this agreement is between",
      paragraphs: [
        `This agreement is between ${BUSINESS_LEGAL_NAME}, a Neapolitan pizza caterer based in ${BUSINESS_LOCATION} ("we" or "us"), and ${p.client_name} (${contact}) ("you").`,
      ],
    },
    {
      heading: "2. Event details",
      paragraphs: [
        `Date: ${date}.`,
        `Serving time: ${time}.`,
        `Location: ${p.location}.`,
        `Guests: ${p.guests}.`,
        "We arrive before the serving time to set up our tables, canopy and oven, cook in front of your guests during the serving time, then pack up and clean our area after.",
      ],
    },
    {
      heading: "3. Menu and package",
      paragraphs: [
        `Package: ${pkg.name}. It includes: ${pkg.includes.join("; ")}.`,
        p.gluten_free_count > 0
          ? `Gluten free pizzas: ${p.gluten_free_count}, at ${moneyCents(GLUTEN_FREE_EXTRA * 100)} extra each.`
          : "Gluten free pizzas: none ordered. Ask us before the event if you'd like to add some.",
        "We confirm your exact pizza choices with you before the event.",
      ],
    },
    {
      heading: "4. Dietary needs and allergies",
      paragraphs: [
        "Gluten free pizzas are baked in a separate oven, away from our regular dough.",
        "Our pesto contains pine nuts. Our kitchen also handles wheat, dairy and other common allergens, so we can't promise any pizza is completely allergen free.",
        "You agree to tell us about every food allergy among your guests ahead of the event, at least a week before is best, so we can plan for it.",
        p.dietary_notes ? `What you've told us so far: ${p.dietary_notes}` : "You haven't told us about any allergies yet.",
      ],
    },
    {
      heading: "5. Price and deposit",
      paragraphs: [
        "Here is how the price adds up:",
        ...explainProposalSteps(math),
        pkg.priceNote ? `${pkg.name} pricing: ${pkg.priceNote.toLowerCase()}.` : "",
        `The deposit of ${moneyCents(math.depositCents)} holds your date. Your date is only reserved once the deposit is paid.`,
      ].filter(Boolean),
    },
    {
      heading: "6. Balance due on the event day",
      paragraphs: [
        `The balance of ${moneyCents(math.balanceCents)} is due on ${date}, before we start serving.`,
        "If you add guests or extras before the event, we'll agree the new price with you in writing and add it to the balance.",
      ],
    },
    {
      heading: "7. If you cancel",
      paragraphs: [
        `${CANCEL_REFUND_DAYS} days or more before the event: we refund your deposit minus a ${moneyCents(CANCEL_FEE_CENTS)} fee, so you get back ${refundIfEarly}.`,
        `Less than ${CANCEL_REFUND_DAYS} days before the event: the deposit is non-refundable, because we've turned other bookings away and bought ingredients for your date.`,
        "Since the balance isn't paid until the event day, you won't owe it if you cancel.",
        "To cancel, email us. The date we receive your email is the date that counts.",
      ],
    },
    {
      heading: "8. Weather",
      paragraphs: [
        "We cook under our own canopy, so rain or heat alone doesn't stop the event.",
        `If the weather is severe enough that cooking outside isn't safe (for example lightning, high winds or a storm warning), we'll work with you to pick a new date within ${WEATHER_RESCHEDULE_DAYS} days and your deposit carries over. If we can't find a date that works, we refund the balance if you've paid any of it, but not the deposit.`,
      ],
    },
    {
      heading: "9. What we need at the site",
      paragraphs: [
        "A flat, level space about 10 × 20 feet for our canopy, tables and oven.",
        "That space needs to be within 50 feet of where we can park, so we can carry our equipment in.",
        "If your site can't offer this, tell us before the event and we'll work out a plan together.",
      ],
    },
    {
      heading: "10. Liability and insurance",
      paragraphs: [
        "We carry liability insurance. If your venue or HOA needs proof, ask and we'll send a certificate of insurance.",
        "You're responsible for any permission your venue or property needs for us to cook there.",
      ],
    },
    {
      heading: "11. Limit on liability",
      paragraphs: [
        "As far as the law allows, the most we can owe you for anything to do with this event is the total amount you paid us for it.",
        "We aren't responsible for indirect losses, such as a lost venue booking or travel costs.",
      ],
    },
    {
      heading: "12. Governing law",
      paragraphs: ["This agreement is governed by the laws of the Commonwealth of Virginia."],
    },
    {
      heading: "13. Signing",
      paragraphs: [
        "Typing your full name and pressing Sign counts as your signature. You're agreeing to everything above, and that you're at least 18 and allowed to book this event.",
      ],
    },
  ];
}
