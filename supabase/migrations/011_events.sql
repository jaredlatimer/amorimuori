-- ─────────────────────────────────────────────────────────────
-- Events page + admin Events inbox
-- The /events booking form adds a package choice and dietary
-- notes, and makes phone optional. The admin inbox tracks each
-- inquiry through New → Proposal sent → Booked (or Lost).
--
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to run more than once — IF NOT EXISTS guards throughout.
-- ─────────────────────────────────────────────────────────────

-- package: classico | amori | gran_festa | celebrazione, null = not sure yet
-- (keep in sync with EVENT_PACKAGES in src/lib/event-packages.ts)
ALTER TABLE catering_inquiries
  ADD COLUMN IF NOT EXISTS package            text,
  ADD COLUMN IF NOT EXISTS event_type         text,
  ADD COLUMN IF NOT EXISTS dietary_notes      text,
  ADD COLUMN IF NOT EXISTS phone              text,
  ADD COLUMN IF NOT EXISTS status             text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS status_updated_at  timestamptz;

-- Phone is optional on the new form (007 created it NOT NULL)
ALTER TABLE catering_inquiries ALTER COLUMN phone DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catering_inquiries_status_check') THEN
    ALTER TABLE catering_inquiries
      ADD CONSTRAINT catering_inquiries_status_check
      CHECK (status IN ('new', 'proposal_sent', 'booked', 'lost'));
  END IF;
END $$;

-- The inbox lists newest first
CREATE INDEX IF NOT EXISTS catering_inquiries_created_idx
  ON catering_inquiries (created_at DESC);

-- 007 never turned on RLS, so the anon key could read these rows.
-- The public form inserts with the service role (which bypasses RLS);
-- signed-in admins can read and update, like 005_admin_rls.sql.
ALTER TABLE catering_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catering_inquiries_admin_all" ON catering_inquiries;
CREATE POLICY "catering_inquiries_admin_all" ON catering_inquiries
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
