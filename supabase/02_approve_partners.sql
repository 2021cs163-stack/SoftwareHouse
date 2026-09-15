-- Run AFTER the migration and after creating the four users in
-- Supabase > Authentication > Users. Replace these four placeholders.
-- This grants equal workspace access; it does not create passwords or users.
begin;
do $$
declare
 emails text[] := array[
  'admin@khoshalrayan.af',
  'admin@fazlrayan.af',
  'admin@nomarayan.af',
  'admin@akmalrayan.af'
 ];
 names text[] := array[
  'Fazlullah Sardarkhil','Khoshal Amin','Akmal Stanikzai','Noman Wahdat'
 ];
 account_id uuid;
 i integer;
begin
 if (select count(distinct lower(e)) from unnest(emails) e)<>4 then
  raise exception 'Enter four different partner email addresses.';
 end if;
 for i in 1..4 loop
  select id into account_id from auth.users where lower(email)=lower(emails[i]);
  if account_id is null then raise exception 'Create this partner in Authentication first: %',emails[i]; end if;
  insert into rayan_private.members(user_id,display_name,active)
  values(account_id,names[i],true)
  on conflict(user_id) do update set display_name=excluded.display_name,active=true;
 end loop;
end;
$$;
commit;
