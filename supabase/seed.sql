-- Run after schema.sql to populate the starter catalog.

insert into packs (id, category, name, price_cents, is_free, is_seasonal) values
  ('bg-basics', 'background', 'Basics', 0, true, false),
  ('bg-autumn', 'background', 'Cozy autumn', 300, false, true),
  ('bg-farmhouse', 'background', 'Farmhouse florals', 250, false, false),
  ('st-everyday', 'sticker', 'Everyday', 0, true, false),
  ('st-autumn', 'sticker', 'Cozy autumn', 300, false, true),
  ('st-travel', 'sticker', 'Travel', 250, false, false),
  ('ft-basics', 'font', 'Basics', 0, true, false),
  ('ft-script', 'font', 'Script pack', 200, false, false)
on conflict (id) do nothing;

insert into elements (id, pack_id, kind, font_label) values
  ('f1', 'ft-basics', 'font', 'Hello there'),
  ('f2', 'ft-script', 'font', 'Sweet memories')
on conflict (id) do nothing;

-- Image elements (bg1..bg8, s1..s7) point at asset_url — upload real artwork to
-- Supabase Storage and update these rows, or keep placeholders for now.
insert into elements (id, pack_id, kind, asset_url) values
  ('bg1','bg-basics','image', null), ('bg2','bg-basics','image', null), ('bg3','bg-basics','image', null),
  ('bg4','bg-autumn','image', null), ('bg5','bg-autumn','image', null), ('bg6','bg-autumn','image', null),
  ('bg7','bg-farmhouse','image', null), ('bg8','bg-farmhouse','image', null),
  ('s1','st-everyday','image', null), ('s2','st-everyday','image', null), ('s3','st-everyday','image', null),
  ('s4','st-autumn','image', null), ('s5','st-autumn','image', null),
  ('s6','st-travel','image', null), ('s7','st-travel','image', null)
on conflict (id) do nothing;
