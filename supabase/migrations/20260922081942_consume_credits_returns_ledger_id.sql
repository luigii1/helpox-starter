-- F1: the example feature needs to refund the exact ledger row a failed
-- action's consume created (CLAUDE.md §5: refund via the same mechanism
-- that wrote the ledger entry, never a guess at "the most recent one").
-- consume_credits previously returned only the new balance; this adds the
-- ledger row's id via OUT parameters. The return type is changing, so the
-- function has to be dropped and recreated rather than CREATE OR REPLACE'd
-- (Postgres rejects an in-place return-type change) — nothing in src/ calls
-- consume_credits yet, so there is no existing caller to break.
drop function if exists public.consume_credits(integer);

create function public.consume_credits(p_amount integer, out new_balance integer, out ledger_id bigint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_amount <= 0 then
    raise exception 'consume_credits: amount must be positive';
  end if;

  update public.profiles
  set credits = credits - p_amount
  where id = auth.uid() and credits >= p_amount
  returning credits into new_balance;

  if new_balance is null then
    raise exception 'insufficient_credits';
  end if;

  insert into public.credit_ledger (user_id, delta, reason)
  values (auth.uid(), -p_amount, 'consume')
  returning id into ledger_id;
end;
$$;

revoke all on function public.consume_credits(integer) from public, anon;
grant execute on function public.consume_credits(integer) to authenticated;
