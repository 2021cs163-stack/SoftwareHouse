
-- Apply once AFTER 202609150001_workspace.sql.
-- Adds project details and partner capital; existing records and account access are preserved.
begin;
alter table rayan_private.projects
 add column client_contact text not null default '' check(length(client_contact)<=200),
 add column repo_url text not null default '' check(length(repo_url)<=2000 and (repo_url='' or repo_url ~ '^https?://[^[:space:]]+$')),
 add column deployment_url text not null default '' check(length(deployment_url)<=2000 and (deployment_url='' or deployment_url ~ '^https?://[^[:space:]]+$')),
 add column details text not null default '' check(length(details)<=4000);
create table rayan_private.investments (
 id uuid primary key default gen_random_uuid(),
 partner text not null references rayan_private.partners(name),
 amount numeric(14,2) not null check(amount>0 and amount::text<>'NaN'),
 date date not null,
 note text not null default '' check(length(note)<=500),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
alter table rayan_private.investments enable row level security;
revoke all on rayan_private.investments from public,anon,authenticated;
create or replace function public.rayan_snapshot() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
 perform rayan_private.require_member();
 select jsonb_build_object(
  'investments',coalesce((select jsonb_agg(i order by i.date desc,i.created_at desc) from rayan_private.investments i),'[]'::jsonb),
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

create or replace function public.rayan_action(action_name text, payload jsonb, request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 actor uuid := auth.uid();
 local_today date := (now() at time zone 'Asia/Kabul')::date;
 item_id uuid := gen_random_uuid();
 p rayan_private.projects%rowtype;
 last_period rayan_private.subscriptions%rowtype;
 value numeric(14,2);
 initial_paid numeric(14,2);
 remaining_entered numeric(14,2);
 invested numeric(14,2);
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
 if action_name in ('receive_payment','add_expense','pay_partner','add_investment') and (value is null or value<=0 or value::text='NaN') then
  raise exception 'Enter an amount greater than zero.';
 end if;

 if action_name='create_project' then

  if coalesce(payload->>'paid_amount','') !~ '^[0-9]+([.][0-9]{1,2})?$'
   or coalesce(payload->>'remaining_amount','') !~ '^[0-9]+([.][0-9]{1,2})?$' then
   raise exception 'Enter paid and remaining amounts with up to two decimal places.';
  end if;
  initial_paid := (payload->>'paid_amount')::numeric;
  remaining_entered := (payload->>'remaining_amount')::numeric;
  value := initial_paid + remaining_entered;
  if value<=0 then raise exception 'Paid plus remaining must be greater than zero.'; end if;
  insert into rayan_private.projects(id,contract_id,name,client,type,responsible,start_date,amount,created_by,
   client_contact,repo_url,deployment_url,details)
  values(item_id,trim(payload->>'contract_id'),trim(payload->>'name'),trim(payload->>'client'),
   payload->>'type',payload->>'responsible',(payload->>'start_date')::date,value,actor,
   trim(coalesce(payload->>'client_contact','')),trim(coalesce(payload->>'repo_url','')),
   trim(coalesce(payload->>'deployment_url','')),trim(coalesce(payload->>'details','')));
  if initial_paid>0 then
   effective_date := (payload->>'paid_date')::date;
   if effective_date is null or effective_date>local_today then raise exception 'Choose a valid payment receipt date.'; end if;
   insert into rayan_private.receipts(project_id,amount,date,note,created_by)
   values(item_id,initial_paid,effective_date,'Payment recorded when project was added',actor);
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


 elsif action_name='add_investment' then
  insert into rayan_private.investments(partner,amount,date,note,created_by)
  values(payload->>'partner',value,effective_date,coalesce(payload->>'note',''),actor);
  summary := 'Partner investment · '||(payload->>'partner');
 elsif action_name='pay_partner' then
  select coalesce(sum(amount),0) into received from rayan_private.receipts;
  select coalesce(sum(amount),0) into spent from rayan_private.expenses;
  select coalesce(sum(amount),0) into paid from rayan_private.payouts;
  select coalesce(sum(amount),0) into partner_paid from rayan_private.payouts where partner=payload->>'partner';
  select coalesce(sum(amount),0) into invested from rayan_private.investments;
  available := floor(greatest(received-spent,0)*100/4)/100-partner_paid;
  if value>available or value>received+invested-spent-paid then
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


revoke all on function public.rayan_snapshot() from public,anon,authenticated;
revoke all on function public.rayan_action(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.rayan_snapshot() to authenticated;
grant execute on function public.rayan_action(text,jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
