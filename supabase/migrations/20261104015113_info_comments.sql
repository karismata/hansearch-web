begin;
create table public.info_comments (
  id uuid primary key default gen_random_uuid(),
  info_id bigint not null references public.info(id) on delete cascade,
  author_id uuid not null,
  author_username text not null,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index info_comments_item_order on public.info_comments(info_id,created_at,id);
create index info_comments_author on public.info_comments(author_id);
alter table public.info_comments enable row level security;
revoke all on public.info_comments from public,anon,authenticated;
grant select,delete on public.info_comments to authenticated;
grant insert(info_id,body) on public.info_comments to authenticated;
grant update(body) on public.info_comments to authenticated;

-- The DB stamps identity and timestamps; clients cannot impersonate authors.
-- Keep historical names after account deletion, as with info attribution.
create function hansearch_private.comment_author() returns trigger
language plpgsql security definer set search_path='' as $$
declare member public.member_profiles;
begin
  select * into member from public.member_profiles where id=auth.uid() and status='approved';
  if not found then raise exception '승인된 계정이 필요합니다.' using errcode='42501'; end if;
  new.body:=btrim(new.body);
  if tg_op='INSERT' then
    new.author_id:=member.id; new.author_username:=member.username;
    new.created_at:=now(); new.updated_at:=null;
  else
    new.id:=old.id; new.info_id:=old.info_id;
    new.author_id:=old.author_id; new.author_username:=old.author_username;
    new.created_at:=old.created_at; new.updated_at:=now();
  end if;
  return new;
end $$;
revoke all on function hansearch_private.comment_author() from public,anon,authenticated,service_role;
create trigger hansearch_comment_author before insert or update on public.info_comments
  for each row execute function hansearch_private.comment_author();

create policy hansearch_comments_read on public.info_comments for select to authenticated
  using ((select public.hansearch_is_approved()));
create policy hansearch_comments_add on public.info_comments for insert to authenticated
  with check ((select public.hansearch_is_approved()) and author_id=(select auth.uid()));
create policy hansearch_comments_edit on public.info_comments for update to authenticated
  using ((select public.hansearch_is_approved()) and author_id=(select auth.uid()))
  with check ((select public.hansearch_is_approved()) and author_id=(select auth.uid()));
create policy hansearch_comments_delete on public.info_comments for delete to authenticated
  using ((select public.hansearch_is_approved()) and
    (author_id=(select auth.uid()) or (select public.hansearch_is_master())));
commit;

