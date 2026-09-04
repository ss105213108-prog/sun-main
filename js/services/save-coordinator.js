import { getGameSaveSummary, parseGameSave } from '../models/game-save.js';
import { getGameSaveService } from './game-save-service.js';

export const GUEST_SAVE_KEY = 'sunHeartCheckpointV1';
export const MEMBER_CACHE_PREFIX = 'sunHeartMemberCacheV1:';
export const MEMBER_PENDING_PREFIX = 'sunHeartMemberPendingV1:';

function success(payload = {}) {
  return { ok: true, ...payload };
}

function failure(code, message, retryable = false, payload = {}) {
  return { ok: false, code, message, retryable, ...payload };
}

function safeRead(storage, key) {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function safeWrite(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function safeRemove(storage, key) {
  try {
    storage?.removeItem(key);
  } catch {}
}

export function createSaveCoordinator({ gameSaveService, storage, onStateChange = () => {} } = {}) {
  if (!gameSaveService) throw new TypeError('gameSaveService is required.');

  let session = null;
  let guestMode = false;
  let cloudChecked = false;
  let knownRecord = null;
  let inFlight = false;
  let queuedSave = null;
  let lastState = Object.freeze({ mode: 'unauthenticated', status: 'idle', code: null, message: '' });

  const memberId = () => session?.user?.id || null;
  const mode = () => memberId() ? 'member' : guestMode ? 'guest' : 'unauthenticated';
  const cacheKey = userId => `${MEMBER_CACHE_PREFIX}${userId}`;
  const pendingKey = userId => `${MEMBER_PENDING_PREFIX}${userId}`;

  function publish(status, payload = {}) {
    lastState = Object.freeze({ mode: mode(), status, code: payload.code || null, message: payload.message || '', ...payload });
    onStateChange(lastState);
    return lastState;
  }

  function setAuthState(authState = {}) {
    const previousUserId = memberId();
    session = authState.session?.user ? authState.session : null;
    guestMode = false;
    if (previousUserId !== memberId()) {
      cloudChecked = false;
      knownRecord = null;
    }
    publish(session ? 'source-ready' : 'auth-required');
  }

  function setGuestMode() {
    session = null;
    guestMode = true;
    cloudChecked = false;
    knownRecord = null;
    publish('source-ready');
  }

  function readGuestSave() {
    const raw = safeRead(storage, GUEST_SAVE_KEY);
    if (!raw) return success({ exists: false, save: null });
    const parsed = parseGameSave(raw);
    return parsed.ok
      ? success({ exists: true, save: parsed.save })
      : failure(parsed.code, parsed.message, false, { invalidGuestSave: true });
  }

  function writeMemberCache(userId, record) {
    safeWrite(storage, cacheKey(userId), {
      revision: record.revision,
      updatedAt: record.updatedAt,
      save: record.save
    });
  }

  async function loadMemberSave({ publishState = true } = {}) {
    const userId = memberId();
    if (!userId) return failure('AUTH_REQUIRED', '請重新登入後再讀取雲端紀錄。');
    if (publishState) publish('loading', { message: '正在確認雲端紀錄……' });
    const result = await gameSaveService.getCloudSave();
    if (userId !== memberId()) return failure('AUTH_CHANGED', '登入身分已變更，已取消舊的讀取結果。');
    if (!result.ok) {
      if (publishState) publish('load-error', result);
      return result;
    }
    cloudChecked = true;
    knownRecord = result.exists ? result.record : null;
    if (!result.exists) {
      if (publishState) publish('empty', { message: '目前沒有雲端探勘紀錄。' });
      return success({ exists: false, save: null, record: null, source: 'cloud' });
    }
    writeMemberCache(userId, result.record);
    if (publishState) publish('loaded', { message: `最近紀錄：${result.record.save.label}`, revision: result.record.revision });
    return success({ exists: true, save: result.record.save, record: result.record, source: 'cloud' });
  }

  async function load() {
    if (mode() === 'guest') {
      const result = readGuestSave();
      if (!result.ok) publish('load-error', result);
      else if (!result.exists) publish('empty', { message: '目前沒有可以繼續的紀錄。' });
      else publish('loaded', { message: `最近紀錄：${result.save.label}` });
      return result.ok ? { ...result, source: 'local' } : result;
    }
    if (mode() === 'member') return loadMemberSave();
    const result = failure('AUTH_REQUIRED', '請先登入或選擇訪客身分。');
    publish('auth-required', result);
    return result;
  }

  async function getSummary() {
    const loaded = await load();
    if (!loaded.ok || !loaded.exists) return loaded;
    const summary = getGameSaveSummary(loaded.save, loaded.record || {});
    return summary.ok ? success({ exists: true, summary: summary.summary, source: loaded.source }) : summary;
  }

  async function ensureCloudChecked() {
    if (cloudChecked) return success({ exists: Boolean(knownRecord), record: knownRecord });
    const loaded = await loadMemberSave({ publishState: false });
    return loaded.ok
      ? success({ exists: loaded.exists, record: loaded.record })
      : loaded;
  }

  async function persistMemberSave(save) {
    const userId = memberId();
    if (!userId) return failure('AUTH_REQUIRED', 'Session 已失效，這個 checkpoint 尚未同步。');
    const checked = await ensureCloudChecked();
    if (!checked.ok) {
      safeWrite(storage, pendingKey(userId), { expectedRevision: null, save });
      publish('pending', { code: checked.code, message: '此 checkpoint 尚未同步。', retryable: checked.retryable });
      return checked;
    }

    const expectedRevision = checked.record?.revision ?? null;
    safeWrite(storage, pendingKey(userId), { expectedRevision, save });
    publish('syncing', { message: '正在同步 checkpoint……' });
    const result = await gameSaveService.saveCloudGame(save, { expectedRevision });
    if (userId !== memberId()) return failure('AUTH_CHANGED', '登入身分已變更，未套用舊的同步結果。');

    if (!result.ok) {
      if (result.code === 'REVISION_CONFLICT' && result.cloudRecord) {
        cloudChecked = true;
        knownRecord = result.cloudRecord;
      }
      publish(result.code === 'REVISION_CONFLICT' ? 'conflict' : 'pending', {
        code: result.code,
        message: result.code === 'REVISION_CONFLICT'
          ? '雲端紀錄已更新；目前 checkpoint 未覆蓋它。'
          : '此 checkpoint 尚未同步。',
        retryable: result.retryable
      });
      return result;
    }

    cloudChecked = true;
    knownRecord = result.record;
    writeMemberCache(userId, result.record);
    safeRemove(storage, pendingKey(userId));
    publish('synced', { message: `checkpoint 已同步：${result.record.save.label}`, revision: result.record.revision });
    return success({ source: 'cloud', record: result.record });
  }

  function drainSaveQueue() {
    if (inFlight) return;
    inFlight = true;
    void (async () => {
      while (queuedSave) {
        const current = queuedSave;
        queuedSave = null;
        const result = await persistMemberSave(current.save);
        current.resolve(result);
      }
      inFlight = false;
    })();
  }

  function save(value) {
    const parsed = parseGameSave(value);
    if (!parsed.ok) {
      publish('save-error', parsed);
      return Promise.resolve(parsed);
    }
    if (mode() === 'guest') {
      const stored = safeWrite(storage, GUEST_SAVE_KEY, parsed.save);
      const result = stored
        ? success({ source: 'local', save: parsed.save })
        : failure('LOCAL_WRITE_FAILED', '無法在此瀏覽器保存訪客進度。');
      publish(stored ? 'saved' : 'save-error', { ...result, message: stored ? `checkpoint 已保存：${parsed.save.label}` : result.message });
      return Promise.resolve(result);
    }
    if (mode() !== 'member') {
      const result = failure('AUTH_REQUIRED', '請先登入或選擇訪客身分。');
      publish('auth-required', result);
      return Promise.resolve(result);
    }

    return new Promise(resolve => {
      if (queuedSave) {
        queuedSave.resolve(failure('SAVE_SUPERSEDED', '較新的 checkpoint 已取代尚未送出的同步。'));
      }
      queuedSave = { save: parsed.save, resolve };
      drainSaveQueue();
    });
  }

  function beginNewGame() {
    if (mode() === 'guest') safeRemove(storage, GUEST_SAVE_KEY);
    publish('new-game', {
      message: mode() === 'member'
        ? '舊雲端紀錄會保留到新的入口 checkpoint 同步成功。'
        : '已開始新的訪客探勘。'
    });
    return success({ preservedCloud: mode() === 'member' });
  }

  async function getGuestImportCandidate() {
    if (mode() !== 'member') return failure('AUTH_REQUIRED', '請先登入再匯入訪客進度。');
    const guest = readGuestSave();
    if (!guest.ok || !guest.exists) return guest;
    const cloud = await loadMemberSave({ publishState: false });
    if (!cloud.ok) return cloud;
    if (cloud.exists) return success({ canImport: false, reason: 'CLOUD_EXISTS', cloudRecord: cloud.record });
    const summary = getGameSaveSummary(guest.save);
    return success({ canImport: true, save: guest.save, summary: summary.summary });
  }

  async function importGuestSave({ confirmed = false } = {}) {
    if (!confirmed) return failure('IMPORT_CONFIRMATION_REQUIRED', '匯入訪客進度需要明確確認。');
    const candidate = await getGuestImportCandidate();
    if (!candidate.ok) return candidate;
    if (!candidate.canImport) return failure('CLOUD_EXISTS', '帳號已有雲端紀錄，訪客進度未覆蓋它。');
    const result = await gameSaveService.saveCloudGame(candidate.save, { expectedRevision: null });
    if (!result.ok) {
      publish(result.code === 'REVISION_CONFLICT' ? 'conflict' : 'import-error', result);
      return result;
    }
    const userId = memberId();
    cloudChecked = true;
    knownRecord = result.record;
    writeMemberCache(userId, result.record);
    safeRemove(storage, pendingKey(userId));
    safeRemove(storage, GUEST_SAVE_KEY);
    publish('imported', { message: `已匯入訪客紀錄：${result.record.save.label}`, revision: result.record.revision });
    return success({ record: result.record, save: result.record.save });
  }

  return Object.freeze({
    setAuthState,
    setGuestMode,
    getState: () => lastState,
    readGuestSave,
    load,
    getSummary,
    save,
    beginNewGame,
    getGuestImportCandidate,
    importGuestSave
  });
}

let singletonSaveCoordinator = null;

export function getSaveCoordinator(options = {}) {
  if (!singletonSaveCoordinator) {
    singletonSaveCoordinator = createSaveCoordinator({
      gameSaveService: getGameSaveService(),
      storage: globalThis.localStorage,
      ...options
    });
  }
  return singletonSaveCoordinator;
}
