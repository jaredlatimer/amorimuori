import { createServiceClient } from "@/lib/supabase/server";
import { isMissingTable } from "@/lib/event-proposals";
import { VENUE_COLUMNS, type VenueRow } from "@/lib/venues";
import { VenuesClient } from "./VenuesClient";

export const dynamic = "force-dynamic";

// Venue contacts are server-only, so this reads with the service role.
// The admin layout has already checked that someone is signed in.
export default async function VenuesPage() {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.from("venues").select(VENUE_COLUMNS).order("name");

  const missing = isMissingTable(error);
  if (error && !missing) console.error("Venues load error:", error);

  return <VenuesClient rows={(data ?? []) as VenueRow[]} migrated={!missing} loadFailed={!!error && !missing} />;
}
