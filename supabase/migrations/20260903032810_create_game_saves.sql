-- Phase 2: one RLS-protected cloud checkpoint per authenticated user.
-- This migration intentionally creates no profiles, slots, inventory, puzzle,
-- scene, dialogue, achievement, storage, realtime, or admin structures.

create table public.game_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  save_data jsonb not null,
  save_version smallint not null default 1,
  current_scene text not null,
  revision bigint not null default 1,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),

  constraint game_saves_user_id_key unique (user_id),
  constraint game_saves_user_id_fkey
    foreign key (user_id)
    references auth.users (id)
    on delete cascade,
  constraint game_saves_save_version_check
    check (save_version >= 1),
  constraint game_saves_current_scene_check
    check (current_scene in ('sun_temple', 'judgement_chamber', 'pharaoh_tomb')),
  constraint game_saves_save_data_object_check
    check (jsonb_typeof(save_data) = 'object'),
  constraint game_saves_save_data_size_check
    check (octet_length(save_data::text) <= 65536),
  constraint game_saves_payload_version_check
    check (
      save_data ? 'version'
      and jsonb_typeof(save_data -> 'version') = 'number'
      and (save_data ->> 'version')::smallint = save_version
    ),
  constraint game_saves_payload_scene_check
    check (
      save_data ? 'sceneId'
      and jsonb_typeof(save_data -> 'sceneId') = 'string'
      and save_data ->> 'sceneId' = current_scene
    ),
  constraint game_saves_revision_check
    check (revision >= 1)
);

comment on table public.game_saves is
  'The single current cloud checkpoint for each authenticated player.';
comment on column public.game_saves.save_data is
  'Versioned GameSave JSON payload. Nested validation is enforced by the application codec.';
comment on column public.game_saves.revision is
  'Database-maintained optimistic concurrency token.';

create function public.set_game_saves_server_metadata()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function public.set_game_saves_server_metadata() from public, anon, authenticated;

create trigger set_game_saves_server_metadata
before update on public.game_saves
for each row
execute function public.set_game_saves_server_metadata();

alter table public.game_saves enable row level security;

-- Data API access is opt-in. Server-maintained metadata is not writable by clients.
revoke all on table public.game_saves from anon, authenticated;
grant select on table public.game_saves to authenticated;
grant insert (user_id, save_data, save_version, current_scene)
  on table public.game_saves to authenticated;
grant update (save_data, save_version, current_scene)
  on table public.game_saves to authenticated;
grant delete on table public.game_saves to authenticated;

create policy "game_saves_select_own"
on public.game_saves
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "game_saves_insert_own"
on public.game_saves
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "game_saves_update_own"
on public.game_saves
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "game_saves_delete_own"
on public.game_saves
for delete
to authenticated
using ((select auth.uid()) = user_id);
