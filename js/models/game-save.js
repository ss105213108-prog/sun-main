export const GAME_SAVE_VERSION = 1;
export const GAME_SAVE_MAX_BYTES = 65536;

export const GAME_SAVE_SCENES = Object.freeze([
  'sun_temple',
  'judgement_chamber',
  'pharaoh_tomb'
]);

const BOOLEAN_PROGRESS_FIELDS = Object.freeze([
  'investigatedMural',
  'investigatedTablet',
  'puzzleCleared',
  'torchTaken',
  'doorOpened',
  'sunBadgeRevealed',
  'sunBadgeTaken',
  'sunBadgePlaced',
  'scene2Entered',
  'judgementMuralRead',
  'scaleCompartmentOpened',
  'scaleCompartmentSealed',
  'scalePuzzleIntroduced',
  'priestAmuletFound',
  'scaleCleared',
  'scene3Entered',
  'tombMechanismActivated',
  'priestAmuletActivated',
  'priestWarningRead',
  'mirrorsRevealed',
  'mirrorPuzzleSolved',
  'sealedHeartAltarViewed',
  'sunHeartAltarRevealed',
  'tombEscapeActive'
]);

const COUNTER_PROGRESS_FIELDS = Object.freeze(['scaleMistakes', 'mirrorMistakes']);
const TRIAL_ITEM_IDS = new Set(['gold_mask', 'truth_feather', 'stone_heart', 'jewel_scarab']);
const ITEM_IDS = new Set([
  'torch',
  'slate_sun',
  'slate_bird',
  'slate_life',
  'slate_river',
  'sun_badge',
  'priest_amulet',
  ...TRIAL_ITEM_IDS
]);
const LEGACY_ITEM_ALIASES = Object.freeze({ golden_mask: 'gold_mask' });
const ENDING_IDS = new Set(['true_guardian', 'normal_taken_seal', 'bad_entombed']);

function success(save) {
  return { ok: true, save };
}

