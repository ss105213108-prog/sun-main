import { parseCloudGameSaveRow, parseGameSave } from '../models/game-save.js';
import { getSupabaseClient } from '../lib/supabase-client.js';

const SELECT_COLUMNS = 'id,user_id,save_data,save_version,current_scene,revision,created_at,updated_at';
const REQUEST_TIMEOUT_MS = 15000;

function success(payload = {}) {
  return { ok: true, ...payload };
}

function failure(code, message, retryable = false, payload = {}) {
  return { ok: false, code, message, retryable, ...payload };
}

function mapDatabaseError(error, operation) {
  const code = error?.code || 'DATABASE_REQUEST_FAILED';
  const status = Number(error?.status || error?.statusCode || 0);
  if (['AbortError', 'TimeoutError'].includes(error?.name) || code === 'PGRST003' || [408, 504].includes(status)) {
    return failure('REQUEST_TIMEOUT', '雲端存檔服務回應逾時。', true);
  }
  if (code === '23505') return failure('REVISION_CONFLICT', '雲端已有另一筆較新的存檔。');
  if (['42501', 'PGRST301'].includes(code) || [401, 403].includes(status)) {
    return failure('ACCESS_DENIED', '目前的登入狀態無法存取雲端紀錄。');
  }
  if (error instanceof TypeError || ['network_error', 'fetch_error'].includes(code) || status >= 500) {
    return failure('NETWORK_ERROR', '目前無法連線雲端存檔服務。', true);
  }
  return failure(`${operation.toUpperCase()}_FAILED`, '雲端存檔服務目前無法完成請求。', status >= 500);
}

function withRequestTimeout(builder) {
  if (typeof builder?.abortSignal !== 'function' || typeof globalThis.AbortSignal?.timeout !== 'function') return builder;
  return builder.abortSignal(globalThis.AbortSignal.timeout(REQUEST_TIMEOUT_MS));
}

export function createGameSaveService(client) {
  if (!client?.auth || typeof client.from !== 'function') {
    throw new TypeError('A Supabase client with auth and database support is required.');
  }

  async function requireCurrentUser() {
    try {
      const { data, error } = await client.auth.getUser();
      if (error || !data?.user?.id) return failure('AUTH_REQUIRED', '請重新登入後再使用雲端存檔。');
      return success({ user: data.user });
    } catch (error) {
      return mapDatabaseError(error, 'auth');
    }
  }

  async function getCloudSave() {
    const identity = await requireCurrentUser();
    if (!identity.ok) return identity;
    try {
      const query = client
        .from('game_saves')
        .select(SELECT_COLUMNS)
        .eq('user_id', identity.user.id);
      const { data, error } = await withRequestTimeout(query).maybeSingle();
      if (error) return mapDatabaseError(error, 'load');
      if (!data) return success({ exists: false, record: null });
      const parsed = parseCloudGameSaveRow(data);
      if (!parsed.ok) return { ...parsed, retryable: false };
      return success({ exists: true, record: parsed.record });
    } catch (error) {
      return mapDatabaseError(error, 'load');
    }
  }

  async function readConflict() {
    const latest = await getCloudSave();
    return failure('REVISION_CONFLICT', '雲端存檔已由另一個工作階段更新，未自動覆蓋。', false, {
      cloudRecord: latest.ok && latest.exists ? latest.record : null
    });
  }

  async function saveCloudGame(save, { expectedRevision = null } = {}) {
    const parsed = parseGameSave(save);
    if (!parsed.ok) return { ...parsed, retryable: false };
    const identity = await requireCurrentUser();
    if (!identity.ok) return identity;

    const values = {
      save_data: parsed.save,
      save_version: parsed.save.version,
      current_scene: parsed.save.sceneId
    };

    try {
      if (expectedRevision == null) {
        const query = client
          .from('game_saves')
          .insert({ user_id: identity.user.id, ...values })
          .select(SELECT_COLUMNS);
        const { data, error } = await withRequestTimeout(query).single();
        if (error) {
          if (error.code === '23505') return readConflict();
          return mapDatabaseError(error, 'save');
        }
        const record = parseCloudGameSaveRow(data);
        return record.ok ? success({ record: record.record, created: true }) : record;
      }

      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) {
        return failure('REVISION_INVALID', '無法確認雲端存檔版本。');
      }

      const query = client
        .from('game_saves')
        .update(values)
        .eq('user_id', identity.user.id)
        .eq('revision', expectedRevision)
        .select(SELECT_COLUMNS);
      const { data, error } = await withRequestTimeout(query).maybeSingle();
      if (error) return mapDatabaseError(error, 'save');
      if (!data) return readConflict();
      const record = parseCloudGameSaveRow(data);
      return record.ok ? success({ record: record.record, created: false }) : record;
    } catch (error) {
      return mapDatabaseError(error, 'save');
    }
  }

  async function hasCloudSave() {
    const result = await getCloudSave();
    return result.ok ? success({ exists: result.exists }) : result;
  }

  return Object.freeze({ getCloudSave, saveCloudGame, hasCloudSave });
}

let singletonGameSaveService = null;

export function getGameSaveService() {
  if (!singletonGameSaveService) singletonGameSaveService = createGameSaveService(getSupabaseClient());
  return singletonGameSaveService;
}
