-- ─────────────────────────────────────────────────────────────
-- Venues list + event proposals
-- venues: breweries and wineries we pop up at, with the deal we
-- have (or want) and where things stand.
-- event_proposals: a priced proposal + contract made from an
-- event inquiry. The client opens it with a secret link, signs
-- it, then pays the deposit through Stripe.
--
-- Needs 011_events.sql first (event_proposals points at
-- catering_inquiries and sets its status to booked).
--
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to run more than once — IF NOT EXISTS guards throughout.
-- ─────────────────────────────────────────────────────────────

-- ── Venues ───────────────────────────────────────────────────

-- deal_type and status: keep in sync with src/lib/venues.ts
CREATE TABLE IF NOT EXISTS venues (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  contact_name       text,
  email              text,
  phone              text,
  address            text,
  deal_type          text NOT NULL DEFAULT 'hybrid'
                       CHECK (deal_type IN ('hybrid', 'flat_fee', 'revenue_share', 'other')),
  deal_notes         text,
  status             text NOT NULL DEFAULT 'prospect'
                       CHECK (status IN ('prospect', 'contacted', 'booked', 'regular', 'not_a_fit')),
  last_contacted_on  date,
  next_booked_on     date,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS venues_name_idx ON venues (lower(name));

-- Signed-in admins can read and write, like 005_admin_rls.sql
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venues_admin_all" ON venues;
CREATE POLICY "venues_admin_all" ON venues
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── Event proposals ──────────────────────────────────────────

-- status: draft → sent → signed → deposit_paid
-- (keep in sync with PROPOSAL_STATUSES in src/lib/event-proposals.ts)
-- Money is in cents. The server works out every total from the
-- inputs (package, guests, gluten free, custom lines) and stores
-- the result; nothing the browser sends is trusted as a price.
CREATE TABLE IF NOT EXISTS event_proposals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id            uuid REFERENCES catering_inquiries (id) ON DELETE SET NULL,
  -- 32 random bytes, base64url (43 characters). The only way to open the public page.
  token                 text NOT NULL UNIQUE CHECK (length(token) >= 43),
  status                text NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'sent', 'signed', 'deposit_paid')),

  client_name           text NOT NULL,
  client_email          text NOT NULL,
  client_phone          text,
  package               text NOT NULL,
  guests                integer NOT NULL CHECK (guests > 0),
  event_date            date NOT NULL,
  start_time            time,
  end_time              time,
  location              text NOT NULL,
  gluten_free_count     integer NOT NULL DEFAULT 0 CHECK (gluten_free_count >= 0),
  custom_lines          jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{ "label": text, "amount_cents": int }]
  dietary_notes         text,
  deposit_pct           integer NOT NULL DEFAULT 50 CHECK (deposit_pct BETWEEN 1 AND 100),
  -- The package price and minimum when the proposal was saved, so a later
  -- price change in event-packages.ts doesn't change a proposal already sent
  per_guest_cents       integer NOT NULL CHECK (per_guest_cents > 0),
  minimum_cents         integer NOT NULL CHECK (minimum_cents >= 0),

  total_cents           integer NOT NULL CHECK (total_cents > 0),
  deposit_cents         integer NOT NULL CHECK (deposit_cents > 0),

  sent_at               timestamptz,
  signed_name           text,
  signed_at             timestamptz,
  signed_ip             text,
  signed_user_agent     text,
  -- The exact contract wording the client agreed to, frozen at signing
  signed_contract       jsonb,

  stripe_checkout_session_id  text,
  stripe_payment_intent_id    text,
  deposit_paid_at       timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_proposals_inquiry_idx ON event_proposals (inquiry_id);

-- The public /proposal/[token] page reads with the service role (which
-- bypasses RLS) and only ever by token. Anon gets nothing; signed-in
-- admins can read and write, like 005_admin_rls.sql.
ALTER TABLE event_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_proposals_admin_all" ON event_proposals;
CREATE POLICY "event_proposals_admin_all" ON event_proposals
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
