-- ─────────────────────────────────────────────────────────────
-- Oven Window Slot Locking (LAT-161)
-- Adds oven timing columns to orders so checkout can detect
-- overlapping oven windows and prevent double-bookings.
--
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to run more than once — IF NOT EXISTS guards throughout.
-- Historical rows are left NULL (intentional).
-- ─────────────────────────────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS oven_start_time  timestamptz,
  ADD COLUMN IF NOT EXISTS oven_end_time    timestamptz,
  ADD COLUMN IF NOT EXISTS slot_locked_at   timestamptz;

CREATE INDEX IF NOT EXISTS orders_oven_window_idx
  ON orders (service_night_id, oven_start_time, oven_end_time)
  WHERE oven_start_time IS NOT NULL;