function failure(code, message, path = '') {
  return { ok: false, code, message, path };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeItemId(value) {
  if (typeof value !== 'string') return null;
  return LEGACY_ITEM_ALIASES[value] || value;
}

function normalizeProgress(value) {
  if (!isPlainObject(value)) return failure('PROGRESS_INVALID', '存檔的遊戲進度格式不正確。', 'progress');

  const progress = {};
  for (const field of BOOLEAN_PROGRESS_FIELDS) {
    if (typeof value[field] !== 'undefined' && typeof value[field] !== 'boolean') {
      return failure('PROGRESS_INVALID', '存檔的遊戲進度格式不正確。', `progress.${field}`);
    }
    progress[field] = value[field] ?? false;
  }

  for (const field of COUNTER_PROGRESS_FIELDS) {
    const counter = value[field] ?? 0;
    if (!Number.isInteger(counter) || counter < 0) {
      return failure('PROGRESS_INVALID', '存檔的計數進度格式不正確。', `progress.${field}`);
    }
    progress[field] = counter;
  }

  if (!isPlainObject(value.collectedTrialItems ?? {})) {
    return failure('PROGRESS_INVALID', '存檔的審判道具進度格式不正確。', 'progress.collectedTrialItems');
  }
  progress.collectedTrialItems = {};
  for (const [rawItemId, collected] of Object.entries(value.collectedTrialItems ?? {})) {
    const itemId = normalizeItemId(rawItemId);
    if (!TRIAL_ITEM_IDS.has(itemId) || collected !== true) {
      return failure('PROGRESS_INVALID', '存檔含有不支援的審判道具。', `progress.collectedTrialItems.${rawItemId}`);
    }
    progress.collectedTrialItems[itemId] = true;
  }

  if (![null, true, false].includes(value.sunHeartTaken ?? null)) {
    return failure('PROGRESS_INVALID', '存檔的太陽之心狀態不正確。', 'progress.sunHeartTaken');
  }
  progress.sunHeartTaken = value.sunHeartTaken ?? null;

  if (value.endingId != null && !ENDING_IDS.has(value.endingId)) {
    return failure('PROGRESS_INVALID', '存檔含有不支援的結局狀態。', 'progress.endingId');
  }
  progress.endingId = value.endingId ?? null;

  // These values are based on performance.now() and are unsafe across page/device boundaries.
  progress.awakeningStartedAt = 0;
  progress.mirrorRiseStartedAt = 0;
  return { ok: true, progress };
}

function normalizeInventory(value) {
  if (!Array.isArray(value)) return failure('INVENTORY_INVALID', '存檔的背包格式不正確。', 'inventory');
  const inventory = [];
  const seen = new Set();
  for (let index = 0; index < value.length; index += 1) {
    const itemId = normalizeItemId(value[index]);
    if (!ITEM_IDS.has(itemId)) {
      return failure('INVENTORY_INVALID', '存檔含有不支援的道具。', `inventory.${index}`);
    }
    if (!seen.has(itemId)) {
      seen.add(itemId);
      inventory.push(itemId);
    }
  }
  return { ok: true, inventory };
}

function normalizeScaleState(value) {
  if (!isPlainObject(value)) return failure('SCALE_STATE_INVALID', '存檔的天秤狀態不正確。', 'scaleState');
  const left = value.left == null ? null : normalizeItemId(value.left);
  const right = value.right == null ? null : normalizeItemId(value.right);
  if ((left && !TRIAL_ITEM_IDS.has(left)) || (right && !TRIAL_ITEM_IDS.has(right))) {
    return failure('SCALE_STATE_INVALID', '存檔含有不支援的天秤道具。', 'scaleState');
  }
  return { ok: true, scaleState: { left, right } };
}

function normalizeMirrorState(value) {
  if (!Array.isArray(value) || value.length !== 3 || value.some(direction => !Number.isInteger(direction) || direction < 0 || direction > 2)) {
    return failure('MIRROR_STATE_INVALID', '存檔的銅鏡方向不正確。', 'mirrorState');
  }
  return { ok: true, mirrorState: [...value] };
}

function normalizeTimer(value) {
  if (!isPlainObject(value) || !Number.isFinite(value.remainingSeconds) || typeof value.isRunning !== 'boolean') {
    return failure('TIMER_INVALID', '存檔的倒數狀態不正確。', 'timer');
  }
  return {
    ok: true,
    timer: {
      remainingSeconds: Math.min(900, Math.max(0, value.remainingSeconds)),
      isRunning: value.isRunning
    }
  };
}

function normalizePlayer(value) {
  if (value == null) return { ok: true, player: null };
  if (!isPlainObject(value) || !Number.isFinite(value.x) || !Number.isFinite(value.y) || ![-1, 1].includes(value.direction)) {
    return failure('PLAYER_INVALID', '存檔的玩家位置不正確。', 'player');
  }
  return { ok: true, player: { x: value.x, y: value.y, direction: value.direction } };
}

export function parseGameSave(value) {
  if (!isPlainObject(value)) return failure('SAVE_INVALID', '找不到可讀取的遊戲存檔。');
  if (value.version !== GAME_SAVE_VERSION) {
    return failure(
      value.version > GAME_SAVE_VERSION ? 'SAVE_VERSION_UNSUPPORTED' : 'SAVE_VERSION_INVALID',
      value.version > GAME_SAVE_VERSION ? '此存檔需要較新版本的遊戲。' : '此存檔版本不受支援。',
      'version'
    );
  }
  if (typeof value.label !== 'string' || value.label.trim().length === 0 || value.label.trim().length > 80) {
    return failure('LABEL_INVALID', '存檔標籤格式不正確。', 'label');
  }
  if (!GAME_SAVE_SCENES.includes(value.sceneId)) {
    return failure('SCENE_INVALID', '存檔指向不存在的場景。', 'sceneId');
  }
  if (!Number.isSafeInteger(value.createdAt) || value.createdAt < 0) {
    return failure('CREATED_AT_INVALID', '存檔時間格式不正確。', 'createdAt');
  }

  const progress = normalizeProgress(value.progress);
  if (!progress.ok) return progress;
  const inventory = normalizeInventory(value.inventory);
  if (!inventory.ok) return inventory;

  const selectedItem = value.selectedItem == null ? null : normalizeItemId(value.selectedItem);
  if (selectedItem && !ITEM_IDS.has(selectedItem)) {
    return failure('SELECTED_ITEM_INVALID', '存檔選取了不支援的道具。', 'selectedItem');
  }

  const scale = normalizeScaleState(value.scaleState ?? { left: null, right: null });
  if (!scale.ok) return scale;
  const mirrors = normalizeMirrorState(value.mirrorState ?? [0, 0, 0]);
  if (!mirrors.ok) return mirrors;
  const timer = normalizeTimer(value.timer);
  if (!timer.ok) return timer;
  const player = normalizePlayer(value.player);
  if (!player.ok) return player;

  const save = {
    version: GAME_SAVE_VERSION,
    label: value.label.trim(),
    sceneId: value.sceneId,
    createdAt: value.createdAt,
    progress: progress.progress,
    inventory: inventory.inventory,
    selectedItem,
    scaleState: scale.scaleState,
    mirrorState: mirrors.mirrorState,
    timer: timer.timer,
    player: player.player
  };

  const serialized = JSON.stringify(save);
  if (new TextEncoder().encode(serialized).length > GAME_SAVE_MAX_BYTES) {
    return failure('SAVE_TOO_LARGE', '遊戲存檔超過可接受大小。');
  }
  return success(save);
}

export function serializeGameSave(game, player, label, now = Date.now()) {
  if (!game) return failure('RUNTIME_INVALID', '遊戲狀態尚未準備完成。');
  const candidate = {
    version: GAME_SAVE_VERSION,
    label,
    sceneId: game.currentScene,
    createdAt: now,
    progress: game.progress,
    inventory: game.inventory,
    selectedItem: game.selectedItem ?? null,
    scaleState: game.scaleState ?? { left: null, right: null },
    mirrorState: game.mirrorState ?? [0, 0, 0],
    timer: game.timer,
    player: player ? { x: player.x, y: player.y, direction: player.direction } : null
  };
  return parseGameSave(candidate);
}

export function parseCloudGameSaveRow(row) {
  if (!isPlainObject(row)) return failure('CLOUD_ROW_INVALID', '雲端存檔格式不正確。');
  if (row.save_version !== row.save_data?.version || row.current_scene !== row.save_data?.sceneId) {
    return failure('CLOUD_ROW_MISMATCH', '雲端存檔 metadata 與內容不一致。');
  }
  if (!Number.isSafeInteger(Number(row.revision)) || Number(row.revision) < 1) {
    return failure('CLOUD_REVISION_INVALID', '雲端存檔 revision 不正確。');
  }
  const parsed = parseGameSave(row.save_data);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    record: {
      save: parsed.save,
      revision: Number(row.revision),
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null
    }
  };
}

export function getGameSaveSummary(save, metadata = {}) {
  const parsed = parseGameSave(save);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    summary: {
      label: parsed.save.label,
      sceneId: parsed.save.sceneId,
      createdAt: parsed.save.createdAt,
      revision: metadata.revision ?? null,
      updatedAt: metadata.updatedAt ?? null
    }
  };
}
