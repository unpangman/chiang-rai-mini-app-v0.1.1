alter table public.complaints add column if not exists photo_path text;

alter table public.complaints drop constraint if exists complaints_category_check;
alter table public.complaints add constraint complaints_category_check
  check (category in ('streetlight','road','waste','flood','pm25','information','health'));

create index if not exists complaints_user_created_idx on public.complaints (user_id, created_at desc);

drop policy if exists "complaints_public_insert" on public.complaints;
drop policy if exists "complaints_public_map_read" on public.complaints;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('complaint-images','complaint-images',false,10485760,array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "complaint_images_public_upload" on storage.objects;
drop policy if exists "complaint_images_public_read" on storage.objects;
