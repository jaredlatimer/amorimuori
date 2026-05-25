-- Seed upcoming Friday service nights.
-- All times stored as UTC; timestamps use America/New_York (EDT = UTC-4 through Nov 2026).
-- order_open_at  = preceding Wednesday 00:00 ET
-- order_close_at = that Friday      20:40 ET
-- Regenerate this file or insert via admin Settings tab as the calendar grows.

insert into service_nights (service_date, is_enabled, nightly_total, service_start, last_pickup, order_open_at, order_close_at)
values
  ('2026-05-29', true,  50, '18:00', '21:00',
    (timestamp '2026-05-27 00:00:00') at time zone 'America/New_York',
    (timestamp '2026-05-29 20:40:00') at time zone 'America/New_York'),

  ('2026-06-05', true,  50, '18:00', '21:00',
    (timestamp '2026-06-03 00:00:00') at time zone 'America/New_York',
    (timestamp '2026-06-05 20:40:00') at time zone 'America/New_York'),

  ('2026-06-12', true,  50, '18:00', '21:00',
    (timestamp '2026-06-10 00:00:00') at time zone 'America/New_York',
    (timestamp '2026-06-12 20:40:00') at time zone 'America/New_York'),

  ('2026-06-19', true,  50, '18:00', '21:00',
    (timestamp '2026-06-17 00:00:00') at time zone 'America/New_York',
    (timestamp '2026-06-19 20:40:00') at time zone 'America/New_York'),

  ('2026-06-26', true,  50, '18:00', '21:00',
    (timestamp '2026-06-24 00:00:00') at time zone 'America/New_York',
    (timestamp '2026-06-26 20:40:00') at time zone 'America/New_York'),

  ('2026-07-03', true,  50, '18:00', '21:00',
    (timestamp '2026-07-01 00:00:00') at time zone 'America/New_York',
    (timestamp '2026-07-03 20:40:00') at time zone 'America/New_York'),

  ('2026-07-10', true,  50, '18:00', '21:00',
    (timestamp '2026-07-08 00:00:00') at time zone 'America/New_York',
    (timestamp '2026-07-10 20:40:00') at time zone 'America/New_York'),

  ('2026-07-17', true,  50, '18:00', '21:00',
    (timestamp '2026-07-15 00:00:00') at time zone 'America/New_York',
    (timestamp '2026-07-17 20:40:00') at time zone 'America/New_York')

on conflict (service_date) do nothing;
