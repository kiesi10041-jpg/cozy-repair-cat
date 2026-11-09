-- Cozy Repair v0.5: additive schema. Does not drop or change earlier game tables.
begin;
create table if not exists public.cr5_rooms (
 id uuid primary key default gen_random_uuid(), code text unique not null,
 host_id uuid not null references auth.users(id), state jsonb not null,
 revision bigint not null default 0, running boolean not null default false,
 updated_at timestamptz not null default now()
);
create table if not exists public.cr5_members (
 room_id uuid not null references public.cr5_rooms(id) on delete cascade,
 user_id uuid not null references auth.users(id), slot integer not null check(slot between 0 and 2),
 name text not null, ready boolean not null default false,
 x double precision not null default 160, y double precision not null default 286,
 dir text not null default 'front', walking boolean not null default false,
 last_seen timestamptz not null default now(),
 primary key(room_id,user_id), unique(room_id,slot)
);
create table if not exists public.cr5_actions (
 id uuid primary key, room_id uuid not null references public.cr5_rooms(id) on delete cascade,
 user_id uuid not null references auth.users(id), slot integer not null,
 action text not null, payload jsonb not null default '{}', done boolean not null default false,
 accepted boolean, message text, created_at timestamptz not null default now()
);
create index if not exists cr5_actions_pending on public.cr5_actions(room_id,created_at) where not done;
alter table public.cr5_rooms enable row level security;
alter table public.cr5_members enable row level security;
alter table public.cr5_actions enable row level security;
create or replace function public.cr5_is_member(p_room uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.cr5_members where room_id=p_room and user_id=auth.uid());
$$;
drop policy if exists cr5_read_rooms on public.cr5_rooms;
create policy cr5_read_rooms on public.cr5_rooms for select to authenticated using(public.cr5_is_member(id));
drop policy if exists cr5_read_members on public.cr5_members;
create policy cr5_read_members on public.cr5_members for select to authenticated using(public.cr5_is_member(room_id));
revoke all on public.cr5_rooms,public.cr5_members,public.cr5_actions from anon,authenticated;
grant select on public.cr5_rooms,public.cr5_members to authenticated;
create or replace function public.cr5_create(p_state jsonb,p_name text) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.cr5_rooms;begin
 if auth.uid() is null then raise exception '로그인이 필요합니다';end if;
 if (p_state->>'schema')::integer<>5 or octet_length(p_state::text)>200000 then raise exception '저장 형식 오류';end if;
 insert into public.cr5_rooms(code,host_id,state) values(upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),auth.uid(),p_state) returning * into r;
 insert into public.cr5_members(room_id,user_id,slot,name,ready) values(r.id,auth.uid(),0,left(coalesce(p_name,'고양이 A'),20),true);
 return to_jsonb(r);
end;$$;
create or replace function public.cr5_join(p_code text,p_name text) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.cr5_rooms;v_slot integer;begin
 if auth.uid() is null then raise exception '로그인이 필요합니다';end if;
 select * into r from public.cr5_rooms where code=upper(trim(p_code)) for update;
 if not found then raise exception '방 코드를 확인해 주세요';end if;
 if not exists(select 1 from public.cr5_members where room_id=r.id and user_id=auth.uid()) then
  select s into v_slot from generate_series(0,2) s where not exists(select 1 from public.cr5_members m where m.room_id=r.id and m.slot=s) order by s limit 1;
  if v_slot is null then raise exception '3명의 공동 상점입니다. 자리가 없습니다';end if;
  insert into public.cr5_members(room_id,user_id,slot,name,x,y) values(r.id,auth.uid(),v_slot,left(coalesce(p_name,'고양이'),20),case v_slot when 1 then 336 else 450 end,case v_slot when 1 then 216 else 280 end);
 end if;
 return to_jsonb(r);
