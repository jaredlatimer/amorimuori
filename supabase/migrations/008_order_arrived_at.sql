-- Persist "Customer Arrived" state so it survives page reloads
alter table orders add column if not exists arrived_at timestamptz;
