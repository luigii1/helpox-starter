-- E5: grants the one-time sign-up credit, but only once the user's email is
-- actually confirmed — not on mere row insert. For this app's two sign-in
-- methods (magic link, Google) that confirmation can show up either as an
-- already-confirmed INSERT (Google) or as a later UPDATE that sets
-- email_confirmed_at (magic link, once the link is clicked) — this trigger
-- covers both, and relies on grant_credits' own idempotent external_id
-- (`signup:<user_id>`, unique in credit_ledger) so a double-fire is a no-op,
-- exactly like the existing credit functions already guarantee.
create function public.handle_user_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  -- Defensive, not a dependency on trigger firing order: on_auth_user_created
  -- (brick D1) already creates this row on insert, but a signup and its
  -- confirmation can arrive as separate events on some providers, so make
  -- sure the row grant_credits updates actually exists first.
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;

  perform public.grant_credits(new.id, 1, 'grant', 'signup:' || new.id::text);
  return new;
end;
$$;

create trigger on_auth_user_email_confirmed
  after insert or update of email_confirmed_at on auth.users
  for each row
  execute function public.handle_user_email_confirmed();

-- Trigger functions can only ever be invoked as triggers (Postgres itself
-- rejects a direct call), so this isn't closing a real hole — just the same
-- explicit-revoke habit used for every other function here, since Supabase
-- grants EXECUTE on new public functions to anon/authenticated by default.
revoke all on function public.handle_user_email_confirmed() from public, anon, authenticated;
