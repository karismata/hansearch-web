-- Preparation only: existing info access policies are left intact until activation.
begin;
create schema if not exists hansearch_private;
revoke all on schema hansearch_private from public, anon, authenticated;

create table if not exists hansearch_private.account_names (
  username text primary key check (username ~ '^[a-z0-9][a-z0-9_.-]{2,31}$'),
  user_id uuid not null unique,
  created_at timestamptz not null default now()
);
create table if not exists hansearch_private.settings (key text primary key, value text not null);
create table if not exists hansearch_private.signup_attempts (client_hash text not null,created_at timestamptz not null default now());
create or replace function public.hansearch_signup_allowed(p_client_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(72423581);
  delete from hansearch_private.signup_attempts where created_at<now()-interval '1 hour';
  if (select count(*) from hansearch_private.signup_attempts)>=50 or
     (select count(*) from hansearch_private.signup_attempts where client_hash=p_client_hash)>=5 then return false; end if;
  insert into hansearch_private.signup_attempts(client_hash) values(p_client_hash);
  return true;
end $$;
revoke all on function public.hansearch_signup_allowed(text) from public,anon,authenticated;
grant execute on function public.hansearch_signup_allowed(text) to service_role;

create table if not exists public.member_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  role text not null default 'member' check (role in ('member','master')),
  status text not null default 'pending' check (status in ('pending','approved','deleted')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid
);
create table if not exists public.account_activity (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  actor_username text not null,
  kind text not null check (kind in ('data_created','search','ai_search')),
  created_at timestamptz not null default now()
);
create index if not exists account_activity_actor_time on public.account_activity(actor_id,created_at);
alter table public.info add column if not exists created_by uuid;
alter table public.info add column if not exists created_by_username text not null default '기존 자료';

create or replace function public.hansearch_is_approved() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.member_profiles where id=auth.uid() and status='approved');
$$;
create or replace function public.hansearch_is_master() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.member_profiles where id=auth.uid() and status='approved' and role='master');
$$;
revoke all on function public.hansearch_is_approved(),public.hansearch_is_master() from public;
grant execute on function public.hansearch_is_approved(),public.hansearch_is_master() to anon,authenticated,service_role;

create or replace function hansearch_private.create_profile() returns trigger
language plpgsql security definer set search_path='' as $$
declare login_name text;
begin
  if new.email not like '%@login.hansearch.invalid' then return new; end if;
  login_name := lower(split_part(new.email,'@',1));
  if login_name !~ '^[a-z0-9][a-z0-9_.-]{2,31}$' then raise exception 'invalid account ID'; end if;
  insert into hansearch_private.account_names(username,user_id) values(login_name,new.id);
  insert into public.member_profiles(id,username) values(new.id,login_name);
  return new;
end $$;
drop trigger if exists hansearch_create_profile on auth.users;
create trigger hansearch_create_profile after insert on auth.users for each row execute function hansearch_private.create_profile();

alter table public.member_profiles enable row level security;
alter table public.account_activity enable row level security;
revoke all on public.member_profiles,public.account_activity from anon,authenticated;
grant select on public.member_profiles to authenticated;
grant all on public.member_profiles,public.account_activity to service_role;
drop policy if exists hansearch_profiles_read on public.member_profiles;
create policy hansearch_profiles_read on public.member_profiles for select to authenticated
using (id=auth.uid() or (select public.hansearch_is_master()));

