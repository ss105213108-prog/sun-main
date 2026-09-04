(() => {
  const SETTINGS_STORAGE_KEY = 'sunHeartSettingsV1';
  const DEFAULT_SETTINGS = {
    volume: 0.8,
    textSpeed: 42
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function readSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY));
      return {
        volume: clamp(Number(saved?.volume ?? DEFAULT_SETTINGS.volume), 0, 1),
        textSpeed: [28, 42, 70].includes(Number(saved?.textSpeed))
          ? Number(saved.textSpeed)
          : DEFAULT_SETTINGS.textSpeed
      };
    } catch (error) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  const settings = readSettings();

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {}
  }

  function applySettings() {
    if (window.audio?.setVolume) window.audio.setVolume(settings.volume);
  }

  function setupMainMenu({ startNewGame, continueGame }) {
    const overlay = document.getElementById('main-menu-overlay');
    const actions = document.getElementById('main-menu-actions');
    const settingsPanel = document.getElementById('main-menu-settings-panel');
    const newGameButton = document.getElementById('main-menu-new-game');
    const continueButton = document.getElementById('main-menu-continue');
    const instructionsButton = document.getElementById('main-menu-instructions');
    const settingsButton = document.getElementById('main-menu-settings');
    const instructionsPanel = document.getElementById('main-menu-instructions-panel');
    const instructionsBackButton = document.getElementById('main-menu-instructions-back');
    const settingsBackButton = document.getElementById('main-menu-settings-back');
    const saveStatus = document.getElementById('main-menu-save-status');
    const volumeInput = document.getElementById('setting-volume');
    const volumeOutput = document.getElementById('setting-volume-value');
    const textSpeedSelect = document.getElementById('setting-text-speed');
    if (!overlay || !newGameButton || !continueButton) {
      startNewGame?.();
      return;
    }

    let refreshGeneration = 0;
    const applyContinueState = (checkpoint, message = '') => {
      continueButton.disabled = !checkpoint;
      if (saveStatus) {
        saveStatus.textContent = message || (checkpoint
          ? `最近紀錄：${checkpoint.label}`
          : '目前沒有可以繼續的紀錄');
      }
    };

    const refreshContinueState = () => {
      const generation = ++refreshGeneration;
      if (typeof window.getActiveGameSaveSummary !== 'function') {
        const checkpoint = window.getGameCheckpointSummary?.() || null;
        applyContinueState(checkpoint);
        return Promise.resolve(checkpoint);
      }

      continueButton.disabled = true;
      if (saveStatus) saveStatus.textContent = '正在確認存檔……';
      return window.getActiveGameSaveSummary().then(result => {
        if (generation !== refreshGeneration) return null;
        if (!result?.ok) {
          applyContinueState(null, result?.message || '目前無法確認雲端紀錄，請稍後重試。');
          return null;
        }
        const checkpoint = result.exists ? result.summary : null;
        applyContinueState(checkpoint);
        return checkpoint;
      }).catch(() => {
        if (generation === refreshGeneration) {
          applyContinueState(null, '目前無法確認雲端紀錄，請稍後重試。');
        }
        return null;
      });
    };

    if (volumeInput) volumeInput.value = String(Math.round(settings.volume * 100));
    if (volumeOutput) volumeOutput.textContent = `${Math.round(settings.volume * 100)}%`;
    if (textSpeedSelect) textSpeedSelect.value = String(settings.textSpeed);
    applySettings();

    const showActions = () => {
      instructionsPanel?.classList.add('hidden');
      settingsPanel?.classList.add('hidden');
      actions?.classList.remove('hidden');
      newGameButton.focus();
    };

    const hideMenu = (animate = false) => {
      if (!animate) {
        overlay.classList.add('hidden');
        return;
      }

      overlay.classList.add('is-leaving');
      const finishHiding = () => {
        overlay.classList.add('hidden');
        overlay.classList.remove('is-leaving');
      };
      if (typeof setTimeout === 'function') setTimeout(finishHiding, 720);
      else finishHiding();
    };

    const showMenu = () => {
      refreshContinueState();
      Game.state = 'MENU';
      Game.inCutscene = false;
      Game.currentInteractiveTarget = null;
      if (window.keys) {
        window.keys.a = false;
        window.keys.d = false;
      }
      if (window.player) {
        window.player.vx = 0;
        window.player.isWalking = false;
        window.player.autoWalkTarget = null;
        window.player.autoWalkCallback = null;
      }
      Game.timer.isRunning = false;
      Game.timer.lastTick = 0;
      document.getElementById('countdown-timer')?.classList.add('hidden');
      document.getElementById('current-objective')?.classList.add('hidden');
      document.getElementById('interaction-prompt')?.classList.add('hidden');
      document.getElementById('dialogue-panel')?.classList.add('hidden');
      document.getElementById('sun-heart-choice-overlay')?.classList.add('hidden');
      document.getElementById('game-container')?.classList.remove('final-choice-active');
      overlay.classList.remove('is-leaving', 'hidden');
      showActions();
    };

    newGameButton.addEventListener('click', async () => {
      window.audio?.play('click');
      hideMenu(true);
      await startNewGame?.();
    });

    continueButton.addEventListener('click', async () => {
      if (continueButton.disabled) return;
      window.audio?.play('click');
      continueButton.disabled = true;
      if (saveStatus) saveStatus.textContent = '正在載入探勘紀錄……';
      if (await continueGame?.() === false) {
        overlay.classList.remove('hidden');
        continueButton.disabled = true;
        if (saveStatus) saveStatus.textContent = '找不到可讀取的紀錄';
      } else {
        hideMenu();
      }
    });

    window.addEventListener?.('sunheart:auth-state', () => { refreshContinueState(); });
    window.addEventListener?.('sunheart:save-state', event => {
      const detail = event?.detail;
      if (detail?.message && saveStatus) saveStatus.textContent = detail.message;
      if (['synced', 'saved', 'imported'].includes(detail?.status)) {
        refreshContinueState();
      }
    });

    settingsButton?.addEventListener('click', () => {
      window.audio?.play('click');
      actions?.classList.add('hidden');
      instructionsPanel?.classList.add('hidden');
      settingsPanel?.classList.remove('hidden');
      volumeInput?.focus();
    });

    instructionsButton?.addEventListener('click', () => {
      window.audio?.play('click');
      actions?.classList.add('hidden');
      settingsPanel?.classList.add('hidden');
      instructionsPanel?.classList.remove('hidden');
      instructionsBackButton?.focus();
    });

    instructionsBackButton?.addEventListener('click', () => {
      window.audio?.play('click');
      showActions();
    });

    settingsBackButton?.addEventListener('click', () => {
      window.audio?.play('click');
      showActions();
    });

    volumeInput?.addEventListener('input', event => {
      settings.volume = clamp(Number(event.target.value) / 100, 0, 1);
      if (volumeOutput) volumeOutput.textContent = `${Math.round(settings.volume * 100)}%`;
      applySettings();
      saveSettings();
    });

    textSpeedSelect?.addEventListener('change', event => {
      settings.textSpeed = Number(event.target.value);
      saveSettings();
    });

    window.returnToMainMenu = showMenu;
    window.refreshMainMenuSaveState = refreshContinueState;
    showMenu();
  }

  window.gameSettings = settings;
  window.getGameSettings = () => ({ ...settings });
  window.setupMainMenu = setupMainMenu;
})();
