-- Admin RLS: authenticated users (admins) can read/write everything

create policy "orders_admin_all" on orders
  for all to authenticated
  using (true)
  with check (true);

create policy "order_items_admin_all" on order_items
  for all to authenticated
  using (true)
  with check (true);

create policy "service_nights_admin_all" on service_nights
  for all to authenticated
  using (true)
  with check (true);

create policy "pizzas_admin_all" on pizzas
  for all to authenticated
  using (true)
  with check (true);

create policy "settings_admin_all" on settings
  for all to authenticated
  using (true)
  with check (true);

-- Enable Realtime for orders (admin live updates)
alter publication supabase_realtime add table orders;
