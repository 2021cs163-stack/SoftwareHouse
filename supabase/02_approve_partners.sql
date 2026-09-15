-- DEPRECATED: Do not run. Use 03_single_user_access.sql instead.
-- Run AFTER the migration and after creating the administrator in
-- Supabase > Authentication > Users.
-- This grants workspace access; it does not create a password or user.
begin;
do $$
declare
 admin_email text := 'admin@rayan.af';
 account_id uuid;
begin
 select id into account_id from auth.users where lower(email)=lower(admin_email);
 if account_id is null then
  raise exception 'Create the administrator in Authentication first: %',admin_email;
 end if;
 insert into rayan_private.members(user_id,display_name,active)
 values(account_id,'Administrator',true)
 on conflict(user_id) do update set display_name='Administrator',active=true;
end;
$$;
commit;
