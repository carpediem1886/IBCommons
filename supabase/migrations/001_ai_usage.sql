-- Counts AI requests per student per day, used by the "ai" Edge Function to enforce a daily limit.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  count integer not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;
-- No policies: only the Edge Function (service role) reads or writes this table.

create or replace function public.bump_ai_usage(p_user uuid)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.ai_usage (user_id, day, count)
  values (p_user, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count;
$$;

revoke all on function public.bump_ai_usage(uuid) from public, anon, authenticated;
