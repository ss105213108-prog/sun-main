begin;

create extension if not exists pgtap with schema extensions;

select plan(43);

select has_table('public', 'game_saves', 'game_saves table exists');
select col_type_is('public', 'game_saves', 'save_data', 'jsonb', 'save_data uses jsonb');
select col_is_pk('public', 'game_saves', 'id', 'id is the primary key');
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.game_saves'::regclass
      and conname = 'game_saves_user_id_key'
      and contype = 'u'
  ),
  'user_id has a unique constraint'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.game_saves'::regclass
      and conname = 'game_saves_user_id_fkey'
      and contype = 'f'
      and confdeltype = 'c'
  ),
  'user_id references auth.users with on delete cascade'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.game_saves'::regclass),
  'row level security is enabled'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'game_saves'),
  4,
  'four operation-specific RLS policies exist'
);
select ok(
  not has_column_privilege('authenticated', 'public.game_saves', 'user_id', 'update')
  and not has_column_privilege('authenticated', 'public.game_saves', 'revision', 'insert,update')
  and not has_column_privilege('authenticated', 'public.game_saves', 'created_at', 'insert,update')
  and not has_column_privilege('authenticated', 'public.game_saves', 'updated_at', 'insert,update'),
  'authenticated clients cannot write owner or server metadata columns'
);
select ok(
  not has_table_privilege('anon', 'public.game_saves', 'select,insert,update,delete'),
  'anon has no game_saves table privileges'
);
select ok(
  has_table_privilege('authenticated', 'public.game_saves', 'select')
  and has_table_privilege('authenticated', 'public.game_saves', 'delete')
  and not has_table_privilege('authenticated', 'public.game_saves', 'insert')
  and not has_table_privilege('authenticated', 'public.game_saves', 'update'),
  'authenticated has table-level select/delete but no unrestricted insert/update'
);
select ok(
  has_column_privilege('authenticated', 'public.game_saves', 'user_id', 'insert')
  and has_column_privilege('authenticated', 'public.game_saves', 'save_data', 'insert,update')
  and has_column_privilege('authenticated', 'public.game_saves', 'save_version', 'insert,update')
  and has_column_privilege('authenticated', 'public.game_saves', 'current_scene', 'insert,update'),
  'authenticated has only the approved writable column privileges'
);
select ok(
  not has_function_privilege('public', 'public.set_game_saves_server_metadata()', 'execute')
  and not has_function_privilege('anon', 'public.set_game_saves_server_metadata()', 'execute')
  and not has_function_privilege('authenticated', 'public.set_game_saves_server_metadata()', 'execute'),
  'metadata trigger function cannot be executed directly by browser roles'
);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.test');

set local role anon;
select throws_ok(
  $$select * from public.game_saves$$,
  '42501',
  null,
  'anon cannot select game_saves'
);
select throws_ok(
  $$insert into public.game_saves (user_id, save_data, current_scene)
    values (
      '11111111-1111-1111-1111-111111111111',
      '{"version":1,"sceneId":"sun_temple"}'::jsonb,
      'sun_temple'
    )$$,
  '42501',
  null,
  'anon cannot insert game_saves'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);

