-- ─────────────────────────────────────────────────────────────
-- Referral share channel
-- The confirmation page's Text, Email and Copy link buttons share
-- /order?ref=CODE&via=text|email|link. When a guest's order uses
-- that code, the channel is stored here so Customers → Referrals
-- can count guests by channel. Null for codes typed in by hand and
-- for orders from before this migration.
--
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to run more than once — IF NOT EXISTS guard.
-- ─────────────────────────────────────────────────────────────

-- Keep the values in sync with REFERRAL_VIAS in src/lib/referral-share.ts
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS referral_via text CHECK (referral_via IN ('text', 'email', 'link'));
