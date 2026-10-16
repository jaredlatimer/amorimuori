-- ─────────────────────────────────────────────────────────────
-- Referral BOGO
-- Every paying customer gets a referral code (a Caravaggio word
-- plus 4 random digits, e.g. AMOR-4817). A first-time customer who
-- uses it gets the cheaper of two pizzas free. When that friend's
-- order is picked up, the code owner earns the same BOGO for a
-- later order (good for 60 days, one per order).
--
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Safe to run more than once — IF NOT EXISTS guards throughout.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS referral_codes (
  code        text PRIMARY KEY,
  email       text NOT NULL UNIQUE,   -- stored lower-cased
  name        text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referral_rewards (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_email        text NOT NULL,  -- lower-cased
  earned_from_order_id  uuid NOT NULL UNIQUE REFERENCES orders (id),
  friend_name           text NOT NULL DEFAULT '',
  earned_at             timestamptz NOT NULL DEFAULT now(),
  expires_at            timestamptz NOT NULL,
  redeemed_order_id     uuid UNIQUE REFERENCES orders (id),
  redeemed_at           timestamptz
);

CREATE INDEX IF NOT EXISTS referral_rewards_open_idx
  ON referral_rewards (referrer_email, expires_at)
  WHERE redeemed_order_id IS NULL;

-- What a given order used: a friend's code, or one of the customer's own rewards
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS referral_code       text,
  ADD COLUMN IF NOT EXISTS referral_kind       text CHECK (referral_kind IN ('friend', 'reward')),
  ADD COLUMN IF NOT EXISTS referral_reward_id  uuid REFERENCES referral_rewards (id),
  ADD COLUMN IF NOT EXISTS discount_cents      int NOT NULL DEFAULT 0 CHECK (discount_cents >= 0);

-- Server-only tables: the service role bypasses RLS, nobody else gets access
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

-- ── Backfill a code for every past paying customer ───────────
-- Keep this word list in sync with REFERRAL_WORDS in src/lib/referrals.ts
DO $$
DECLARE
  words text[] := ARRAY[
    'AMOR','NAPOLI','MEDUSA','BACCHUS','JUDITH','EMMAUS','NARCISSUS','LUTE',
    'MATTHEW','MALTA','MERISI','FRUTTA','TENEBRISM','DAVID','GOLIATH','LAZARUS',
    'ISAAC','THOMAS','URSULA','LORETO','ROSARY','CARDSHARPS','FORTUNE','MILANO',
    'ROMA','SICILIA','SALOME','MAGDALENE','CHIAROSCURO','PELLEGRINI'
  ];
  c record;
  candidate text;
BEGIN
  FOR c IN
    SELECT DISTINCT ON (lower(customer_email))
      lower(customer_email) AS email, customer_name AS name
    FROM orders
    WHERE status IN ('new', 'making', 'ready', 'picked_up')
      AND coalesce(trim(customer_email), '') <> ''
      AND lower(customer_email) NOT IN (SELECT email FROM referral_codes)
    ORDER BY lower(customer_email), placed_at DESC
  LOOP
    LOOP
      candidate := words[1 + floor(random() * array_length(words, 1))::int]
        || '-' || (1000 + floor(random() * 9000))::int::text;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM referral_codes WHERE code = candidate);
    END LOOP;
    INSERT INTO referral_codes (code, email, name) VALUES (candidate, c.email, c.name);
  END LOOP;
END $$;
