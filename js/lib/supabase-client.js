import { createClient } from '@supabase/supabase-js';

const CONFIG_ERROR = 'SUPABASE_CONFIG_INVALID';
let singletonClient = null;

export class SupabaseConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SupabaseConfigurationError';
    this.code = CONFIG_ERROR;
  }
}

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new SupabaseConfigurationError(`${name} is required.`);
  }
  return value.trim();
}

export function resolveSupabaseConfig(environment = import.meta.env ?? {}) {
  const url = requireNonEmptyString(environment.VITE_SUPABASE_URL, 'VITE_SUPABASE_URL');
  const publishableKey = requireNonEmptyString(
    environment.VITE_SUPABASE_PUBLISHABLE_KEY,
    'VITE_SUPABASE_PUBLISHABLE_KEY'
  );

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new SupabaseConfigurationError('VITE_SUPABASE_URL must be a valid URL.');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new SupabaseConfigurationError('VITE_SUPABASE_URL must use HTTP or HTTPS.');
  }

  if (publishableKey.startsWith('sb_secret_')) {
    throw new SupabaseConfigurationError('A Supabase secret key must never be used in the browser.');
  }

  return Object.freeze({ url: parsedUrl.toString().replace(/\/$/, ''), publishableKey });
}

export function createBrowserSupabaseClient(config, options = {}) {
  const resolved = resolveSupabaseConfig({
    VITE_SUPABASE_URL: config?.url,
    VITE_SUPABASE_PUBLISHABLE_KEY: config?.publishableKey
  });

  return createClient(resolved.url, resolved.publishableKey, {
    ...options,
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      ...options.auth
    }
  });
}

export function getSupabaseClient() {
  if (!singletonClient) {
    singletonClient = createBrowserSupabaseClient(resolveSupabaseConfig());
  }
  return singletonClient;
}