select lives_ok(
  $$insert into public.game_saves (user_id, save_data, current_scene)
    values (
      '11111111-1111-1111-1111-111111111111',
      '{"version":1,"sceneId":"sun_temple"}'::jsonb,
      'sun_temple'
    )$$,
  'owner can insert one save'
);
select throws_ok(
  $$insert into public.game_saves (user_id, save_data, current_scene)
    values (
      '11111111-1111-1111-1111-111111111111',
      '{"version":1,"sceneId":"sun_temple"}'::jsonb,
      'sun_temple'
    )$$,
  '23505',
  null,
  'unique user_id permits only one save per user'
);
select is(
  (select count(*)::integer from public.game_saves),
  1,
  'owner can select the owner row'
);
select lives_ok(
  $$update public.game_saves
    set save_data = '{"version":1,"sceneId":"judgement_chamber"}'::jsonb,
        current_scene = 'judgement_chamber'
    where user_id = '11111111-1111-1111-1111-111111111111'$$,
  'owner can update the owner row'
);
select is(
  (select revision from public.game_saves where user_id = '11111111-1111-1111-1111-111111111111'),
  2::bigint,
  'database trigger increments revision'
);
select ok(
  (select updated_at = statement_timestamp()
   from public.game_saves
   where user_id = '11111111-1111-1111-1111-111111111111'),
  'database trigger sets updated_at from the server statement timestamp'
);
select throws_ok(
  $$update public.game_saves
    set user_id = '22222222-2222-2222-2222-222222222222'
    where user_id = '11111111-1111-1111-1111-111111111111'$$,
  '42501',
  null,
  'owner cannot reassign user_id'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
select lives_ok(
  $$insert into public.game_saves (user_id, save_data, current_scene)
    values (
      '22222222-2222-2222-2222-222222222222',
      '{"version":1,"sceneId":"sun_temple"}'::jsonb,
      'sun_temple'
    )$$,
  'user B can insert the user B save'
);
select is(
  (select count(*)::integer from public.game_saves),
  1,
  'user B can select only the user B row'
);
select lives_ok(
  $$update public.game_saves
    set save_data = '{"version":1,"sceneId":"pharaoh_tomb"}'::jsonb,
        current_scene = 'pharaoh_tomb'
    where user_id = '22222222-2222-2222-2222-222222222222'$$,
  'user B can update the user B row'
);
select is(
  (select revision from public.game_saves where user_id = '22222222-2222-2222-2222-222222222222'),
  2::bigint,
  'user B update receives a server revision increment'
);
select is(
  (select count(*)::integer
   from public.game_saves
   where user_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'another user cannot select the owner row'
);
select results_eq(
  $$update public.game_saves
    set save_data = '{"version":1,"sceneId":"pharaoh_tomb"}'::jsonb,
        current_scene = 'pharaoh_tomb'
    where user_id = '11111111-1111-1111-1111-111111111111'
    returning 1$$,
  $$select 1 where false$$,
  'another user cannot update the owner row'
);
select results_eq(
  $$delete from public.game_saves
    where user_id = '11111111-1111-1111-1111-111111111111'
    returning 1$$,
  $$select 1 where false$$,
  'another user cannot delete the owner row'
);
select throws_ok(
  $$insert into public.game_saves (user_id, save_data, current_scene)
    values (
      '11111111-1111-1111-1111-111111111111',
      '{"version":1,"sceneId":"sun_temple"}'::jsonb,
      'sun_temple'
    )$$,
  '42501',
  null,
  'another user cannot forge the owner user_id'
);

reset role;
select is(
  (select current_scene from public.game_saves where user_id = '11111111-1111-1111-1111-111111111111'),
  'judgement_chamber',
  'blocked cross-user update leaves owner data unchanged'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
select is(
  (select count(*)::integer from public.game_saves),
  1,
  'user A can select only the user A row while user B also has a save'
);
select is(
  (select count(*)::integer
   from public.game_saves
   where user_id = '22222222-2222-2222-2222-222222222222'),
  0,
  'user A cannot select the user B row'
);
select results_eq(
  $$update public.game_saves
    set save_data = '{"version":1,"sceneId":"judgement_chamber"}'::jsonb,
        current_scene = 'judgement_chamber'
    where user_id = '22222222-2222-2222-2222-222222222222'
    returning 1$$,
  $$select 1 where false$$,
  'user A cannot update the user B row'
);
select results_eq(
  $$delete from public.game_saves
    where user_id = '22222222-2222-2222-2222-222222222222'
    returning 1$$,
  $$select 1 where false$$,
  'user A cannot delete the user B row'
);
select throws_ok(
  $$insert into public.game_saves (user_id, save_data, current_scene)
    values (
      '22222222-2222-2222-2222-222222222222',
      '{"version":1,"sceneId":"sun_temple"}'::jsonb,
      'sun_temple'
    )$$,
  '42501',
  null,
  'user A cannot forge the user B owner id'
);

reset role;
select is(
  (select current_scene from public.game_saves where user_id = '22222222-2222-2222-2222-222222222222'),
  'pharaoh_tomb',
  'blocked user A update leaves user B data unchanged'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
select lives_ok(
  $$delete from public.game_saves
    where user_id = '11111111-1111-1111-1111-111111111111'$$,
  'owner can delete the owner row'
);
select is(
  (select count(*)::integer from public.game_saves),
  0,
  'owner delete removes the owner row'
);

reset role;
select is(
  (select count(*)::integer from public.game_saves where user_id = '22222222-2222-2222-2222-222222222222'),
  1,
  'user A deletion does not remove the user B row'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
select lives_ok(
  $$delete from public.game_saves
    where user_id = '22222222-2222-2222-2222-222222222222'$$,
  'user B can delete the user B row'
);
select is(
  (select count(*)::integer from public.game_saves),
  0,
  'user B delete removes the user B row'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
select lives_ok(
  $$insert into public.game_saves (user_id, save_data, current_scene)
    values (
      '11111111-1111-1111-1111-111111111111',
      '{"version":1,"sceneId":"sun_temple"}'::jsonb,
      'sun_temple'
    )$$,
  'owner can recreate a save before cascade verification'
);

reset role;
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
select is(
  (select count(*)::integer from public.game_saves where user_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'deleting an auth user cascades to the save row'
);

select * from finish();
rollback;
