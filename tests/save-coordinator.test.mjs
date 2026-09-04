import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GUEST_SAVE_KEY,
  MEMBER_CACHE_PREFIX,
  MEMBER_PENDING_PREFIX,
  createSaveCoordinator
} from '../js/services/save-coordinator.js';

function makeSave(label = '太陽神殿入口', sceneId = 'sun_temple') {
  return {
    version: 1,
    label,
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

function makeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem(key) { return map.get(key) ?? null; },
    setItem(key, value) { map.set(key, value); },
    removeItem(key) { map.delete(key); }
  };
}

function makeService({ existingRecord = null, saveResult } = {}) {
  const calls = [];
  return {
    calls,
    async getCloudSave() {
      calls.push({ operation: 'load' });
      return { ok: true, exists: Boolean(existingRecord), record: existingRecord };
    },
    async saveCloudGame(save, options) {
      calls.push({ operation: 'save', save, options });
      if (saveResult) return saveResult;
      return {
        ok: true,
        record: { save, revision: (options.expectedRevision || 0) + 1, updatedAt: '2026-09-03T00:00:00Z' }
      };
    }
  };
}

test('guest remains localStorage-authoritative and new game only clears guest save', async () => {
  const storage = makeStorage();
  const service = makeService();
  const coordinator = createSaveCoordinator({ gameSaveService: service, storage });
  coordinator.setGuestMode();
  const save = makeSave();
  assert.equal((await coordinator.save(save)).source, 'local');
  assert.equal(JSON.parse(storage.map.get(GUEST_SAVE_KEY)).label, '太陽神殿入口');
  assert.equal((await coordinator.load()).save.label, '太陽神殿入口');
  coordinator.beginNewGame();
  assert.equal(storage.map.has(GUEST_SAVE_KEY), false);
  assert.equal(service.calls.length, 0);
});

test('member loads cloud authority and uses its revision for a conditional update', async () => {
  const oldSave = makeSave();
  const storage = makeStorage({ [GUEST_SAVE_KEY]: JSON.stringify(makeSave('訪客紀錄')) });
  const service = makeService({ existingRecord: { save: oldSave, revision: 5, updatedAt: 'server-time' } });
  const coordinator = createSaveCoordinator({ gameSaveService: service, storage });
  coordinator.setAuthState({ session: { user: { id: 'user-a' } } });
  assert.equal((await coordinator.load()).record.revision, 5);
  const result = await coordinator.save(makeSave('法老王墓室入口', 'pharaoh_tomb'));
  assert.equal(result.record.revision, 6);
  assert.equal(service.calls.at(-1).options.expectedRevision, 5);
  assert.equal(storage.map.has(GUEST_SAVE_KEY), true, 'member save must not consume or overwrite guest storage');
  assert.equal(storage.map.has(`${MEMBER_CACHE_PREFIX}user-a`), true);
  assert.equal(storage.map.has(`${MEMBER_PENDING_PREFIX}user-a`), false);
});

test('failed member write keeps only a user-scoped pending recovery copy', async () => {
  const storage = makeStorage();
  const service = makeService({ saveResult: { ok: false, code: 'NETWORK_ERROR', message: 'offline', retryable: true } });
  const coordinator = createSaveCoordinator({ gameSaveService: service, storage });
  coordinator.setAuthState({ session: { user: { id: 'user-a' } } });
  const result = await coordinator.save(makeSave());
  assert.equal(result.code, 'NETWORK_ERROR');
  assert.equal(storage.map.has(`${MEMBER_PENDING_PREFIX}user-a`), true);
  assert.equal(storage.map.has(GUEST_SAVE_KEY), false);
  assert.equal(coordinator.getState().status, 'pending');
});

test('guest import requires confirmation and is allowed only when cloud is absent', async () => {
  const guest = makeSave('訪客第三場景', 'pharaoh_tomb');
  const storage = makeStorage({ [GUEST_SAVE_KEY]: JSON.stringify(guest) });
  const service = makeService();
  const coordinator = createSaveCoordinator({ gameSaveService: service, storage });
  coordinator.setAuthState({ session: { user: { id: 'user-a' } } });
  assert.equal((await coordinator.getGuestImportCandidate()).canImport, true);
  assert.equal((await coordinator.importGuestSave()).code, 'IMPORT_CONFIRMATION_REQUIRED');
  const imported = await coordinator.importGuestSave({ confirmed: true });
  assert.equal(imported.ok, true);
  assert.equal(storage.map.has(GUEST_SAVE_KEY), false);
  assert.equal(imported.record.save.sceneId, 'pharaoh_tomb');
});

test('an existing cloud save is never overwritten by guest import', async () => {
  const cloudSave = makeSave('雲端紀錄', 'judgement_chamber');
  const storage = makeStorage({ [GUEST_SAVE_KEY]: JSON.stringify(makeSave('訪客紀錄')) });
  const service = makeService({ existingRecord: { save: cloudSave, revision: 9, updatedAt: 'server-time' } });
  const coordinator = createSaveCoordinator({ gameSaveService: service, storage });
  coordinator.setAuthState({ session: { user: { id: 'user-a' } } });
  const candidate = await coordinator.getGuestImportCandidate();
  assert.equal(candidate.canImport, false);
  assert.equal(candidate.reason, 'CLOUD_EXISTS');
  assert.equal((await coordinator.importGuestSave({ confirmed: true })).code, 'CLOUD_EXISTS');
  assert.equal(service.calls.filter(call => call.operation === 'save').length, 0);
  assert.equal(storage.map.has(GUEST_SAVE_KEY), true);
});

test('member new game preserves the cloud row until a new checkpoint is saved', () => {
  const storage = makeStorage();
  const service = makeService({ existingRecord: { save: makeSave(), revision: 2 } });
  const coordinator = createSaveCoordinator({ gameSaveService: service, storage });
  coordinator.setAuthState({ session: { user: { id: 'user-a' } } });
  assert.equal(coordinator.beginNewGame().preservedCloud, true);
  assert.equal(service.calls.length, 0);
});

test('revision conflict retains pending recovery and never overwrites cloud automatically', async () => {
  const storage = makeStorage();
  const cloudRecord = { save: makeSave('另一裝置紀錄', 'judgement_chamber'), revision: 7 };
  const service = makeService({
    existingRecord: { save: makeSave(), revision: 3 },
    saveResult: { ok: false, code: 'REVISION_CONFLICT', message: 'conflict', cloudRecord }
  });
  const coordinator = createSaveCoordinator({ gameSaveService: service, storage });
  coordinator.setAuthState({ session: { user: { id: 'user-a' } } });
  await coordinator.load();
  const result = await coordinator.save(makeSave('本機待同步', 'pharaoh_tomb'));
  assert.equal(result.code, 'REVISION_CONFLICT');
  assert.equal(coordinator.getState().status, 'conflict');
  assert.equal(storage.map.has(`${MEMBER_PENDING_PREFIX}user-a`), true);
  assert.equal(service.calls.filter(call => call.operation === 'save').length, 1);
});
