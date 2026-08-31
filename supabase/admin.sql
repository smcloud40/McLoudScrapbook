-- Run this in the Supabase SQL editor after schema.sql and seed.sql.
-- Adds: automatic profile creation on signup, an is_admin flag, a subcategory
-- field for packs (fall/spring/ocean/etc.), a font_family field for font
-- elements, and RLS policies so only admins can create/edit the catalog.

-- 1. Auto-create a profiles row whenever someone signs up (this was missing
--    before — without it, is_admin has nowhere to be set).
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: create profile rows for anyone who signed up before this trigger existed.
insert into public.profiles (id)
select id from auth.users
where id not in (select id from public.profiles)
on conflict (id) do nothing;

-- 2. Admin flag.
alter table profiles add column if not exists is_admin boolean not null default false;

-- 3. Taxonomy fields.
alter table packs add column if not exists subcategory text;
alter table elements add column if not exists font_family text; -- Google Font name, for font elements

-- 4. Admin-only write access to the catalog (everyone can already read it).
create policy "admin insert packs" on packs for insert with check (
  exists (select 1 from profiles where id = auth.uid() and is_admin)
);
create policy "admin update packs" on packs for update using (
  exists (select 1 from profiles where id = auth.uid() and is_admin)
);
create policy "admin delete packs" on packs for delete using (
  exists (select 1 from profiles where id = auth.uid() and is_admin)
);
create policy "admin insert elements" on elements for insert with check (
  exists (select 1 from profiles where id = auth.uid() and is_admin)
);
create policy "admin update elements" on elements for update using (
  exists (select 1 from profiles where id = auth.uid() and is_admin)
);
create policy "admin delete elements" on elements for delete using (
  exists (select 1 from profiles where id = auth.uid() and is_admin)
);

-- 5. Storage bucket for uploaded artwork, public read, admin-only write.
insert into storage.buckets (id, name, public)
values ('element-assets', 'element-assets', true)
on conflict (id) do nothing;

create policy "public read element assets" on storage.objects for select using (
  bucket_id = 'element-assets'
);
create policy "admin write element assets" on storage.objects for insert with check (
  bucket_id = 'element-assets' and exists (select 1 from profiles where id = auth.uid() and is_admin)
);
create policy "admin update element assets" on storage.objects for update using (
  bucket_id = 'element-assets' and exists (select 1 from profiles where id = auth.uid() and is_admin)
);
create policy "admin delete element assets" on storage.objects for delete using (
  bucket_id = 'element-assets' and exists (select 1 from profiles where id = auth.uid() and is_admin)
);

-- 6. Finally, make your wife an admin (run this line yourself after she's
--    signed in at least once, so her profile row exists):
-- update profiles set is_admin = true where id = (select id from auth.users where email = 'her-email@example.com');
