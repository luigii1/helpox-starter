-- S4: rate limiting (CLAUDE.md §4 "Rate-limit auth-adjacent and
-- credit-consuming endpoints"). A tiny fixed-window hit counter in
-- Postgres, callable from server code before it runs the real work of a
-- request. Nothing about a rate limit is safe to enforce client-side, so
-- there is no client-callable table here at all — only a SECURITY DEFINER
-- function that records a hit and reports whether the caller is still
-- under the limit.

create table public.rate_limit_hits (
  id bigint generated always as identity primary key,
  rate_key text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_hits_key_created_idx on public.rate_limit_hits (rate_key, created_at);

-- RLS on with zero policies: no role, including authenticated, can select,
-- insert, update or delete a row directly. The only way in or out is the
-- function below.
alter table public.rate_limit_hits enable row level security;

-- Records one hit for p_key and reports whether the caller is still under
-- p_limit within the trailing p_window_seconds. Self-cleans: expired hits
-- for this exact key are deleted on every call, so the table never holds
-- more than each active key's own window of rows. A key that stops being
-- hit leaves its last few rows behind rather than being swept immediately;
-- fine at this app's scale, and cheap to add a scheduled cleanup for later
-- if it ever isn't (see docs/decisions.md).
--
-- Called both by anonymous requests (the auth callback runs before a
-- session exists) and by authenticated ones (checkout, credit consumption),
-- so both roles need EXECUTE — see the explicit grants below.
create function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_limit <= 0 or p_window_seconds <= 0 then
    raise exception 'check_rate_limit: limit and window_seconds must be positive';
  end if;

  delete from public.rate_limit_hits
  where rate_key = p_key
    and created_at < now() - make_interval(secs => p_window_seconds);

  select count(*) into v_count
  from public.rate_limit_hits
  where rate_key = p_key;

  if v_count >= p_limit then
    return false;
  end if;

  insert into public.rate_limit_hits (rate_key) values (p_key);
  return true;
end;
$$;

-- Supabase's own setup grants EXECUTE on new public-schema functions
-- directly to anon/authenticated by default (not merely inherited via
-- PUBLIC), so `revoke ... from public` alone does not lock this down —
-- each role needs its own explicit revoke (same fix as brick E2's credit
-- functions). Here both anon and authenticated are then explicitly
-- re-granted, since this function is meant to be called by both.
revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to anon, authenticated;
