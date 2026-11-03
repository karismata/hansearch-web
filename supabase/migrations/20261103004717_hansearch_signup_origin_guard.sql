-- Apply after the owner-created master exists and accounts Edge Function v2 is deployed.
-- Scope this restriction to HanSearch aliases; other applications keep their signup settings.
begin;
create or replace function hansearch_private.create_profile() returns trigger
language plpgsql security definer set search_path='' as $$
declare login_name text;
begin
  if new.email not like '%@login.hansearch.invalid' then return new; end if;
  -- Only the server Admin API can set app_metadata; user_metadata is never trusted.
  if new.raw_app_meta_data->>'hansearch_registration' is distinct from 'true' then
    raise exception '한서치의 가입 신청 화면을 이용하세요.' using errcode='42501';
  end if;
  login_name := lower(split_part(new.email,'@',1));
  if login_name !~ '^[a-z0-9][a-z0-9_.-]{2,31}$' or login_name='master' then
    raise exception 'invalid account ID';
  end if;
  insert into hansearch_private.account_names(username,user_id) values(login_name,new.id);
  insert into public.member_profiles(id,username) values(new.id,login_name);
  return new;
end $$;
revoke all on function hansearch_private.create_profile() from public,anon,authenticated;
commit;

