import assert from 'node:assert/strict';
import test from 'node:test';

import { AUTH_PASSWORD_MIN_LENGTH, createAuthService } from '../js/services/auth-service.js';

function makeClient(overrides = {}) {
  const calls = [];
  const auth = {
    async signUp(payload) { calls.push(['signUp', payload]); return { data: {}, error: null }; },
    async signInWithPassword(payload) { calls.push(['signIn', payload]); return { data: {}, error: null }; },
    async signOut() { calls.push(['signOut']); return { error: null }; },
    async getSession() { calls.push(['getSession']); return { data: { session: null }, error: null }; },
    async getUser() { calls.push(['getUser']); return { data: { user: null }, error: null }; },
    onAuthStateChange(listener) {
      calls.push(['onAuthStateChange', listener]);
      return { data: { subscription: { unsubscribe() { calls.push(['unsubscribe']); } } } };
    },
    async resetPasswordForEmail(email, options) {
      calls.push(['resetPasswordForEmail', email, options]);
      return { error: null };
    },
    async updateUser(payload) { calls.push(['updateUser', payload]); return { data: { user: null }, error: null }; },
    ...overrides
  };
  return { client: { auth }, calls };
}

test('registration validates empty, invalid email, and weak password before network calls', async () => {
  const { client, calls } = makeClient();
  const service = createAuthService(client);

  assert.equal((await service.signUp('', '123456')).code, 'EMAIL_REQUIRED');
  assert.equal((await service.signUp('not-an-email', '123456')).code, 'EMAIL_INVALID');
  assert.equal((await service.signUp('user@example.com', 'x'.repeat(AUTH_PASSWORD_MIN_LENGTH - 1))).code, 'PASSWORD_TOO_SHORT');
  assert.equal(calls.length, 0);
});

test('valid registration normalizes email and respects confirmation-required response', async () => {
  const user = { id: 'user-a', identities: [{ id: 'identity-a' }] };
  const { client, calls } = makeClient({
    async signUp(payload) {
      calls.push(['signUp', payload]);
      return { data: { user, session: null }, error: null };
    }
  });
  const result = await createAuthService(client).signUp(' User@Example.COM ', 'secret1', {
    emailRedirectTo: 'https://example.com/'
  });

  assert.equal(result.ok, true);
  assert.equal(result.confirmationRequired, true);
  assert.equal(result.session, null);
  assert.equal(calls[0][1].email, 'user@example.com');
  assert.equal(calls[0][1].options.emailRedirectTo, 'https://example.com/');
});

test('duplicate registration uses the same non-enumerating confirmation response', async () => {
  const normal = makeClient({
    async signUp() {
      return { data: { user: { id: 'new', identities: [{}] }, session: null }, error: null };
    }
  });
  const duplicate = makeClient({
    async signUp() {
      return { data: { user: { id: 'obfuscated', identities: [] }, session: null }, error: null };
    }
  });

  const normalResult = await createAuthService(normal.client).signUp('user@example.com', 'secret1');
  const duplicateResult = await createAuthService(duplicate.client).signUp('user@example.com', 'secret1');
  assert.equal(duplicateResult.ok, true);
  assert.equal(duplicateResult.confirmationRequired, true);
  assert.equal(duplicateResult.message, normalResult.message);
});

test('registration can return an immediate authenticated session when confirmation is disabled', async () => {
  const user = { id: 'user-a' };
  const session = { user, access_token: 'test-only-token' };
  const { client } = makeClient({
    async signUp() { return { data: { user, session }, error: null }; }
  });
  const result = await createAuthService(client).signUp('user@example.com', 'secret1');
  assert.equal(result.ok, true);
  assert.equal(result.confirmationRequired, false);
  assert.equal(result.session, session);
});

test('login handles valid credentials and keeps wrong/unknown accounts indistinguishable', async () => {
  const user = { id: 'user-a' };
  const session = { user, access_token: 'test-only-token' };
  const valid = makeClient({
    async signInWithPassword() { return { data: { user, session }, error: null }; }
  });
  assert.equal((await createAuthService(valid.client).signIn('user@example.com', 'secret1')).session, session);

  const wrong = makeClient({
    async signInWithPassword() { return { data: {}, error: { code: 'invalid_credentials' } }; }
  });
  const unknown = makeClient({
    async signInWithPassword() { return { data: {}, error: { code: 'invalid_credentials' } }; }
  });
  const wrongResult = await createAuthService(wrong.client).signIn('user@example.com', 'wrong');
  const unknownResult = await createAuthService(unknown.client).signIn('missing@example.com', 'wrong');
  assert.equal(wrongResult.ok, false);
  assert.equal(wrongResult.message, unknownResult.message);
});

test('login validates empty fields and reports unconfirmed email safely', async () => {
  const { client, calls } = makeClient({
    async signInWithPassword() { return { data: {}, error: { code: 'email_not_confirmed' } }; }
  });
  const service = createAuthService(client);
  assert.equal((await service.signIn('', 'secret1')).code, 'EMAIL_REQUIRED');
  assert.equal((await service.signIn('user@example.com', '')).code, 'PASSWORD_REQUIRED');
  const result = await service.signIn('user@example.com', 'secret1');
  assert.equal(result.code, 'email_not_confirmed');
  assert.match(result.message, /驗證/);
  assert.equal(calls.length, 0, 'override does not record calls in this harness');
});

test('session, current user, listener, logout, and unsubscribe delegate to Supabase Auth', async () => {
  const user = { id: 'user-a' };
  const session = { user };
  let listener;
  const { client, calls } = makeClient({
    async getSession() { calls.push(['getSession']); return { data: { session }, error: null }; },
    async getUser() { calls.push(['getUser']); return { data: { user }, error: null }; },
    onAuthStateChange(callback) {
      listener = callback;
      return { data: { subscription: { unsubscribe() { calls.push(['unsubscribe']); } } } };
    }
  });
  const service = createAuthService(client);
  assert.equal((await service.getSession()).session, session);
  assert.equal((await service.getCurrentUser()).user, user);
  const unsubscribe = service.onAuthStateChange(() => {});
  assert.equal(typeof listener, 'function');
  unsubscribe();
  assert.equal((await service.signOut()).ok, true);
  assert.ok(calls.some(([name]) => name === 'unsubscribe'));
  assert.ok(calls.some(([name]) => name === 'signOut'));
});

test('password reset is generic and update password enforces the minimum', async () => {
  const { client, calls } = makeClient();
  const service = createAuthService(client);
  assert.equal((await service.requestPasswordReset('bad')).code, 'EMAIL_INVALID');
  const reset = await service.requestPasswordReset('user@example.com', { redirectTo: 'https://example.com/' });
  assert.equal(reset.ok, true);
  assert.match(reset.message, /如果/);
  assert.equal(calls.at(-1)[0], 'resetPasswordForEmail');
  assert.equal((await service.updatePassword('short')).code, 'PASSWORD_TOO_SHORT');
});

test('network failures are converted to safe UI results without leaking inputs', async () => {
  const { client } = makeClient({
    async signInWithPassword() { throw new TypeError('fetch failed for secret1'); }
  });
  const result = await createAuthService(client).signIn('user@example.com', 'secret1');
  assert.equal(result.code, 'NETWORK_ERROR');
  assert.doesNotMatch(result.message, /secret1/);
});
