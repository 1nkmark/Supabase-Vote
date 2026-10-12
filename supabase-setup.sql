-- 在 Supabase SQL Editor 执行。仅创建本题专用表，不修改原欧拉图 votes 表。
begin;
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
grant usage on schema private to anon,authenticated;

create table if not exists public.resolution_rounds (
  id bigint generated always as identity primary key,
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.resolution_votes (
  round_id bigint not null references public.resolution_rounds(id),
  device_id uuid not null,
  choice text not null check (choice in ('A','B')),
  created_at timestamptz not null default now(),
  primary key (round_id,device_id)
);
alter table public.resolution_rounds enable row level security;
alter table public.resolution_votes enable row level security;
revoke all on public.resolution_rounds,public.resolution_votes from public,anon,authenticated;
insert into public.resolution_rounds(is_open)
select true where not exists(select 1 from public.resolution_rounds);

-- Privileged implementations live outside Supabase's exposed API schemas.
create or replace function private.resolution_state(p_device_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.resolution_rounds; a bigint; b bigint; mine text;
begin
  select * into r from public.resolution_rounds order by id desc limit 1;
  if r.id is null then raise exception '尚未创建投票轮次'; end if;
  select count(*) filter(where choice='A'),count(*) filter(where choice='B'),
    max(choice) filter(where device_id=p_device_id)
    into a,b,mine from public.resolution_votes where round_id=r.id;
  return jsonb_build_object('round_id',r.id,'is_open',r.is_open,'a',a,'b',b,'my_choice',mine);
end;
$$;

create or replace function private.resolution_submit(p_device_id uuid,p_choice text,p_round_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.resolution_rounds; saved text;
begin
  if p_device_id is null then raise exception '缺少设备标识'; end if;
  if p_choice is null or p_choice not in ('A','B') then raise exception '无效选项'; end if;
  select * into r from public.resolution_rounds order by id desc limit 1 for share;
  if r.id is null or p_round_id is distinct from r.id then raise exception '投票轮次已变更，请刷新'; end if;
  select choice into saved from public.resolution_votes where round_id=r.id and device_id=p_device_id;
  if saved is not null then return jsonb_build_object('choice',saved); end if;
  if not r.is_open then raise exception '本轮投票已结束'; end if;
  insert into public.resolution_votes(round_id,device_id,choice) values(r.id,p_device_id,p_choice)
    on conflict (round_id,device_id) do nothing;
  select choice into saved from public.resolution_votes where round_id=r.id and device_id=p_device_id;
  return jsonb_build_object('choice',saved);
end;
$$;
revoke all on function private.resolution_state(uuid) from public;
revoke all on function private.resolution_submit(uuid,text,bigint) from public;
grant execute on function private.resolution_state(uuid) to anon,authenticated;
grant execute on function private.resolution_submit(uuid,text,bigint) to anon,authenticated;

-- Public SECURITY INVOKER functions are the only PostgREST-facing entry points.
create or replace function public.resolution_state(p_device_id uuid default null)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.resolution_state(p_device_id);
$$;
create or replace function public.resolution_submit(p_device_id uuid,p_choice text,p_round_id bigint)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.resolution_submit(p_device_id,p_choice,p_round_id);
$$;
revoke all on function public.resolution_state(uuid) from public;
revoke all on function public.resolution_submit(uuid,text,bigint) from public;
grant execute on function public.resolution_state(uuid) to anon,authenticated;
grant execute on function public.resolution_submit(uuid,text,bigint) to anon,authenticated;
commit;
