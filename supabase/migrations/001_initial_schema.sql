-- Amori Muori — initial schema
-- Run in the Supabase SQL editor or via `supabase db push`

-- ── Settings (single-row config, all business-rule defaults) ──────────────────

create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  service_start time not null default '18:00',
  last_pickup time not null default '21:00',
  order_open_day text not null default 'Wednesday',
  order_close_time time not null default '20:40',
  bake_minutes int not null default 4,
  nightly_pool int not null default 50
);

-- Exactly one row; use upsert to update
insert into settings (id) values ('00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- ── Pizzas ─────────────────────────────────────────────────────────────────────

create table if not exists pizzas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category text not null check (category in ('Pizze Rosse', 'Pizze Bianche')),
  price_cents int not null check (price_cents > 0),
  nightly_cap int not null default 20 check (nightly_cap > 0),
  allergens text[] not null default '{}',
  is_active bool not null default true,
  is_special bool not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pizzas_category_sort on pizzas (category, sort_order);

-- ── Service nights (one row per Friday service) ────────────────────────────────

create table if not exists service_nights (
  id uuid primary key default gen_random_uuid(),
  service_date date not null unique,
  is_enabled bool not null default true,
  nightly_total int not null default 50,
  service_start time not null default '18:00',
  last_pickup time not null default '21:00',
  order_open_at timestamptz not null,
  order_close_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'open', 'closed')),
  sold_out_overrides jsonb not null default '{}'
);

create index if not exists service_nights_date on service_nights (service_date);

-- ── Orders ─────────────────────────────────────────────────────────────────────

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  service_night_id uuid not null references service_nights (id),
  code text not null unique,
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null,
  pickup_at timestamptz not null,
  status text not null default 'new'
    check (status in ('new', 'making', 'ready', 'picked_up', 'cancelled', 'refunded')),
  subtotal_cents int not null check (subtotal_cents >= 0),
  tip_cents int not null default 0 check (tip_cents >= 0),
  total_cents int not null check (total_cents >= 0),
  stripe_payment_intent_id text unique,
  placed_at timestamptz not null default now(),
  cancellable_until timestamptz not null
);

create index if not exists orders_service_night on orders (service_night_id);
create index if not exists orders_code on orders (code);
create index if not exists orders_stripe_pi on orders (stripe_payment_intent_id);
create index if not exists orders_pickup_at on orders (pickup_at);

-- ── Order items ────────────────────────────────────────────────────────────────

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  pizza_id uuid not null references pizzas (id),
  pizza_name text not null,
  unit_price_cents int not null check (unit_price_cents > 0),
  quantity int not null check (quantity > 0)
);

create index if not exists order_items_order on order_items (order_id);
create index if not exists order_items_pizza on order_items (pizza_id);

-- ── Reminder signups ───────────────────────────────────────────────────────────

create table if not exists reminder_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

-- ── updated_at trigger ─────────────────────────────────────────────────────────

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger pizzas_updated_at
  before update on pizzas
  for each row execute function update_updated_at();

-- ── Row Level Security ─────────────────────────────────────────────────────────

alter table settings enable row level security;
alter table pizzas enable row level security;
alter table service_nights enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table reminder_signups enable row level security;

-- Public read: settings, active pizzas, service nights
create policy "settings_public_read" on settings for select using (true);

create policy "pizzas_public_read" on pizzas
  for select using (is_active = true);

create policy "service_nights_public_read" on service_nights
  for select using (true);

-- Orders: insert public (server validates), read by code
-- Service role bypasses RLS for all server-side writes
create policy "orders_public_insert" on orders
  for insert with check (true);

create policy "orders_public_read_by_code" on orders
  for select using (true);

create policy "order_items_public_insert" on order_items
  for insert with check (true);

create policy "order_items_public_read" on order_items
  for select using (true);

create policy "reminder_signups_public_insert" on reminder_signups
  for insert with check (true);
