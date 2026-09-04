import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GAME_SAVE_MAX_BYTES,
  getGameSaveSummary,
  parseCloudGameSaveRow,
  parseGameSave,
  serializeGameSave
} from '../js/models/game-save.js';

function makeSave(overrides = {}) {
  return {
    version: 1,
    label: '天秤審判室入口',
    sceneId: 'judgement_chamber',
    createdAt: 123456,
    progress: {
      scene2Entered: true,
      scaleMistakes: 0,
      collectedTrialItems: { golden_mask: true }
    },
    inventory: ['priest_amulet', 'golden_mask', 'golden_mask'],
    selectedItem: 'golden_mask',
    scaleState: { left: 'stone_heart', right: 'truth_feather' },
    mirrorState: [0, 1, 2],
    timer: { remainingSeconds: 420, isRunning: true },
    player: { x: 230, y: 432, direction: 1 },
    ...overrides
  };
}

test('canonical parser normalizes the real checkpoint shape and legacy mask id', () => {
  const result = parseGameSave(makeSave());
  assert.equal(result.ok, true);
  assert.deepEqual(result.save.inventory, ['priest_amulet', 'gold_mask']);
  assert.equal(result.save.selectedItem, 'gold_mask');
  assert.equal(result.save.progress.collectedTrialItems.gold_mask, true);
  assert.equal(result.save.progress.awakeningStartedAt, 0);
  assert.equal(result.save.progress.mirrorRiseStartedAt, 0);
  assert.equal(Object.hasOwn(result.save.progress, 'unknownFlag'), false);
  assert.equal(getGameSaveSummary(result.save).summary.sceneId, 'judgement_chamber');
});

test('serializer includes only checkpoint domain data and excludes runtime/auth objects', () => {
  const game = {
    currentScene: 'sun_temple',
    progress: {},
    inventory: ['torch'],
    selectedItem: null,
    scaleState: { left: null, right: null },
    mirrorState: [0, 0, 0],
    timer: { remainingSeconds: 900, isRunning: true, lastTick: 999 },
    authUser: { id: 'must-not-serialize' },
    canvas: { unsafe: true },
    sceneObjects: [{ onInteract() {} }]
  };
  const result = serializeGameSave(game, { x: 10, y: 20, direction: -1 }, '太陽神殿入口', 1000);
  assert.equal(result.ok, true);
  assert.equal(Object.hasOwn(result.save, 'authUser'), false);
  assert.equal(Object.hasOwn(result.save, 'canvas'), false);
  assert.equal(Object.hasOwn(result.save.timer, 'lastTick'), false);
  assert.deepEqual(result.save.player, { x: 10, y: 20, direction: -1 });
});

test('parser rejects unsupported versions, scenes, corrupt nested values, and oversized data', () => {
  assert.equal(parseGameSave(makeSave({ version: 2 })).code, 'SAVE_VERSION_UNSUPPORTED');
  assert.equal(parseGameSave(makeSave({ sceneId: 'missing_scene' })).code, 'SCENE_INVALID');
  assert.equal(parseGameSave(makeSave({ mirrorState: [0, 1, 3] })).code, 'MIRROR_STATE_INVALID');
  assert.equal(parseGameSave(makeSave({ inventory: ['admin_key'] })).code, 'INVENTORY_INVALID');
  assert.equal(parseGameSave(makeSave({ progress: { scaleMistakes: -1 } })).code, 'PROGRESS_INVALID');
  const oversized = makeSave({ label: 'a'.repeat(GAME_SAVE_MAX_BYTES) });
  assert.equal(parseGameSave(oversized).ok, false);
});

test('cloud row parser enforces envelope/payload consistency and revision', () => {
  const save = parseGameSave(makeSave()).save;
  const row = {
    save_data: save,
    save_version: 1,
    current_scene: 'judgement_chamber',
    revision: 3,
    created_at: '2026-09-03T00:00:00Z',
    updated_at: '2026-09-03T00:01:00Z'
  };
  assert.equal(parseCloudGameSaveRow(row).record.revision, 3);
  assert.equal(parseCloudGameSaveRow({ ...row, current_scene: 'sun_temple' }).code, 'CLOUD_ROW_MISMATCH');
  assert.equal(parseCloudGameSaveRow({ ...row, revision: 0 }).code, 'CLOUD_REVISION_INVALID');
});
