-- Admin RLS for reminder_signups (authenticated users can read/manage signups)

create policy "reminder_signups_admin_all" on reminder_signups
  for all to authenticated
  using (true)
  with check (true);
