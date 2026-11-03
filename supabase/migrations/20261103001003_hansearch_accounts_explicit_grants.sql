-- Hosted projects may grant new functions directly to anon through default ACLs.
-- Revoking PUBLIC alone does not remove those direct grants.
begin;
revoke all on function
  public.hansearch_is_approved(),
  public.hansearch_is_master(),
  public.hansearch_approve_account(uuid),
  public.hansearch_prepare_account_deletion(uuid),
  public.hansearch_record_search(text,uuid),
  public.hansearch_account_statistics(timestamptz,timestamptz),
  public.hansearch_set_ai_sync_token(text)
from public,anon;

-- Existing authenticated grants remain. Each privileged operation also checks
-- the current approved profile, with master-only operations checking its role.
-- The AI snapshot intentionally remains callable with an anon API key because
-- the Mac agent authenticates separately using its server-only sync token.
alter table hansearch_private.account_names enable row level security;
alter table hansearch_private.settings enable row level security;
alter table hansearch_private.signup_attempts enable row level security;
commit;

