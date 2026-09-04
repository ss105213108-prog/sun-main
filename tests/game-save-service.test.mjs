import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameSaveService } from '../js/services/game-save-service.js';

function makeSave(sceneId = 'sun_temple') {
  return {
    version: 1,
    label: sceneId === 'sun_temple' ? '太陽神殿入口' : '法老王墓室入口',
    sceneId,
    createdAt: 1000,
    progress: {},
    inventory: [],
    selectedItem: null,
    scaleState: { left: null, right: null },
    mirrorState: [0, 0, 0],
    timer: { remainingSeconds: 900, isRunning: true },
    player: { x: 230, y: 432, direction: 1 }
  };
}

function makeRow(save, revision = 1, userId = 'user-a') {
  return {
    id: 'row-a',
    user_id: userId,
    save_data: save,
    save_version: save.version,
    current_scene: save.sceneId,
    revision,
    created_at: '2026-09-03T00:00:00Z',
    updated_at: '2026-09-03T00:00:01Z'
  };
}

function makeClient({ userId = 'user-a', load = { data: null, error: null }, insert, update } = {}) {
  const calls = [];
  const client = {
    calls,
    auth: {
      async getUser() {
        return userId ? { data: { user: { id: userId } }, error: null } : { data: { user: null }, error: null };
      }
    },
    from(table) {
      const state = { table, operation: 'load', values: null, filters: [] };
      const builder = {
        select() { return builder; },
        insert(values) { state.operation = 'insert'; state.values = values; return builder; },
        update(values) { state.operation = 'update'; state.values = values; return builder; },
        eq(column, value) { state.filters.push([column, value]); return builder; },
        abortSignal() { return builder; },
        async maybeSingle() {
          calls.push({ ...state, filters: [...state.filters] });
          return state.operation === 'update' ? (update || { data: null, error: null }) : load;
        },
        async single() {
          calls.push({ ...state, filters: [...state.filters] });
          return insert || { data: null, error: null };
        }
      };
      return builder;
    }
  };
  return client;
}

test('cloud reads are filtered to the authenticated user and no row is an empty state', async () => {
  const client = makeClient();
  const service = createGameSaveService(client);
  const result = await service.getCloudSave();
  assert.equal(result.ok, true);
  assert.equal(result.exists, false);
  assert.deepEqual(client.calls[0].filters, [['user_id', 'user-a']]);
});

test('first save inserts authenticated identity instead of accepting caller user_id', async () => {
  const save = makeSave();
  const client = makeClient({ insert: { data: makeRow(save), error: null } });
  const result = await createGameSaveService(client).saveCloudGame(save, { expectedRevision: null });
  assert.equal(result.ok, true);
  assert.equal(result.created, true);
  assert.equal(client.calls[0].values.user_id, 'user-a');
  assert.equal(client.calls[0].values.current_scene, 'sun_temple');
});

test('updates require both current user and expected revision', async () => {
  const save = makeSave('pharaoh_tomb');
  const client = makeClient({ update: { data: makeRow(save, 4), error: null } });
  const result = await createGameSaveService(client).saveCloudGame(save, { expectedRevision: 3 });
  assert.equal(result.ok, true);
  assert.equal(result.record.revision, 4);
  assert.deepEqual(client.calls[0].filters, [['user_id', 'user-a'], ['revision', 3]]);
  assert.equal(Object.hasOwn(client.calls[0].values, 'revision'), false);
  assert.equal(Object.hasOwn(client.calls[0].values, 'user_id'), false);
});

test('zero-row conditional update returns conflict and preserves the latest cloud record', async () => {
  const latestSave = makeSave('pharaoh_tomb');
  const client = makeClient({
    update: { data: null, error: null },
    load: { data: makeRow(latestSave, 8), error: null }
  });
  const result = await createGameSaveService(client).saveCloudGame(makeSave(), { expectedRevision: 3 });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'REVISION_CONFLICT');
  assert.equal(result.cloudRecord.revision, 8);
});

test('missing/expired identity blocks cloud access before any table query', async () => {
  const client = makeClient({ userId: null });
  const result = await createGameSaveService(client).getCloudSave();
  assert.equal(result.code, 'AUTH_REQUIRED');
  assert.equal(client.calls.length, 0);
});

test('request timeout is a retryable structured error', async () => {
  const client = makeClient({ load: { data: null, error: { code: 'PGRST003', status: 504 } } });
  const result = await createGameSaveService(client).getCloudSave();
  assert.equal(result.code, 'REQUEST_TIMEOUT');
  assert.equal(result.retryable, true);
});
