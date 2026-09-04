(() => {
  const EXIT_DURATION_MS = 680;
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  let initialized = false;
  let isLeaving = false;
  let gateGeneration = 0;

  function setupExplorerGate() {
    if (initialized) return;

    const gate = document.getElementById('explorer-gate');
    const title = document.getElementById('explorer-gate-title');
    const subtitle = document.getElementById('explorer-gate-subtitle');
    const form = document.getElementById('explorer-login-form');
    const accountInput = document.getElementById('explorer-account');
    const passwordInput = document.getElementById('explorer-password');
    const submitButton = document.getElementById('explorer-login-submit');
    const guestButton = document.getElementById('explorer-guest-enter');
    const forgotButton = document.getElementById('explorer-forgot-password');
    const registerButton = document.getElementById('explorer-register');
    const status = document.getElementById('explorer-auth-status');
    const mainMenu = document.getElementById('main-menu-overlay');
    if (!gate || !form || !accountInput || !passwordInput || !guestButton) return;

    initialized = true;
    let mode = 'login';
    let isSubmitting = false;
    const blockedLayers = Array.from(
      document.querySelectorAll?.('#game-container > :not(#explorer-gate)') || [mainMenu].filter(Boolean)
    );

    const setStatus = message => {
      if (status) status.textContent = message;
    };

    const setLoading = loading => {
      isSubmitting = loading;
      if (submitButton) submitButton.disabled = loading;
      if (registerButton) registerButton.disabled = loading;
      if (forgotButton) forgotButton.disabled = loading;
      if (guestButton) guestButton.disabled = loading;
    };

    const setMode = (nextMode, message = '') => {
      mode = nextMode === 'register' ? 'register' : 'login';
      if (title) title.textContent = mode === 'register' ? '建立探勘紀錄' : '探勘者登錄';
      if (subtitle) {
        subtitle.textContent = mode === 'register'
          ? '使用電子信箱建立帳號，完成信箱驗證後即可登入。'
          : '登入後可保留你的探勘紀錄。';
      }
      if (submitButton) submitButton.textContent = mode === 'register' ? '建立探勘紀錄' : '載入探勘紀錄';
      if (registerButton) registerButton.textContent = mode === 'register' ? '返回登入' : '建立帳號';
      passwordInput.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
      setStatus(message);
    };

    const activateAuthGate = (message = '') => {
      gateGeneration += 1;
      isLeaving = false;
      setLoading(false);
      setMode('login', message);
      gate.classList.remove('hidden', 'is-leaving');
      gate.setAttribute('aria-hidden', 'false');
      blockedLayers.forEach(layer => { layer.inert = true; });
      mainMenu?.setAttribute('aria-hidden', 'true');
      Game.isGuest = null;
      Game.authUser = null;
      Game.state = 'AUTH_GATE';
      Game.inCutscene = false;
      if (Game.timer) {
        Game.timer.isRunning = false;
        Game.timer.lastTick = 0;
      }
      accountInput.focus();
    };

    const enterMainMenu = ({ isGuest, user = null }) => {
      if (isLeaving) return false;
      isLeaving = true;
      const generation = ++gateGeneration;
      Game.isGuest = isGuest;
      Game.authUser = user;
      if (isGuest) window.setGuestSaveMode?.();
      Game.state = 'MENU';
      gate.classList.add('is-leaving');
      gate.setAttribute('aria-hidden', 'true');

      setTimeout(() => {
        if (generation !== gateGeneration) return;
        gate.classList.add('hidden');
        gate.classList.remove('is-leaving');
        mainMenu?.removeAttribute('aria-hidden');
        blockedLayers.forEach(layer => { layer.inert = false; });
        document.getElementById('main-menu-new-game')?.focus?.();
        window.refreshMainMenuSaveState?.();
      }, EXIT_DURATION_MS);
      return true;
    };

    const handleAuthState = event => {
      const authState = event?.detail || window.getExplorerAuthSnapshot?.();
      if (!authState) return;
      if (authState.initializing) {
        setStatus('正在檢查探勘者 Session……');
        return;
      }
      if (authState.session?.user) {
        setStatus('已恢復探勘者 Session。');
        enterMainMenu({ isGuest: false, user: authState.session.user });
        return;
      }
      if (authState.lastEvent === 'SIGNED_OUT') {
        activateAuthGate('已安全登出。');
      } else if (authState.lastEvent === 'SESSION_RESTORE_FAILED') {
        activateAuthGate('無法恢復登入狀態，請重新登入或使用訪客身分。');
      } else if (Game.isGuest !== true) {
        setStatus('');
      }
    };

    activateAuthGate();
    window.addEventListener?.('sunheart:auth-state', handleAuthState);

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (isLeaving || isSubmitting) return;

      const account = accountInput.value.trim();
      const password = passwordInput.value;
      if (!account) {
        setStatus('請輸入電子信箱。');
        accountInput.focus();
        return;
      }
      if (!EMAIL_PATTERN.test(account)) {
        setStatus('電子信箱格式不正確。');
        accountInput.focus();
        return;
      }
      if (!password) {
        setStatus('請輸入密碼。');
        passwordInput.focus();
        return;
      }

      const authFunction = mode === 'register' ? window.registerExplorer : window.authenticateExplorer;
      if (typeof authFunction !== 'function') {
        setStatus('認證服務尚未連線，現階段請先使用訪客身分進入。');
        return;
      }

      setLoading(true);
      if (submitButton) {
        submitButton.textContent = mode === 'register'
          ? '正在建立探勘紀錄……'
          : '正在讀取探勘紀錄……';
      }
      setStatus(mode === 'register' ? '正在建立探勘者身分……' : '正在驗證探勘者身分……');

      try {
        const result = await authFunction({ account, password });
        if (!result?.ok) {
          setStatus(result?.message || (mode === 'register' ? '建立帳號失敗。' : '登入失敗。'));
          return;
        }

        if (mode === 'register' && result.confirmationRequired) {
          passwordInput.value = '';
          setMode('login', result.message || '請至信箱完成驗證後再登入。');
          return;
        }

        const user = result.user || result.session?.user || null;
        if (!user) {
          setStatus('認證完成但沒有取得使用者資料，請重新登入。');
          return;
        }
        setStatus(mode === 'register' ? '探勘紀錄已建立。' : '探勘紀錄已確認。');
        enterMainMenu({ isGuest: false, user });
      } catch {
        setStatus('目前無法連線認證服務，請稍後再試或使用訪客身分。');
      } finally {
        if (!isLeaving) {
          setLoading(false);
          if (submitButton) submitButton.textContent = mode === 'register' ? '建立探勘紀錄' : '載入探勘紀錄';
        }
      }
    });

    guestButton.addEventListener('click', () => {
      if (isSubmitting) return;
      window.audio?.play('click');
      setStatus('正在以訪客身分進入……');
      enterMainMenu({ isGuest: true });
    });

    forgotButton?.addEventListener('click', async () => {
      if (isSubmitting || isLeaving) return;
      const account = accountInput.value.trim();
      if (!account) {
        setStatus('請先輸入電子信箱。');
        accountInput.focus();
        return;
      }
      if (!EMAIL_PATTERN.test(account)) {
        setStatus('電子信箱格式不正確。');
        accountInput.focus();
        return;
      }
      if (typeof window.openExplorerPasswordReset !== 'function') {
        setStatus('忘記密碼功能尚未連線。');
        return;
      }

      setLoading(true);
      setStatus('正在寄送密碼重設信……');
      try {
        const result = await window.openExplorerPasswordReset(account);
        setStatus(result?.message || (result?.ok ? '密碼重設信已送出。' : '目前無法寄送密碼重設信。'));
      } catch {
        setStatus('目前無法連線認證服務，請稍後再試。');
      } finally {
        setLoading(false);
      }
    });

    registerButton?.addEventListener('click', () => {
      if (isSubmitting || isLeaving) return;
      setMode(mode === 'register' ? 'login' : 'register');
      accountInput.focus();
    });

    handleAuthState({ detail: window.getExplorerAuthSnapshot?.() });
  }

  window.setupExplorerGate = setupExplorerGate;
})();
