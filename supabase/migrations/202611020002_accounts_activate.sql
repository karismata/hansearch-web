-- Run ONLY after the master login, Edge Function, AI sync token, and updated Mac sync have been verified.
begin;
do $$ begin
  if not exists(select 1 from public.member_profiles where username='master' and role='master' and status='approved') then
    raise exception '승인된 master 계정을 먼저 준비하세요.';
  end if;
  if not exists(select 1 from hansearch_private.settings where key='ai_sync_hash') then
    raise exception 'AI 동기화 키를 먼저 등록하세요.';
  end if;
end $$;
alter table public.info enable row level security;
revoke all on public.info from anon,authenticated;
grant select,insert,update,delete on public.info to authenticated;
do $$ declare seq text; begin
  seq:=pg_get_serial_sequence('public.info','id');
  if seq is not null then execute format('grant usage,select on sequence %s to authenticated',seq); end if;
end $$;
drop policy if exists hansearch_info_guard on public.info;
create policy hansearch_info_guard on public.info as restrictive for all to anon,authenticated
using ((select public.hansearch_is_approved())) with check ((select public.hansearch_is_approved()));
drop policy if exists hansearch_info_members on public.info;
create policy hansearch_info_members on public.info for all to authenticated
using ((select public.hansearch_is_approved())) with check ((select public.hansearch_is_approved()));
drop policy if exists hansearch_storage_guard on storage.objects;
create policy hansearch_storage_guard on storage.objects as restrictive for all to anon,authenticated
using (bucket_id<>'hansearch-images' or (select public.hansearch_is_approved()))
with check (bucket_id<>'hansearch-images' or (select public.hansearch_is_approved()));
drop policy if exists hansearch_storage_members on storage.objects;
create policy hansearch_storage_members on storage.objects for all to authenticated
using (bucket_id='hansearch-images' and (select public.hansearch_is_approved()))
with check (bucket_id='hansearch-images' and (select public.hansearch_is_approved()));
commit;
