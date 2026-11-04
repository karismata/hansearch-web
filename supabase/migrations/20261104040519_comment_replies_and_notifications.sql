begin;
alter table public.info_comments add column parent_id uuid
  constraint info_comments_parent_id_fkey references public.info_comments(id) on delete cascade;
create index info_comments_thread_order on public.info_comments(parent_id,info_id,created_at,id);
grant insert(parent_id) on public.info_comments to authenticated;

create or replace function hansearch_private.comment_author() returns trigger
language plpgsql security definer set search_path='' as $$
declare member public.member_profiles; parent public.info_comments;
begin
  select * into member from public.member_profiles where id=auth.uid() and status='approved';
  if not found then raise exception '승인된 계정이 필요합니다.' using errcode='42501'; end if;
  new.body:=btrim(new.body);
  if tg_op='INSERT' then
    if new.parent_id is not null then
      select * into parent from public.info_comments where id=new.parent_id for key share;
      if not found or parent.info_id<>new.info_id or parent.parent_id is not null then
        raise exception '같은 자료의 원래 댓글에만 답글을 작성할 수 있습니다.' using errcode='23514';
      end if;
    end if;
    new.author_id:=member.id; new.author_username:=member.username;
    new.created_at:=now(); new.updated_at:=null;
  else
    new.id:=old.id; new.info_id:=old.info_id; new.parent_id:=old.parent_id;
    new.author_id:=old.author_id; new.author_username:=old.author_username;
    new.created_at:=old.created_at; new.updated_at:=now();
  end if;
  return new;
end $$;
revoke all on function hansearch_private.comment_author() from public,anon,authenticated,service_role;

create table public.comment_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  info_id bigint not null references public.info(id) on delete cascade,
  comment_id uuid not null references public.info_comments(id) on delete cascade,
  actor_username text not null,
  info_title text not null,
  kind text not null check(kind in ('comment','reply')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique(recipient_id,comment_id)
);
create index comment_notifications_recipient_order on public.comment_notifications(recipient_id,created_at,id);
create index comment_notifications_unread on public.comment_notifications(recipient_id) where read_at is null;
create index comment_notifications_info on public.comment_notifications(info_id);
create index comment_notifications_comment on public.comment_notifications(comment_id);
alter table public.comment_notifications enable row level security;
revoke all on public.comment_notifications from public,anon,authenticated;
grant select on public.comment_notifications to authenticated;
grant update(read_at) on public.comment_notifications to authenticated;
create policy hansearch_notifications_read on public.comment_notifications for select to authenticated
  using ((select public.hansearch_is_approved()) and recipient_id=(select auth.uid()));
create policy hansearch_notifications_read_state on public.comment_notifications for update to authenticated
  using ((select public.hansearch_is_approved()) and recipient_id=(select auth.uid()))
  with check ((select public.hansearch_is_approved()) and recipient_id=(select auth.uid()));

create function hansearch_private.notify_comment() returns trigger
language plpgsql security definer set search_path='' as $$
declare owner_id uuid; parent_author uuid; item_title text;
begin
  select created_by,left(coalesce("키워드2",'제목 없음'),200) into owner_id,item_title from public.info where id=new.info_id;
  if new.parent_id is not null then
    select author_id into parent_author from public.info_comments where id=new.parent_id;
  end if;
  insert into public.comment_notifications(recipient_id,info_id,comment_id,actor_username,info_title,kind)
    select p.id,new.info_id,new.id,new.author_username,item_title,
      case when p.id=parent_author then 'reply' else 'comment' end
    from public.member_profiles p
    where p.status='approved' and p.id<>new.author_id
      and (p.id=owner_id or p.id=parent_author)
    on conflict(recipient_id,comment_id) do nothing;
  return new;
end $$;
revoke all on function hansearch_private.notify_comment() from public,anon,authenticated,service_role;
create trigger hansearch_notify_comment after insert on public.info_comments
  for each row execute function hansearch_private.notify_comment();
notify pgrst,'reload schema';
commit;
