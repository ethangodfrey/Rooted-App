-- Rooted Phase 22: in-app account deletion (Apple Guideline 5.1.1)
-- Allows authenticated users to permanently delete their own auth account.
-- Cascades to public.users → shoppers/vendors and related rows via FK on delete cascade.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
