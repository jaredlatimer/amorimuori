-- Phase 4: Stripe checkout support

-- Add pending_payment to order status enum
alter table orders drop constraint orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('pending_payment', 'new', 'making', 'ready', 'picked_up', 'cancelled', 'refunded'));

-- Make service_night_id nullable so dev-mock orders can be written without a real service night
alter table orders alter column service_night_id drop not null;

-- Service role reads/writes bypass RLS already; ensure anon can read their own order by code
-- (existing policy orders_public_read_by_code covers this)
