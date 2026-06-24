create table catering_inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null,
  email text not null,
  phone text not null,
  event_date date not null,
  location text not null,
  guest_count integer not null,
  event_type text not null,
  serving_window text,
  notes text
);
