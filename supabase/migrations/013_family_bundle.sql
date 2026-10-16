-- ─────────────────────────────────────────────────────────────
-- Family bundle
-- $5 off the pizzas on any order of 3 or more (amounts live in
-- FAMILY_BUNDLE in src/lib/family-bundle.ts). It doesn't combine
-- with the referral BOGO; checkout keeps whichever saves more, so
-- an order has discount_cents or bundle_discount_cents, never both.
--
-- total_cents = subtotal_cents - discount_cents - bundle_discount_cents + tip_cents
--
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Run this BEFORE deploying the code that reads it.
-- Safe to run more than once — IF NOT EXISTS guard.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS bundle_discount_cents int NOT NULL DEFAULT 0 CHECK (bundle_discount_cents >= 0);
