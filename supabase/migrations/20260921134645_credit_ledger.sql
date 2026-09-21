-- credit_ledger: append-only record of every credit change (grant, purchase,
-- consume, refund). profiles.credits (added in E2) is a cached balance kept
-- in sync with this table; this table is the source of truth (CLAUDE.md §5).
create table public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null,
  reason text not null check (reason in ('purchase', 'consume', 'refund', 'grant')),
  external_id text unique,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index credit_ledger_user_id_idx on public.credit_ledger (user_id);

alter table public.credit_ledger enable row level security;

create policy "credit_ledger_select_own"
  on public.credit_ledger
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Append-only: no client role may insert, update or delete a row. Only the
-- service role writes here, and only through the SECURITY DEFINER functions
-- added in brick E2 (grant_credits / consume_credits / refund_credits).
revoke insert, update, delete on public.credit_ledger from anon, authenticated;
grant select on public.credit_ledger to anon, authenticated;
