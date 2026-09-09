create table if not exists public.map_layers (
  id text primary key,
  name text not null check (char_length(name) between 1 and 60),
  color text not null default '#2563eb' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.map_markers (
  id text primary key,
  layer_id text not null references public.map_layers(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  category text not null default 'สถานที่',
  status text not null default 'active' check (status in ('active','draft','hidden')),
  color text not null default '#2563eb' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists map_markers_layer_idx on public.map_markers(layer_id);
create index if not exists map_markers_status_idx on public.map_markers(status);
alter table public.map_layers enable row level security;
alter table public.map_markers enable row level security;

-- Direct browser access is intentionally blocked. The Edge Function uses service_role.
drop policy if exists "map_layers_public_read" on public.map_layers;
drop policy if exists "map_markers_public_read" on public.map_markers;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('map-marker-images','map-marker-images',false,10485760,array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "map_marker_images_public_upload" on storage.objects;
drop policy if exists "map_marker_images_public_read" on storage.objects;
