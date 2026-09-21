-- profiles: one row per auth user, holding their cached credit balance.
-- Created automatically by a trigger on auth.users; never inserted, updated
-- or deleted by client roles (see CLAUDE.md §4/§5 — the ledger and its
-- database functions, added in a later migration, own all balance changes).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  credits integer not null default 0 check (credits >= 0),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

-- Both roles keep SELECT so a query is a normal empty result, not a
-- permission error; the policy above (scoped to authenticated) is what
-- actually hides every row from anon.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;

-- Auto-create a profile row whenever a new auth user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
