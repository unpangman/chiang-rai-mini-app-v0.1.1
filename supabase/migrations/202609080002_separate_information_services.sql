-- Keep health and information requests out of the generic complaint workflow.
-- NOT VALID preserves historical rows while enforcing the rule for new writes.
alter table public.complaints drop constraint if exists complaints_category_check;
alter table public.complaints add constraint complaints_category_check
  check (category in ('streetlight','road','waste','flood','pm25')) not valid;

update public.services
set subtitle = 'ข้อมูลบริการและช่องทางติดต่อ'
where slug in ('information', 'health');
