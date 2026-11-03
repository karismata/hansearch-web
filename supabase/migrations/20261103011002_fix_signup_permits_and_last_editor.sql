begin;
-- GoTrue writes app_metadata after INSERT. Authorize the exact new UUID with
-- a short-lived server-only permit instead of inspecting metadata timing.
create table hansearch_private.signup_permits (
  user_id uuid primary key, username text not null,
  expires_at timestamptz not null default (now()+interval '2 minutes')
);
alter table hansearch_private.signup_permits enable row level security;
revoke all on hansearch_private.signup_permits from public,anon,authenticated;
create function public.hansearch_prepare_signup(p_id uuid,p_username text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_id is null or p_username !~ '^[a-z0-9][a-z0-9_.-]{2,31}$' or p_username='master' then raise exception 'invalid signup permit'; end if;
  delete from hansearch_private.signup_permits where expires_at<now();
  if exists(select 1 from hansearch_private.account_names where username=p_username) then raise exception 'username unavailable' using errcode='23505'; end if;
  insert into hansearch_private.signup_permits(user_id,username) values(p_id,p_username);
end $$;
create function public.hansearch_cancel_signup(p_id uuid) returns void
language sql security definer set search_path='' as $$ delete from hansearch_private.signup_permits where user_id=p_id; $$;
revoke all on function public.hansearch_prepare_signup(uuid,text),public.hansearch_cancel_signup(uuid) from public,anon,authenticated;
grant execute on function public.hansearch_prepare_signup(uuid,text),public.hansearch_cancel_signup(uuid) to service_role;
create or replace function hansearch_private.create_profile() returns trigger
language plpgsql security definer set search_path='' as $$
declare login_name text;
begin
  if new.email not like '%@login.hansearch.invalid' then return new; end if;
  login_name := lower(split_part(new.email,'@',1));
  if login_name !~ '^[a-z0-9][a-z0-9_.-]{2,31}$' or login_name='master' then raise exception 'invalid account ID'; end if;
  delete from hansearch_private.signup_permits where user_id=new.id and username=login_name and expires_at>=now();
  if not found then raise exception '한서치의 가입 신청 화면을 이용하세요.' using errcode='42501'; end if;
  insert into hansearch_private.account_names(username,user_id) values(login_name,new.id);
  insert into public.member_profiles(id,username) values(new.id,login_name);
  return new;
end $$;
revoke all on function hansearch_private.create_profile() from public,anon,authenticated;
-- Release counters from the failed rollout only while no member registered.
do $$ begin
  if exists(select 1 from public.member_profiles where username='master' and role='master')
    and not exists(select 1 from public.member_profiles where role='member') then delete from hansearch_private.signup_attempts; end if;
end $$;
alter table public.info add column updated_by uuid;
alter table public.info add column updated_by_username text;
alter table public.info add column last_edited_at timestamptz;
create or replace function hansearch_private.info_author() returns trigger
language plpgsql security definer set search_path='' as $$
declare member public.member_profiles;
begin
  if tg_op='UPDATE' then
    new.created_by:=old.created_by; new.created_by_username:=old.created_by_username;
    select * into member from public.member_profiles where id=auth.uid() and status='approved';
    if found then new.updated_by:=member.id; new.updated_by_username:=member.username; new.last_edited_at:=now();
    else new.updated_by:=old.updated_by; new.updated_by_username:=old.updated_by_username; new.last_edited_at:=old.last_edited_at; end if;
    return new;
  end if;
  new.updated_by:=null; new.updated_by_username:=null; new.last_edited_at:=null;
  if auth.uid() is null then new.created_by:=null; new.created_by_username:='기존 자료'; return new; end if;
  select * into member from public.member_profiles where id=auth.uid() and status='approved';
  if not found then raise exception '승인된 계정이 필요합니다.' using errcode='42501'; end if;
  new.created_by:=member.id; new.created_by_username:=member.username;
  return new;
end $$;
revoke all on function hansearch_private.info_author() from public,anon,authenticated;
commit;

