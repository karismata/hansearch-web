-- Owner-only setup. Create master@login.hansearch.invalid in Supabase Auth first.
-- Replace the UUID below with that exact Auth user's UUID. No password belongs in this script.
do $$
declare target uuid := 'REPLACE_WITH_AUTH_USER_UUID';
begin
  if not exists(select 1 from auth.users where id=target and email='master@login.hansearch.invalid') then
    raise exception 'Auth에서 직접 만든 master 계정의 UUID를 확인하세요.';
  end if;
  if exists(select 1 from public.member_profiles where role='master' and id<>target) then
    raise exception '마스터 계정이 이미 존재합니다.';
  end if;
  update public.member_profiles set role='master',status='approved',approved_at=now(),approved_by=target
    where id=target and username='master';
  if not found then raise exception '회원 프로필이 없습니다. 준비 마이그레이션 이후 Auth 계정을 생성하세요.'; end if;
end $$;
