-- Run after the initial workspace migration in Supabase SQL Editor.
-- Create ONE email/password account in Authentication > Users.
-- Replace YOUR_LOGIN_EMAIL below with that account's email.
-- All projects, payments and partner records are preserved.
-- Existing other accounts lose workspace access but are not deleted.
begin;
do $$
declare
 admin_email text := 'admin@rayan.af';
 account_id uuid;
begin
 select id into account_id from auth.users where lower(email)=lower(trim(admin_email));
 if account_id is null then
  raise exception 'Create the login user in Authentication, then replace YOUR_LOGIN_EMAIL with its email.';
 end if;
 alter table rayan_private.members drop constraint if exists members_display_name_fkey;
 update rayan_private.members set active=false;
 insert into rayan_private.members(user_id,display_name,active)
 values(account_id,'Administrator',true)
 on conflict(user_id) do update set display_name='Administrator',active=true;
end;
$$;
create unique index if not exists rayan_one_active_login
 on rayan_private.members ((active)) where active;
commit;
