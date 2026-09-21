-- E2: credit database functions (CLAUDE.md §5). SECURITY DEFINER,
-- search_path = '', fully qualified names (CLAUDE.md §4). These are the
-- ONLY way credit_ledger and profiles.credits are ever written.
--
-- Parameters are p_-prefixed throughout: an unprefixed name like
-- `external_id` is ambiguous in `on conflict (external_id)` between the
-- plpgsql parameter and the table column of the same name (caught by
-- testing against a real Postgres instance before this migration shipped).

-- Adds credits: service-role only. Idempotent when p_external_id is given —
-- a repeat call with the same external_id is a no-op (`on conflict do
-- nothing`), which is what makes the webhook (brick E4) and the sign-up
-- bonus safe to retry.
create function public.grant_credits(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_external_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_amount <= 0 then
    raise exception 'grant_credits: amount must be positive';
  end if;

  insert into public.credit_ledger (user_id, delta, reason, external_id, metadata)
  values (p_user_id, p_amount, p_reason, p_external_id, p_metadata)
  on conflict (external_id) do nothing;

  if not found then
    return;
  end if;

  update public.profiles
  set credits = credits + p_amount
  where id = p_user_id;
end;
$$;

revoke all on function public.grant_credits(uuid, integer, text, text, jsonb) from public;
grant execute on function public.grant_credits(uuid, integer, text, text, jsonb) to service_role;

-- Spends the caller's own credits: callable by any authenticated user, but
-- always against auth.uid() — never a user id argument, so one user can
-- never consume another's balance. The single `update ... where credits >=
-- p_amount returning` is what makes two concurrent calls on a balance of 1
-- resolve to exactly one success (Postgres locks the row on the first
-- UPDATE; the second re-checks the WHERE clause against the committed
-- result once the lock releases).
create function public.consume_credits(p_amount integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_new_balance integer;
begin
  if v_user_id is null then
    raise exception 'consume_credits: no authenticated user';
  end if;
  if p_amount <= 0 then
    raise exception 'consume_credits: amount must be positive';
  end if;

  update public.profiles
  set credits = credits - p_amount
  where id = v_user_id and credits >= p_amount
  returning credits into v_new_balance;

  if v_new_balance is null then
    raise exception 'insufficient_credits';
  end if;

  insert into public.credit_ledger (user_id, delta, reason)
  values (v_user_id, -p_amount, 'consume');

  return v_new_balance;
end;
$$;

revoke all on function public.consume_credits(integer) from public;
grant execute on function public.consume_credits(integer) to authenticated;

-- Reverses a ledger entry (e.g. a consume, when the product action it paid
-- for then failed): service-role only. Idempotent per ledger row via a
-- derived external_id, so retrying a refund for the same row is a no-op.
create function public.refund_credits(p_ledger_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original public.credit_ledger%rowtype;
  v_refund_external_id text;
begin
  select * into v_original from public.credit_ledger where id = p_ledger_id;
  if not found then
    raise exception 'refund_credits: ledger row % not found', p_ledger_id;
  end if;

  v_refund_external_id := 'refund:' || p_ledger_id;

  insert into public.credit_ledger (user_id, delta, reason, external_id, metadata)
  values (
    v_original.user_id,
    -v_original.delta,
    'refund',
    v_refund_external_id,
    jsonb_build_object('refund_of', p_ledger_id)
  )
  on conflict (external_id) do nothing;

  if not found then
    return;
  end if;

  update public.profiles
  set credits = credits - v_original.delta
  where id = v_original.user_id;
end;
$$;

revoke all on function public.refund_credits(bigint) from public;
grant execute on function public.refund_credits(bigint) to service_role;
