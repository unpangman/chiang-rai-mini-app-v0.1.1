-- Chiang Rai iOS Mini App - Supabase schema
create extension if not exists pgcrypto;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  subtitle text not null default '',
  icon text not null default '📌',
  color text not null default '#007AFF',
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null default '',
  priority text not null default 'info' check (priority in ('urgent','important','info')),
  published boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  excerpt text not null default '',
  image_url text,
  type text not null default 'news' check (type in ('news','activity')),
  published boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  ticket_no text unique default ('CR-' || to_char(now(),'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))),
  user_id text not null,
  user_name text not null,
  category text not null check (category in ('streetlight','road','waste','flood','pm25')),
  subtype text not null,
  title text not null,
  description text not null,
  latitude double precision,
  longitude double precision,
  photo_url text,
  status text not null default 'received' check (status in ('received','in_progress','resolved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.services enable row level security;
alter table public.news enable row level security;
alter table public.notices enable row level security;
alter table public.complaints enable row level security;

-- Indexes for the public Mini App catalog queries.
create index if not exists services_enabled_sort_idx on public.services (sort_order) where enabled = true;
create index if not exists notices_published_at_idx on public.notices (published_at desc) where published = true;
create index if not exists news_published_at_idx on public.news (published_at desc) where published = true;

-- Public catalog data is readable by the Mini App.
drop policy if exists "services_public_read" on public.services;
create policy "services_public_read" on public.services for select using (enabled = true);
drop policy if exists "news_public_read" on public.news;
create policy "news_public_read" on public.news for select using (published = true);
drop policy if exists "notices_public_read" on public.notices;
create policy "notices_public_read" on public.notices for select using (published = true);

-- LIFF user IDs are supplied by the client. For production, validate LIFF access tokens
-- in an Edge Function before inserting sensitive/privileged data.
drop policy if exists "complaints_public_insert" on public.complaints;
create policy "complaints_public_insert" on public.complaints for insert with check (
  char_length(user_id) > 0 and char_length(description) >= 5
);
drop policy if exists "complaints_public_map_read" on public.complaints;

-- Return only map-safe fields. Personal details and descriptions are not exposed.
create or replace function public.get_public_map_issues()
returns table (
  id uuid,
  category text,
  title text,
  status text,
  latitude double precision,
  longitude double precision
)
language sql
security definer
set search_path = public
as $$
  select c.id, c.category, c.title, c.status, c.latitude, c.longitude
  from public.complaints c
  where c.latitude is not null
    and c.longitude is not null
    and c.status <> 'rejected'
  order by c.created_at desc
  limit 100;
$$;
revoke all on function public.get_public_map_issues() from public;
grant execute on function public.get_public_map_issues() to anon, authenticated;

insert into public.services (slug,title,subtitle,icon,color,sort_order) values
('streetlight','แจ้งปัญหาไฟสาธารณะ','ไฟดับ/ไฟกระพริบ/ไฟเสีย','💡','#FF9F0A',1),
('road','แจ้งปัญหาถนนชำรุด','ถนนพัง/หลุมบ่อ/ทางเท้าเสียหาย','🛣️','#FF453A',2),
('waste','แจ้งปัญหาขยะ','ขยะล้น/ไม่เก็บ/ถังขยะเสียหาย','🗑️','#30D158',3),
('flood','แจ้งปัญหาน้ำท่วม','น้ำท่วมขัง/ระบายน้ำไม่ทัน','💧','#0A84FF',4),
('pm25','แจ้งปัญหา PM2.5','ฝุ่นควัน/มลพิษทางอากาศ','🌫️','#BF5AF2',5),
('information','ขอข้อมูลข่าวสาร (พ.ร.บ.)','ยื่นคำร้องขอข้อมูลข่าวสาร','📄','#5856D6',6),
('health','ศูนย์บริการสุขภาพ','บริการกองสาธารณสุข','🏥','#007AFF',7)
on conflict (slug) do update set title=excluded.title, subtitle=excluded.subtitle, icon=excluded.icon, color=excluded.color, sort_order=excluded.sort_order;

insert into public.notices (title,summary,priority,published_at) values
('ประกาศสำคัญจากเทศบาลนครเชียงราย','ติดตามข่าวสารและบริการที่มีผลต่อประชาชนในเขตเทศบาล','important',now() - interval '1 day'),
('แจ้งเตือนการปิดถนนชั่วคราว','ตรวจสอบเส้นทางก่อนเดินทางและวางแผนการเดินทางล่วงหน้า','urgent',now() - interval '2 days'),
('ประกาศบริการประชาชน','อัปเดตข้อมูลการให้บริการของเทศบาลในช่วงเวลาทำการ','info',now() - interval '4 days');

insert into public.news (title,excerpt,type,published_at) values
('โครงการปลูกต้นไม้เฉลิมพระเกียรติ','ร่วมเพิ่มพื้นที่สีเขียวในเขตเทศบาลนครเชียงราย','activity',now() - interval '3 days'),
('ประชาสัมพันธ์เฝ้าระวัง PM2.5','ติดตามสถานการณ์คุณภาพอากาศและข้อแนะนำสุขภาพ','news',now() - interval '5 days');

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('complaint-images','complaint-images',true,10485760,array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set public=true;

drop policy if exists "complaint_images_public_upload" on storage.objects;
create policy "complaint_images_public_upload" on storage.objects for insert with check (bucket_id = 'complaint-images');
drop policy if exists "complaint_images_public_read" on storage.objects;
create policy "complaint_images_public_read" on storage.objects for select using (bucket_id = 'complaint-images');
