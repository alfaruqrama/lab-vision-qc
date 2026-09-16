-- Module Config — dev-controlled overrides untuk PortalHome module cards.
-- key = module path (e.g. '/qc', '/maintenance'). Field null artinya "pakai default".
create table module_config (
  key text primary key,
  wip boolean,
  hidden boolean,
  badge_label text,
  badge_live boolean,
  desc_override text,
  chips_override jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);