create or replace function public.hansearch_approve_account(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.hansearch_is_master() then raise exception 'master permission required' using errcode='42501'; end if;
  update public.member_profiles set status='approved',approved_at=now(),approved_by=auth.uid()
    where id=p_id and role='member' and status='pending';
  if not found then raise exception '승인 가능한 대기 계정이 없습니다.'; end if;
end $$;

create or replace function public.hansearch_prepare_account_deletion(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.hansearch_is_master() then raise exception 'master permission required' using errcode='42501'; end if;
  if p_id=auth.uid() or exists(select 1 from public.member_profiles where id=p_id and role='master') then
    raise exception '마스터 계정은 삭제할 수 없습니다.' using errcode='42501';
  end if;
  update public.member_profiles set status='deleted' where id=p_id and role='member';
  if not found then raise exception '계정을 찾을 수 없습니다.'; end if;
  -- Keep image objects used by shared records, and transfer their ownership before deleting Auth identity.
  update storage.objects set owner_id=auth.uid()::text where bucket_id='hansearch-images' and owner_id=p_id::text;
  if exists(select 1 from information_schema.columns where table_schema='storage' and table_name='objects' and column_name='owner') then
    execute 'update storage.objects set owner=$1 where bucket_id=$2 and owner=$3' using auth.uid(),'hansearch-images',p_id;
  end if;
end $$;

create or replace function hansearch_private.info_author() returns trigger
language plpgsql security definer set search_path='' as $$
declare member public.member_profiles;
begin
  if tg_op='UPDATE' then
    new.created_by:=old.created_by; new.created_by_username:=old.created_by_username; return new;
  end if;
  if auth.uid() is null then new.created_by:=null; new.created_by_username:='기존 자료'; return new; end if;
  select * into member from public.member_profiles where id=auth.uid() and status='approved';
  if not found then raise exception '승인된 계정이 필요합니다.' using errcode='42501'; end if;
  new.created_by:=member.id; new.created_by_username:=member.username;
  return new;
end $$;
drop trigger if exists hansearch_info_author on public.info;
create trigger hansearch_info_author before insert or update on public.info for each row execute function hansearch_private.info_author();
create or replace function hansearch_private.info_created_event() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.created_by is not null then
    insert into public.account_activity(actor_id,actor_username,kind) values(new.created_by,new.created_by_username,'data_created');
  end if;
  return new;
end $$;
drop trigger if exists hansearch_info_created_event on public.info;
create trigger hansearch_info_created_event after insert on public.info for each row execute function hansearch_private.info_created_event();

create or replace function public.hansearch_record_search(p_kind text,p_event_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare member public.member_profiles;
begin
  if p_kind not in ('search','ai_search') then raise exception 'invalid search kind'; end if;
  select * into member from public.member_profiles where id=auth.uid() and status='approved';
  if not found then raise exception '승인된 계정이 필요합니다.' using errcode='42501'; end if;
  insert into public.account_activity(id,actor_id,actor_username,kind) values(p_event_id,member.id,member.username,p_kind)
    on conflict(id) do nothing;
end $$;

create or replace function public.hansearch_account_statistics(p_start timestamptz default null,p_end timestamptz default null)
returns table(user_id uuid,username text,status text,role text,data_created bigint,searches bigint,ai_searches bigint,total_searches bigint)
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.hansearch_is_master() then raise exception 'master permission required' using errcode='42501'; end if;
  if p_start is not null and p_end is not null and p_start>=p_end then raise exception '날짜 범위를 확인해 주세요.'; end if;
  return query
  select n.user_id,n.username,coalesce(p.status,'deleted'),coalesce(p.role,'member'),
    count(a.id) filter(where a.kind='data_created'),count(a.id) filter(where a.kind='search'),
    count(a.id) filter(where a.kind='ai_search'),count(a.id) filter(where a.kind in ('search','ai_search'))
  from hansearch_private.account_names n left join public.member_profiles p on p.id=n.user_id
  left join public.account_activity a on a.actor_id=n.user_id and (p_start is null or a.created_at>=p_start) and (p_end is null or a.created_at<p_end)
  group by n.user_id,n.username,p.status,p.role order by count(a.id) desc,n.username;
end $$;

create or replace function public.hansearch_set_ai_sync_token(p_token text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.hansearch_is_master() then raise exception 'master permission required' using errcode='42501'; end if;
  if length(p_token)<32 or length(p_token)>256 then raise exception '연결키는 32~256자여야 합니다.'; end if;
  insert into hansearch_private.settings(key,value) values('ai_sync_hash',encode(sha256(convert_to(p_token,'UTF8')),'hex'))
    on conflict(key) do update set value=excluded.value;
end $$;
create or replace function public.hansearch_ai_snapshot(p_token text,p_offset integer default 0,p_limit integer default 500) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if p_token is null or length(p_token)<32 or not exists(select 1 from hansearch_private.settings where key='ai_sync_hash' and value=encode(sha256(convert_to(p_token,'UTF8')),'hex')) then
    raise exception 'AI sync authentication required' using errcode='42501';
  end if;
  if p_offset<0 or p_limit<1 or p_limit>1000 then raise exception 'invalid page'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'키워드',i.키워드,'키워드2',i.키워드2,'내용',i.내용,'이미지들',i.이미지들)),'[]'::jsonb)
    from (select * from public.info order by id offset p_offset limit p_limit) i);
end $$;

revoke all on function public.hansearch_approve_account(uuid),public.hansearch_prepare_account_deletion(uuid),public.hansearch_record_search(text,uuid),public.hansearch_account_statistics(timestamptz,timestamptz),public.hansearch_set_ai_sync_token(text),public.hansearch_ai_snapshot(text,integer,integer) from public;
grant execute on function public.hansearch_approve_account(uuid),public.hansearch_prepare_account_deletion(uuid),public.hansearch_record_search(text,uuid),public.hansearch_account_statistics(timestamptz,timestamptz),public.hansearch_set_ai_sync_token(text) to authenticated;
grant execute on function public.hansearch_ai_snapshot(text,integer,integer) to anon,authenticated,service_role;
revoke all on all functions in schema hansearch_private from public,anon,authenticated;
commit;
