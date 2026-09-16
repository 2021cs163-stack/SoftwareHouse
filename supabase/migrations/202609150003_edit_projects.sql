-- Run once after the project details / investments migration (002).
-- Adds project editing; payments and subscription dates are preserved.
begin;
create or replace function public.rayan_update_project(payload jsonb, request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 p rayan_private.projects%rowtype;
 new_start date;
begin
 perform rayan_private.require_member();
 if request_id is null then raise exception 'A request ID is required.'; end if;
 perform pg_advisory_xact_lock(7249261101);
 if exists(select 1 from rayan_private.events where id=request_id) then
  return jsonb_build_object('saved',true,'duplicate',true);
 end if;
 select * into p from rayan_private.projects where id=(payload->>'project_id')::uuid for update;
 if not found then raise exception 'Project not found.'; end if;
 new_start := (payload->>'start_date')::date;
 if p.status='done' and (payload->>'type') is distinct from p.type then
  raise exception 'The type of a completed project cannot be changed.';
 end if;
 if p.status='done' and new_start>p.completed_on then
  raise exception 'Start date cannot be later than the completion date.';
 end if;
 update rayan_private.projects set
  name=trim(payload->>'name'),
  contract_id=trim(payload->>'contract_id'),
  client=trim(payload->>'client'),
  client_contact=trim(coalesce(payload->>'client_contact','')),
  repo_url=trim(coalesce(payload->>'repo_url','')),
  deployment_url=trim(coalesce(payload->>'deployment_url','')),
  details=trim(coalesce(payload->>'details','')),
  responsible=payload->>'responsible',
  start_date=new_start,
  type=payload->>'type'
 where id=p.id;
 insert into rayan_private.events(id,action,description,created_by)
 values(request_id,'edit_project','Project updated · '||trim(payload->>'contract_id'),auth.uid());
 return jsonb_build_object('saved',true);
end;
$$;
revoke all on function public.rayan_update_project(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.rayan_update_project(jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
