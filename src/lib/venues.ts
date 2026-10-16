// Breweries and wineries we pop up at. Admin → Customers → Venues.

export type VenueDealType = "hybrid" | "flat_fee" | "revenue_share" | "other";
export type VenueStatus = "prospect" | "contacted" | "booked" | "regular" | "not_a_fit";

// Keep both lists in sync with the check constraints in supabase/migrations/016_venues.sql
export const VENUE_DEAL_TYPES: { id: VenueDealType; label: string; hint: string }[] = [
  { id: "hybrid", label: "Hybrid", hint: "Venue waives the fee and we sell per pizza" },
  { id: "flat_fee", label: "Flat fee guarantee", hint: "Venue guarantees us a set amount" },
  { id: "revenue_share", label: "Revenue share", hint: "We split sales with the venue" },
  { id: "other", label: "Other", hint: "Describe it in the deal notes" },
];

export const VENUE_STATUSES: { id: VenueStatus; label: string }[] = [
  { id: "prospect", label: "Prospect" },
  { id: "contacted", label: "Contacted" },
  { id: "booked", label: "Booked" },
  { id: "regular", label: "Regular" },
  { id: "not_a_fit", label: "Not a fit" },
];

export interface VenueRow {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  deal_type: VenueDealType;
  deal_notes: string | null;
  status: VenueStatus;
  last_contacted_on: string | null; // YYYY-MM-DD
  next_booked_on: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const VENUE_COLUMNS =
  "id, name, contact_name, email, phone, address, deal_type, deal_notes, status, last_contacted_on, next_booked_on, notes, created_at, updated_at";

/** Today in Ashburn, as YYYY-MM-DD. */
export function todayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}
