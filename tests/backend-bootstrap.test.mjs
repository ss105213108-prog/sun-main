import assert from 'node:assert/strict';
import test from 'node:test';

import { createAuthBootstrap } from '../js/backend-bootstrap.js';

function makeTarget() {
  const listeners = new Map();
  return {
    Game: { isGuest: null, authUser: null },
    location: { href: 'https://example.com/?test=1#token' },
    CustomEvent: class CustomEvent {
      constructor(type, options) { this.type = type; this.detail = options.detail; }
    },
    addEventListener(type, listener) { listeners.set(type, listener); },
    dispatchEvent(event) { listeners.get(event.type)?.(event); },
    queueMicrotask(callback) { queueMicrotask(callback); }
  };
}

function makeService(initialSession = null) {
  let authListener;
  let signOutCount = 0;
  let unsubscribed = false;
  return {
    service: {
      async signUp(email, password, options) { return { ok: true, email, password, options }; },
      async signIn(email, password) { return { ok: true, user: { id: email }, password }; },
      async signOut() { signOutCount += 1; return { ok: true }; },
      async getSession() { return { ok: true, session: initialSession }; },
      async getCurrentUser() { return { ok: true, user: initialSession?.user || null }; },
      onAuthStateChange(listener) { authListener = listener; return () => { unsubscribed = true; }; },
      async requestPasswordReset(email, options) { return { ok: true, email, options }; },
      async updatePassword() { return { ok: true }; }
    },
    emit(event, session) { authListener(event, session); },
    getSignOutCount() { return signOutCount; },
    wasUnsubscribed() { return unsubscribed; }
  };
}

test('bootstrap installs minimal integration points and restores a member session', async () => {
  const user = { id: 'user-a', email: 'user@example.com' };
  const session = { user, access_token: 'test-only-token' };
  const target = makeTarget();
  const fake = makeService(session);
  const bootstrap = createAuthBootstrap({ authService: fake.service, target });

  const restored = await bootstrap.initialize();
  assert.equal(restored.session, session);
  assert.equal(target.Game.isGuest, false);
  assert.equal(target.Game.authUser, user);
  assert.equal(target.isExplorerAuthenticated(), true);
  assert.equal(target.getCurrentExplorerSession(), session);
  assert.equal(target.getCurrentExplorerUser(), user);
  assert.equal(typeof target.authenticateExplorer, 'function');
  assert.equal(typeof target.registerExplorer, 'function');
  assert.equal(typeof target.openExplorerPasswordReset, 'function');
  assert.equal(typeof target.signOutExplorer, 'function');
});

test('auth listener applies token refresh asynchronously and logout clears member identity', async () => {
  const first = { user: { id: 'user-a' } };
  const refreshed = { user: { id: 'user-a', email: 'fresh@example.com' } };
  const target = makeTarget();
  const fake = makeService(first);
  const bootstrap = createAuthBootstrap({ authService: fake.service, target });
  await bootstrap.initialize();

  fake.emit('TOKEN_REFRESHED', refreshed);
  assert.equal(target.getExplorerAuthSnapshot().session, first, 'listener callback must only queue downstream work');
  await new Promise(resolve => queueMicrotask(resolve));
  assert.equal(target.getExplorerAuthSnapshot().session, refreshed);
  assert.equal(target.Game.authUser.email, 'fresh@example.com');

  const result = await target.signOutExplorer();
  assert.equal(result.ok, true);
  assert.equal(fake.getSignOutCount(), 1);
  assert.equal(target.getCurrentExplorerSession(), null);
  assert.equal(target.getCurrentExplorerUser(), null);
  assert.equal(target.Game.isGuest, null);

  bootstrap.destroy();
  assert.equal(fake.wasUnsubscribed(), true);
});

test('no session remains unauthenticated and generated redirects discard query/hash tokens', async () => {
  const target = makeTarget();
  const fake = makeService(null);
  const bootstrap = createAuthBootstrap({ authService: fake.service, target });
  await bootstrap.initialize();
  assert.equal(target.isExplorerAuthenticated(), false);
  assert.equal(target.Game.authUser, null);

  const registration = await target.registerExplorer({ account: 'user@example.com', password: 'secret1' });
  assert.equal(registration.options.emailRedirectTo, 'https://example.com/');
  const reset = await target.openExplorerPasswordReset('user@example.com');
  assert.equal(reset.options.redirectTo, 'https://example.com/');
});

test('bootstrap routes save hooks and imports guest progress only after explicit confirmation', async () => {
  const user = { id: 'user-a' };
  const session = { user };
  const target = makeTarget();
  target.confirm = () => true;
  let imported = false;
  let saveAuthState = null;
  const coordinator = {
    setAuthState(value) { saveAuthState = value; },
    setGuestMode() {},
    readGuestSave() { return { ok: true, exists: false }; },
    async getGuestImportCandidate() {
      return { ok: true, canImport: true, summary: { label: '訪客紀錄' } };
    },
    async importGuestSave(options) { imported = options.confirmed; return { ok: true }; },
    async save(save) { return { ok: true, save }; },
    async load() { return { ok: true, exists: false }; },
    async getSummary() { return { ok: true, exists: false }; },
    beginNewGame() { return { ok: true }; },
    getState() { return { mode: 'member' }; }
  };
  const fake = makeService(session);
  const bootstrap = createAuthBootstrap({ authService: fake.service, saveCoordinator: coordinator, target });
  await bootstrap.initialize();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(saveAuthState.session, session);
  assert.equal(imported, true);
  assert.equal(typeof target.saveActiveGameCheckpoint, 'function');
  assert.equal(typeof target.loadActiveGameSave, 'function');
  assert.equal(typeof target.validateGameSave, 'function');
});
