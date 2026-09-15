-- Rayan Tech Solution: run once in Supabase SQL Editor as the project owner.
-- This migration adds only rayan_* RPCs and a dedicated private schema.
begin;
create schema if not exists rayan_private;
revoke all on schema rayan_private from public, anon, authenticated;

create table rayan_private.partners (
 name text primary key
);
insert into rayan_private.partners(name) values
 ('Fazlullah Sardarkhil'), ('Khoshal Amin'), ('Akmal Stanikzai'), ('Noman Wahdat');

create table rayan_private.members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null references rayan_private.partners(name),
 active boolean not null default true
);
create table rayan_private.projects (
 id uuid primary key default gen_random_uuid(),
 contract_id text not null check (length(trim(contract_id)) between 1 and 100),
 name text not null check (length(trim(name)) between 1 and 200),
 client text not null check (length(trim(client)) between 1 and 200),
 type text not null check (type in ('online','offline')),
 responsible text not null references rayan_private.partners(name),
 start_date date not null,
 amount numeric(14,2) not null check (amount > 0),
 status text not null default 'ongoing' check (status in ('ongoing','done')),
 completed_on date,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 check ((status='ongoing' and completed_on is null) or (status='done' and completed_on >= start_date))
);
create unique index rayan_contract_unique on rayan_private.projects(lower(trim(contract_id)));
create table rayan_private.receipts (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references rayan_private.projects(id),
 amount numeric(14,2) not null check (amount > 0),
 date date not null,
 note text not null default '' check (length(note)<=500),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index rayan_receipts_project on rayan_private.receipts(project_id);
create table rayan_private.expenses (
 id uuid primary key default gen_random_uuid(),
 reason text not null check (length(trim(reason)) between 1 and 500),
 amount numeric(14,2) not null check (amount > 0),
 date date not null,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table rayan_private.payouts (
 id uuid primary key default gen_random_uuid(),
 partner text not null references rayan_private.partners(name),
 amount numeric(14,2) not null check (amount > 0),
 date date not null,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table rayan_private.subscriptions (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references rayan_private.projects(id),
 starts_on date not null,
 expires_on date not null,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 check(expires_on > starts_on),
 unique(project_id, starts_on)
);
create table rayan_private.events (
 id uuid primary key,
 action text not null,
 description text not null,
 amount numeric(14,2),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table rayan_private.notification_reads (
 user_id uuid not null references auth.users(id) on delete cascade,
 notification_id text not null check(length(notification_id)<=200),
 read_at timestamptz not null default now(),
 primary key(user_id,notification_id)
);
-- No direct table access is granted. All public RPCs check active membership.
alter table rayan_private.partners enable row level security;
alter table rayan_private.members enable row level security;
alter table rayan_private.projects enable row level security;
alter table rayan_private.receipts enable row level security;
alter table rayan_private.expenses enable row level security;
alter table rayan_private.payouts enable row level security;
alter table rayan_private.subscriptions enable row level security;
alter table rayan_private.events enable row level security;
alter table rayan_private.notification_reads enable row level security;
revoke all on all tables in schema rayan_private from public, anon, authenticated;

create function rayan_private.require_member() returns void
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not exists (
  select 1 from rayan_private.members where user_id=auth.uid() and active
 ) then raise exception 'Your account is not approved for the Rayan workspace.' using errcode='42501'; end if;
end;
$$;
revoke all on function rayan_private.require_member() from public, anon, authenticated;

create function public.rayan_snapshot() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
 perform rayan_private.require_member();
 select jsonb_build_object(
  'projects',coalesce((select jsonb_agg(p order by p.created_at desc) from rayan_private.projects p),'[]'::jsonb),
  'receipts',coalesce((select jsonb_agg(r order by r.date desc,r.created_at desc) from rayan_private.receipts r),'[]'::jsonb),
  'expenses',coalesce((select jsonb_agg(e order by e.date desc,e.created_at desc) from rayan_private.expenses e),'[]'::jsonb),
  'payouts',coalesce((select jsonb_agg(p order by p.date desc,p.created_at desc) from rayan_private.payouts p),'[]'::jsonb),
  'subscriptions',coalesce((select jsonb_agg(s order by s.created_at desc) from rayan_private.subscriptions s),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(x order by x.created_at desc) from (
    select e.*,m.display_name as actor from rayan_private.events e
    left join rayan_private.members m on m.user_id=e.created_by
  ) x),'[]'::jsonb),
  'reads',coalesce((select jsonb_agg(notification_id) from rayan_private.notification_reads where user_id=auth.uid()),'[]'::jsonb)
 ) into result;
 return result;
end;
$$;

create function public.rayan_action(action_name text, payload jsonb, request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 actor uuid := auth.uid();
 local_today date := (now() at time zone 'Asia/Kabul')::date;
 item_id uuid := gen_random_uuid();
 p rayan_private.projects%rowtype;
 last_period rayan_private.subscriptions%rowtype;
 value numeric(14,2);
 deposit numeric(14,2);
 effective_date date;
 new_start date;
 received numeric(14,2);
 spent numeric(14,2);
 paid numeric(14,2);
 partner_paid numeric(14,2);
 available numeric(14,2);
 summary text;
begin
 perform rayan_private.require_member();
 if request_id is null then raise exception 'A request ID is required.'; end if;
 -- Serialize all ledger mutations to prevent concurrent overpayment/overdistribution.
 perform pg_advisory_xact_lock(7249261101);
 if exists(select 1 from rayan_private.events where id=request_id) then
  return jsonb_build_object('saved',true,'duplicate',true);
 end if;
 value := nullif(payload->>'amount','')::numeric;
 effective_date := coalesce(nullif(payload->>'date','')::date,local_today);
 if effective_date > local_today then raise exception 'Transactions cannot be dated in the future.'; end if;
 if action_name in ('create_project','receive_payment','add_expense','pay_partner') and (value is null or value<=0) then
  raise exception 'Enter an amount greater than zero.';
 end if;

 if action_name='create_project' then
  deposit := coalesce(nullif(payload->>'deposit','')::numeric,0);
  if deposit<0 or deposit>value then raise exception 'Deposit must be between zero and the full contract amount.'; end if;
  insert into rayan_private.projects(id,contract_id,name,client,type,responsible,start_date,amount,created_by)
  values(item_id,trim(payload->>'contract_id'),trim(payload->>'name'),trim(payload->>'client'),
   payload->>'type',payload->>'responsible',(payload->>'start_date')::date,value,actor);
  if deposit>0 then
   effective_date := (payload->>'deposit_date')::date;
   if effective_date is null or effective_date>local_today then raise exception 'Choose a valid deposit receipt date.'; end if;
   insert into rayan_private.receipts(project_id,amount,date,note,created_by)
   values(item_id,deposit,effective_date,'Initial deposit',actor);
  end if;
  summary := 'Project added · '||trim(payload->>'contract_id');

 elsif action_name='complete_project' then
  select * into p from rayan_private.projects where id=(payload->>'project_id')::uuid for update;
  if not found then raise exception 'Project not found.'; end if;
  if p.status='done' then raise exception 'This project is already complete.'; end if;
  if effective_date<p.start_date then raise exception 'Completion cannot precede the start date.'; end if;
  update rayan_private.projects set status='done',completed_on=effective_date where id=p.id;
  if p.type='online' then
   insert into rayan_private.subscriptions(project_id,starts_on,expires_on,created_by)
   values(p.id,effective_date,(effective_date+interval '1 year')::date,actor);
  end if;
  summary := 'Project completed · '||p.contract_id;

 elsif action_name='receive_payment' then
  select * into p from rayan_private.projects where id=(payload->>'project_id')::uuid for update;
  if not found then raise exception 'Project not found.'; end if;
  select coalesce(sum(amount),0) into received from rayan_private.receipts where project_id=p.id;
  if value>p.amount-received then raise exception 'Payment exceeds the outstanding project balance.'; end if;
  insert into rayan_private.receipts(project_id,amount,date,note,created_by)
  values(p.id,value,effective_date,coalesce(payload->>'note',''),actor);
  summary := 'Payment received · '||p.contract_id;

 elsif action_name='add_expense' then
  insert into rayan_private.expenses(reason,amount,date,created_by)
  values(trim(payload->>'reason'),value,effective_date,actor);
  summary := 'Expense recorded · '||trim(payload->>'reason');

 elsif action_name='pay_partner' then
  select coalesce(sum(amount),0) into received from rayan_private.receipts;
  select coalesce(sum(amount),0) into spent from rayan_private.expenses;
  select coalesce(sum(amount),0) into paid from rayan_private.payouts;
  select coalesce(sum(amount),0) into partner_paid from rayan_private.payouts where partner=payload->>'partner';
  available := floor(greatest(received-spent,0)*100/4)/100-partner_paid;
  if value>available or value>received-spent-paid then
   raise exception 'Payment exceeds the partner balance or available business cash.';
  end if;
  insert into rayan_private.payouts(partner,amount,date,created_by)
  values(payload->>'partner',value,effective_date,actor);
  summary := 'Partner paid · '||(payload->>'partner');

 elsif action_name='renew_subscription' then
  select * into p from rayan_private.projects where id=(payload->>'project_id')::uuid for update;
  if not found or p.status<>'done' or p.type<>'online' then raise exception 'Only completed online projects can be renewed.'; end if;
  select * into last_period from rayan_private.subscriptions where project_id=p.id order by expires_on desc limit 1;
  if not found then raise exception 'Subscription not found.'; end if;
  if local_today<(last_period.expires_on-interval '1 month')::date then raise exception 'Renewals open one month before expiry.'; end if;
  new_start := greatest(local_today,last_period.expires_on);
  insert into rayan_private.subscriptions(project_id,starts_on,expires_on,created_by)
  values(p.id,new_start,(new_start+interval '1 year')::date,actor);
  summary := 'Subscription renewed · '||p.contract_id;
 else raise exception 'Unknown action.';
 end if;
 insert into rayan_private.events(id,action,description,amount,created_by)
 values(request_id,action_name,summary,value,actor);
 return jsonb_build_object('saved',true);
end;
$$;

create function public.rayan_mark_read(notification_ids text[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
 perform rayan_private.require_member();
 insert into rayan_private.notification_reads(user_id,notification_id)
 select auth.uid(),id from unnest(notification_ids) id
 on conflict(user_id,notification_id) do nothing;
end;
$$;
revoke all on function public.rayan_snapshot() from public, anon, authenticated;
revoke all on function public.rayan_action(text,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.rayan_mark_read(text[]) from public, anon, authenticated;
grant execute on function public.rayan_snapshot() to authenticated;
grant execute on function public.rayan_action(text,jsonb,uuid) to authenticated;
grant execute on function public.rayan_mark_read(text[]) to authenticated;
notify pgrst, 'reload schema';
commit;
