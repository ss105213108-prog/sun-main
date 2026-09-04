import { getSupabaseClient } from '../lib/supabase-client.js';

export const AUTH_PASSWORD_MIN_LENGTH = 6;

const GENERIC_SIGN_IN_MESSAGE = '電子信箱或密碼不正確。';
const GENERIC_SIGN_UP_MESSAGE = '如果此電子信箱可以建立帳號，驗證信將寄到你的信箱。請完成驗證後再登入。';
const GENERIC_RESET_MESSAGE = '如果此電子信箱已註冊，密碼重設信將寄到你的信箱。';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function success(payload = {}) {
  return { ok: true, ...payload };
}

function failure(code, message) {
  return { ok: false, code, message };
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function validateCredentials(email, password, { requireStrongPassword = false } = {}) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return failure('EMAIL_REQUIRED', '請輸入電子信箱。');
  if (!EMAIL_PATTERN.test(normalizedEmail)) return failure('EMAIL_INVALID', '電子信箱格式不正確。');
  if (typeof password !== 'string' || password.length === 0) {
    return failure('PASSWORD_REQUIRED', '請輸入密碼。');
  }
  if (requireStrongPassword && password.length < AUTH_PASSWORD_MIN_LENGTH) {
    return failure('PASSWORD_TOO_SHORT', `密碼至少需要 ${AUTH_PASSWORD_MIN_LENGTH} 個字元。`);
  }
  return success({ email: normalizedEmail, password });
}

function isDuplicateSignup(error) {
  return ['user_already_exists', 'email_exists'].includes(error?.code);
}

function mapAuthError(error, operation) {
  const code = error?.code || 'AUTH_REQUEST_FAILED';

  if (operation === 'signIn' && ['invalid_credentials', 'email_not_confirmed'].includes(code)) {
    const message = code === 'email_not_confirmed'
      ? '請先完成電子信箱驗證，再登入探勘紀錄。'
      : GENERIC_SIGN_IN_MESSAGE;
    return failure(code, message);
  }

  if (operation === 'signUp') {
    if (isDuplicateSignup(error)) {
      return success({
        confirmationRequired: true,
        session: null,
        user: null,
        message: GENERIC_SIGN_UP_MESSAGE
      });
    }
    if (code === 'weak_password') {
      return failure(code, '密碼未符合安全要求，請改用更長或更複雜的密碼。');
    }
    if (code === 'signup_disabled') {
      return failure(code, '目前暫停建立新帳號。');
    }
  }

  if (['over_email_send_rate_limit', 'over_request_rate_limit'].includes(code)) {
    return failure(code, '請求次數過多，請稍後再試。');
  }

  if (code === 'network_error' || error instanceof TypeError) {
    return failure('NETWORK_ERROR', '目前無法連線認證服務，請檢查網路後再試。');
  }

  return failure(code, '認證服務目前無法完成請求，請稍後再試。');
}

export function createAuthService(client) {
  if (!client?.auth) throw new TypeError('A Supabase client with auth support is required.');

  return Object.freeze({
    async signUp(email, password, { emailRedirectTo } = {}) {
      const credentials = validateCredentials(email, password, { requireStrongPassword: true });
      if (!credentials.ok) return credentials;

      try {
        const options = emailRedirectTo ? { emailRedirectTo } : undefined;
        const { data, error } = await client.auth.signUp({
          email: credentials.email,
          password: credentials.password,
          ...(options ? { options } : {})
        });

        if (error) return mapAuthError(error, 'signUp');

        // With email confirmation enabled, an existing address can return an
        // obfuscated user with no identities. Keep the response generic so the
        // registration form cannot be used to enumerate accounts.
        const duplicateIsObfuscated = Array.isArray(data?.user?.identities)
          && data.user.identities.length === 0;
        if (!data?.session || duplicateIsObfuscated) {
          return success({
            confirmationRequired: true,
            session: null,
            user: null,
            message: GENERIC_SIGN_UP_MESSAGE
          });
        }

        return success({
          confirmationRequired: false,
          session: data.session,
          user: data.user || data.session.user,
          message: '帳號已建立並完成登入。'
        });
      } catch (error) {
        return mapAuthError(error, 'signUp');
      }
    },

    async signIn(email, password) {
      const credentials = validateCredentials(email, password);
      if (!credentials.ok) return credentials;

      try {
        const { data, error } = await client.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password
        });
        if (error) return mapAuthError(error, 'signIn');
        if (!data?.session || !data?.user) {
          return failure('SESSION_MISSING', '登入完成但沒有取得有效 Session，請重新登入。');
        }
        return success({ session: data.session, user: data.user });
      } catch (error) {
        return mapAuthError(error, 'signIn');
      }
    },

    async signOut() {
      try {
        const { error } = await client.auth.signOut();
        return error ? mapAuthError(error, 'signOut') : success();
      } catch (error) {
        return mapAuthError(error, 'signOut');
      }
    },

    async getSession() {
      try {
        const { data, error } = await client.auth.getSession();
        if (error) return mapAuthError(error, 'getSession');
        return success({ session: data?.session || null });
      } catch (error) {
        return mapAuthError(error, 'getSession');
      }
    },

    async getCurrentUser() {
      try {
        const { data, error } = await client.auth.getUser();
        if (error) return mapAuthError(error, 'getUser');
        return success({ user: data?.user || null });
      } catch (error) {
        return mapAuthError(error, 'getUser');
      }
    },

    onAuthStateChange(listener) {
      if (typeof listener !== 'function') throw new TypeError('Auth listener must be a function.');
      const { data } = client.auth.onAuthStateChange(listener);
      return () => data?.subscription?.unsubscribe?.();
    },

    async requestPasswordReset(email, { redirectTo } = {}) {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) return failure('EMAIL_REQUIRED', '請先輸入電子信箱。');
      if (!EMAIL_PATTERN.test(normalizedEmail)) return failure('EMAIL_INVALID', '電子信箱格式不正確。');

      try {
        const options = redirectTo ? { redirectTo } : undefined;
        const { error } = await client.auth.resetPasswordForEmail(normalizedEmail, options);
        if (error) {
          if (['user_not_found', 'email_not_found'].includes(error.code)) {
            return success({ message: GENERIC_RESET_MESSAGE });
          }
          return mapAuthError(error, 'passwordReset');
        }
        return success({ message: GENERIC_RESET_MESSAGE });
      } catch (error) {
        return mapAuthError(error, 'passwordReset');
      }
    },

    async updatePassword(password) {
      if (typeof password !== 'string' || password.length < AUTH_PASSWORD_MIN_LENGTH) {
        return failure('PASSWORD_TOO_SHORT', `密碼至少需要 ${AUTH_PASSWORD_MIN_LENGTH} 個字元。`);
      }
      try {
        const { data, error } = await client.auth.updateUser({ password });
        if (error) return mapAuthError(error, 'updatePassword');
        return success({ user: data?.user || null });
      } catch (error) {
        return mapAuthError(error, 'updatePassword');
      }
    }
  });
}

let singletonAuthService = null;

export function getAuthService() {
  if (!singletonAuthService) singletonAuthService = createAuthService(getSupabaseClient());
  return singletonAuthService;
}
