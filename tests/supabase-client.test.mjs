import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SupabaseConfigurationError,
  createBrowserSupabaseClient,
  resolveSupabaseConfig
} from '../js/lib/supabase-client.js';

const validConfig = {
  VITE_SUPABASE_URL: 'https://example-project.supabase.co/',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-only-placeholder'
};

test('resolveSupabaseConfig normalizes a browser-safe configuration', () => {
  assert.deepEqual(resolveSupabaseConfig(validConfig), {
    url: 'https://example-project.supabase.co',
    publishableKey: validConfig.VITE_SUPABASE_PUBLISHABLE_KEY
  });
});

test('resolveSupabaseConfig rejects missing values without exposing a key', () => {
  assert.throws(
    () => resolveSupabaseConfig({}),
    error => error instanceof SupabaseConfigurationError
      && error.code === 'SUPABASE_CONFIG_INVALID'
      && !error.message.includes(validConfig.VITE_SUPABASE_PUBLISHABLE_KEY)
  );
});

test('resolveSupabaseConfig rejects a browser secret key', () => {
  assert.throws(
    () => resolveSupabaseConfig({
      ...validConfig,
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_must-not-be-bundled'
    }),
    SupabaseConfigurationError
  );
});

test('createBrowserSupabaseClient initializes one usable client instance', () => {
  const client = createBrowserSupabaseClient({
    url: validConfig.VITE_SUPABASE_URL,
    publishableKey: validConfig.VITE_SUPABASE_PUBLISHABLE_KEY
  }, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  assert.equal(typeof client.from, 'function');
  assert.equal(typeof client.auth.getSession, 'function');
});
