import { getAuthService } from './services/auth-service.js';
import { parseGameSave } from './models/game-save.js';
import { getSaveCoordinator } from './services/save-coordinator.js';

const AUTH_EVENT_NAME = 'sunheart:auth-state';
const SAVE_EVENT_NAME = 'sunheart:save-state';

function defaultRedirectUrl(target) {
  const location = target?.location;
  if (!location?.href) return undefined;
  const url = new URL(location.href);
  url.hash = '';
  url.search = '';
  return url.toString();
}

export function createAuthBootstrap({ authService, saveCoordinator = null, target = globalThis } = {}) {
  if (!authService) throw new TypeError('authService is required.');

  let initialized = false;
  let unsubscribe = null;
  const state = {
    initializing: true,
    session: null,
    user: null,
    error: null,
    lastEvent: 'INITIALIZING'
  };
  const importChecks = new Set();

  const snapshot = () => Object.freeze({ ...state });

  function dispatchState() {
    const detail = snapshot();
    if (typeof target.dispatchEvent !== 'function') return;
    const EventConstructor = target.CustomEvent || globalThis.CustomEvent;
    if (typeof EventConstructor === 'function') {
      target.dispatchEvent(new EventConstructor(AUTH_EVENT_NAME, { detail }));
    } else {
      target.dispatchEvent({ type: AUTH_EVENT_NAME, detail });
    }
  }

  function applySession(event, session, error = null) {
    state.initializing = false;
    state.session = session || null;
    state.user = session?.user || null;
    state.error = error;
    state.lastEvent = event;

    if (target.Game) {
      target.Game.authUser = state.user;
      if (state.session) target.Game.isGuest = false;
      else if (event === 'SIGNED_OUT') target.Game.isGuest = null;
      if (state.session) target.Game.checkpoint = null;
    }
    saveCoordinator?.setAuthState(state);
    dispatchState();
    if (state.session?.user) void reconcileMemberSave(state.session.user.id);
  }

  async function reconcileMemberSave(userId) {
    if (!saveCoordinator || importChecks.has(userId)) {
      target.refreshMainMenuSaveState?.();
      return;
    }
    importChecks.add(userId);
    const candidate = await saveCoordinator.getGuestImportCandidate();
    if (target.getCurrentExplorerUser?.()?.id !== userId) return;
    if (candidate.ok && candidate.canImport && typeof target.confirm === 'function') {
      const confirmed = target.confirm(`偵測到訪客紀錄「${candidate.summary.label}」。要匯入到這個帳號嗎？`);
      if (confirmed) await saveCoordinator.importGuestSave({ confirmed: true });
    }
    target.refreshMainMenuSaveState?.();
  }

  function queueAuthState(event, session) {
    const enqueue = target.queueMicrotask || globalThis.queueMicrotask || (callback => Promise.resolve().then(callback));
    enqueue(() => applySession(event, session));
  }

  function installIntegrationPoints() {
    target.authenticateExplorer = ({ account, password }) => authService.signIn(account, password);
    target.registerExplorer = ({ account, password }) => authService.signUp(account, password, {
      emailRedirectTo: defaultRedirectUrl(target)
    });
    target.openExplorerPasswordReset = account => authService.requestPasswordReset(account, {
      redirectTo: defaultRedirectUrl(target)
    });
    target.updateExplorerPassword = password => authService.updatePassword(password);
    target.signOutExplorer = async () => {
      const result = await authService.signOut();
      if (result.ok) applySession('SIGNED_OUT', null);
      return result;
    };
    target.getExplorerAuthSnapshot = snapshot;
    target.getCurrentExplorerSession = () => state.session;
    target.getCurrentExplorerUser = () => state.user;
    target.isExplorerAuthenticated = () => Boolean(state.session?.user);
    if (saveCoordinator) {
      target.setGuestSaveMode = () => {
        if (state.session) return false;
        saveCoordinator.setGuestMode();
        if (target.Game) {
          target.Game.isGuest = true;
          const guest = saveCoordinator.readGuestSave();
          target.Game.checkpoint = guest.ok && guest.exists ? guest.save : null;
        }
        return true;
      };
      target.validateGameSave = value => parseGameSave(value);
      target.saveActiveGameCheckpoint = value => saveCoordinator.save(value);
      target.loadActiveGameSave = () => saveCoordinator.load();
      target.getActiveGameSaveSummary = () => saveCoordinator.getSummary();
      target.beginNewGameSave = () => saveCoordinator.beginNewGame();
      target.getGuestImportCandidate = () => saveCoordinator.getGuestImportCandidate();
      target.importGuestGameSave = options => saveCoordinator.importGuestSave(options);
      target.getGameSaveState = () => saveCoordinator.getState();
    }
  }

  async function initialize() {
    if (initialized) return snapshot();
    initialized = true;
    installIntegrationPoints();

    // The Supabase callback stays synchronous and only queues state application.
    unsubscribe = authService.onAuthStateChange((event, session) => {
      queueAuthState(event, session);
    });

    const result = await authService.getSession();
    if (result.ok) applySession('INITIAL_SESSION', result.session);
    else applySession('SESSION_RESTORE_FAILED', null, result);
    return snapshot();
  }

  function destroy() {
    unsubscribe?.();
    unsubscribe = null;
    initialized = false;
  }

  installIntegrationPoints();
  return Object.freeze({ initialize, destroy, getSnapshot: snapshot, applySession });
}

if (typeof window !== 'undefined') {
  const dispatchSaveState = detail => {
    const EventConstructor = window.CustomEvent || globalThis.CustomEvent;
    if (typeof window.dispatchEvent !== 'function') return;
    window.dispatchEvent(typeof EventConstructor === 'function'
      ? new EventConstructor(SAVE_EVENT_NAME, { detail })
      : { type: SAVE_EVENT_NAME, detail });
  };
  const saveCoordinator = getSaveCoordinator({ onStateChange: dispatchSaveState });
  const bootstrap = createAuthBootstrap({ authService: getAuthService(), saveCoordinator, target: window });
  window.explorerAuthBootstrap = bootstrap;
  bootstrap.initialize();
}