end;$$;
create or replace function public.cr5_sync(p_room uuid,p_pose jsonb default '{}',p_ready boolean default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.cr5_rooms;v_members jsonb;v_actions jsonb;v_receipts jsonb;begin
 if not public.cr5_is_member(p_room) then raise exception '상점 참여 권한이 없습니다';end if;
 update public.cr5_members set last_seen=now(),ready=coalesce(p_ready,ready),
 x=case when p_pose ? 'x' then greatest(0,least(512,(p_pose->>'x')::double precision)) else x end,
 y=case when p_pose ? 'y' then greatest(0,least(342,(p_pose->>'y')::double precision)) else y end,
 dir=case when p_pose->>'dir' in('front','back','left','right') then p_pose->>'dir' else dir end,
 walking=coalesce((p_pose->>'walking')::boolean,false)
 where room_id=p_room and user_id=auth.uid();
 select * into r from public.cr5_rooms where id=p_room;
 select coalesce(jsonb_agg(to_jsonb(m) order by slot),'[]') into v_members from public.cr5_members m where room_id=p_room;
 if r.host_id=auth.uid() then select coalesce(jsonb_agg(to_jsonb(a) order by created_at),'[]') into v_actions from(select * from public.cr5_actions where room_id=p_room and not done order by created_at,id limit 50)a;else v_actions='[]';end if;
 select coalesce(jsonb_agg(to_jsonb(a)),'[]') into v_receipts from(select id,accepted,message,created_at from public.cr5_actions where room_id=p_room and user_id=auth.uid() and done order by created_at desc limit 12)a;
 return jsonb_build_object('room',to_jsonb(r),'members',v_members,'actions',v_actions,'receipts',v_receipts);
end;$$;
create or replace function public.cr5_start(p_room uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare r public.cr5_rooms;begin
 select * into r from public.cr5_rooms where id=p_room for update;
 if r.host_id is distinct from auth.uid() or auth.uid() is null then raise exception '방장만 시작할 수 있습니다';end if;
 if(select count(*) from public.cr5_members where room_id=p_room and ready and last_seen>now()-interval '20 seconds')<>3 then raise exception '3명 모두 접속해 준비를 눌러 주세요';end if;
 update public.cr5_rooms set running=true,updated_at=now() where id=p_room;return true;
end;$$;
create or replace function public.cr5_enqueue(p_room uuid,p_id uuid,p_action text,p_payload jsonb default '{}') returns uuid language plpgsql security definer set search_path=public as $$
declare m public.cr5_members;begin
 select * into m from public.cr5_members where room_id=p_room and user_id=auth.uid();
 if not found then raise exception '상점 참여 권한이 없습니다';end if;
 if not exists(select 1 from public.cr5_rooms where id=p_room and running) then raise exception '게임 시작을 기다려 주세요';end if;
 if p_action not in('counter','release','serve','negotiate','dismiss','begin','screw','replace','wipe','rotate','fit','test','cancel','pass','exhibit','order','claim','upgrade','nextday','ping') or octet_length(p_payload::text)>4096 then raise exception '지원하지 않는 요청';end if;
 if(select count(*) from public.cr5_actions where room_id=p_room and user_id=auth.uid() and not done)>40 then raise exception '처리 중인 작업을 기다려 주세요';end if;
 insert into public.cr5_actions(id,room_id,user_id,slot,action,payload) values(p_id,p_room,auth.uid(),m.slot,p_action,p_payload) on conflict(id) do nothing;return p_id;
end;$$;
create or replace function public.cr5_commit(p_room uuid,p_revision bigint,p_state jsonb,p_receipts jsonb default '[]') returns bigint language plpgsql security definer set search_path=public as $$
declare r public.cr5_rooms;v jsonb;begin
 select * into r from public.cr5_rooms where id=p_room for update;
 if auth.uid() is null or r.host_id is distinct from auth.uid() then raise exception '현재 방장만 상태를 저장할 수 있습니다';end if;
 if r.revision<>p_revision then raise exception 'REVISION_CONFLICT';end if;
 if(p_state->>'schema')::integer<>5 or octet_length(p_state::text)>200000 or jsonb_typeof(p_receipts)<>'array' or jsonb_array_length(p_receipts)>50 then raise exception '저장 형식 오류';end if;
 update public.cr5_rooms set state=p_state,revision=revision+1,updated_at=now() where id=p_room;
 for v in select * from jsonb_array_elements(p_receipts) loop
  update public.cr5_actions set done=true,accepted=(v->>'accepted')::boolean,message=left(v->>'message',300) where room_id=p_room and id=(v->>'id')::uuid and not done;
 end loop;
 delete from public.cr5_actions where room_id=p_room and done and created_at<now()-interval '1 day';
 return r.revision+1;
end;$$;
create or replace function public.cr5_takeover(p_room uuid) returns boolean language plpgsql security definer set search_path=public as $$
declare r public.cr5_rooms;v_candidate uuid;begin
 if not public.cr5_is_member(p_room) then raise exception '상점 참여 권한이 없습니다';end if;
 select * into r from public.cr5_rooms where id=p_room for update;
 if exists(select 1 from public.cr5_members where room_id=p_room and user_id=r.host_id and last_seen>now()-interval '20 seconds') then return false;end if;
 select user_id into v_candidate from public.cr5_members where room_id=p_room and last_seen>now()-interval '10 seconds' order by slot limit 1;
 if v_candidate is distinct from auth.uid() then return false;end if;
 update public.cr5_rooms set host_id=auth.uid(),revision=revision+1,updated_at=now() where id=p_room;return true;
end;$$;
-- Realtime receives room revisions; RPC remains the durable authority.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='cr5_rooms') then
 alter publication supabase_realtime add table public.cr5_rooms;
 end if;
end $$;
-- Grant only these functions. Existing application grants are untouched.
do $$ declare r record;begin for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'cr5\_%' escape '\' loop
 execute format('revoke all on function %s from public,anon',r.signature);
 execute format('grant execute on function %s to authenticated',r.signature);
end loop;end $$;
commit;
