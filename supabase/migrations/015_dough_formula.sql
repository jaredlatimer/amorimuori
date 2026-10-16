-- ─────────────────────────────────────────────────────────────
-- Dough formula
-- The owner's dough recipe, set once in Admin → Settings and used
-- by the Dough card on each night's Shopping tab. Lives on the
-- existing single-row settings table, which already has the admin
-- policy from 005_admin_rls.sql, so no new RLS is needed.
-- Percentages are stored as typed: 62 means 62%.
--
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to run more than once — IF NOT EXISTS guards throughout.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE settings ADD COLUMN IF NOT EXISTS dough_ball_g        int     NOT NULL DEFAULT 260;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS dough_buffer_pct    numeric NOT NULL DEFAULT 3;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS dough_hydration_pct numeric NOT NULL DEFAULT 62;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS dough_salt_pct      numeric NOT NULL DEFAULT 2.8;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS dough_yeast_pct     numeric NOT NULL DEFAULT 0.08;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS dough_schedule      text    NOT NULL DEFAULT '48-hour';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settings_dough_schedule_check') THEN
    ALTER TABLE settings ADD CONSTRAINT settings_dough_schedule_check
      CHECK (dough_schedule IN ('same-day', '24-hour', '48-hour'));
  END IF;
END $$;
