// 場景入口檢查點與死亡回檔
(function setupCheckpointSystem() {
  const STORAGE_KEY = 'sunHeartCheckpointV1';

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function readStoredCheckpoint() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.version !== 1 || !parsed.sceneId || !parsed.progress) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function saveStoredCheckpoint(checkpoint) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checkpoint));
    } catch (error) {}
  }

  function createGameCheckpoint(label) {
    let checkpoint = {
      version: 1,
      label,
      sceneId: Game.currentScene,
      createdAt: Date.now(),
      progress: clone(Game.progress),
      inventory: [...Game.inventory],
      selectedItem: Game.selectedItem ?? null,
      scaleState: clone(Game.scaleState || { left: null, right: null }),
      mirrorState: clone(Game.mirrorState || [0, 0, 0]),
      timer: {
        remainingSeconds: Game.timer.remainingSeconds,
        isRunning: Game.timer.isRunning
      },
      player: window.player ? {
        x: player.x,
        y: player.y,
        direction: player.direction
      } : null
    };

    const validation = window.validateGameSave?.(checkpoint);
    if (validation && !validation.ok) return null;
    if (validation?.save) checkpoint = validation.save;

    Game.checkpoint = checkpoint;
    if (typeof window.saveActiveGameCheckpoint === 'function') {
      Promise.resolve(window.saveActiveGameCheckpoint(checkpoint)).catch(() => {});
    } else if (Game.isGuest !== false) {
      saveStoredCheckpoint(checkpoint);
    }
    return checkpoint;
  }

  function clearGameCheckpoint() {
    Game.checkpoint = null;
    if (typeof window.beginNewGameSave === 'function') {
      window.beginNewGameSave();
    } else if (Game.isGuest !== false) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {}
    }
  }

  function getGameCheckpointSummary() {
    const checkpoint = Game.checkpoint || (Game.isGuest === false ? null : readStoredCheckpoint());
    if (!checkpoint) return null;
    return {
      label: checkpoint.label || '古墓入口',
      sceneId: checkpoint.sceneId,
      createdAt: checkpoint.createdAt
    };
  }

  function hideGameplayOverlays() {
    [
      'inventory-overlay',
      'puzzle-overlay',
      'scale-overlay',
      'relic-reveal-overlay',
      'sun-heart-choice-overlay',
      'tomb-ending-overlay',
      'dialogue-panel',
      'interaction-prompt'
    ].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    document.getElementById('game-container')?.classList.remove('final-choice-active');
  }

  function restoreGameCheckpoint(checkpointOverride = null) {
    let checkpoint = checkpointOverride || Game.checkpoint || (Game.isGuest === false ? null : readStoredCheckpoint());
    if (!checkpoint) return false;
    const validation = window.validateGameSave?.(checkpoint);
    if (validation && !validation.ok) return false;
    if (validation?.save) checkpoint = validation.save;

    Game.checkpoint = checkpoint;
    Game.currentScene = checkpoint.sceneId;
    Game.progress = clone(checkpoint.progress);
    Game.inventory = [...checkpoint.inventory];
    Game.selectedItem = checkpoint.selectedItem;
    Game.scaleState = clone(checkpoint.scaleState || { left: null, right: null });
    Game.mirrorState = clone(checkpoint.mirrorState || [0, 0, 0]);
    Game.timer.remainingSeconds = checkpoint.timer.remainingSeconds;
    Game.timer.isRunning = checkpoint.timer.isRunning;
    Game.timer.lastTick = performance.now();
    Game.state = 'PLAYING';
    Game.inCutscene = false;
    Game.currentInteractiveTarget = null;
    Game.cameraTargetX = null;
    Game.fallingRocks = [];
    Game.dustParticles = [];
    Game.particles = [];
    Game.screenShake.duration = 0;
    Game.screenShake.offsetX = 0;
    Game.screenShake.offsetY = 0;

    if (checkpoint.sceneId === 'pharaoh_tomb') {
      Game.sceneObjects = window.pharaohTombSceneObjects || Game.sceneObjects;
      Game.worldWidth = window.pharaohTombWorldWidth || 2000;
      Game.entranceBlocked = false;
    } else if (checkpoint.sceneId === 'judgement_chamber') {
      Game.sceneObjects = window.judgementSceneObjects || Game.sceneObjects;
      Game.worldWidth = window.judgementWorldWidth || 2500;
      Game.entranceBlocked = false;
    } else {
      Game.sceneObjects = window.sunTempleSceneObjects || Game.sceneObjects;
      Game.worldWidth = 3600;
      Game.entranceBlocked = true;
      if (window.resetSunTemplePuzzleToEntrance) {
        window.resetSunTemplePuzzleToEntrance();
      }
    }

    if (window.player && checkpoint.player) {
      player.x = checkpoint.player.x;
      player.y = checkpoint.player.y;
      player.direction = checkpoint.player.direction;
      player.vx = 0;
      player.isWalking = false;
      player.autoWalkTarget = null;
      player.autoWalkCallback = null;
      Game.cameraX = Math.max(0, Math.min(
        Game.worldWidth - Game.width,
        player.x - Game.width / 2
      ));
    }

    hideGameplayOverlays();
    document.getElementById('death-overlay')?.classList.add('hidden');
    document.getElementById('countdown-timer')?.classList.remove('hidden');
    if (window.updateTimerDisplay) window.updateTimerDisplay();
    return true;
  }

  function showDeathScreen({ title, reason }) {
    Game.state = 'GAME_OVER';
    Game.timer.isRunning = false;
    Game.currentInteractiveTarget = null;
    hideGameplayOverlays();

    const checkpoint = Game.checkpoint || (Game.isGuest === false ? null : readStoredCheckpoint());
    const overlay = document.getElementById('death-overlay');
    const titleEl = document.getElementById('death-title');
    const reasonEl = document.getElementById('death-reason');
    const recordEl = document.getElementById('death-record');
    const continueButton = document.getElementById('continue-checkpoint-btn');

    if (titleEl) titleEl.textContent = title || 'BAD END：未通過的審判';
    if (reasonEl) reasonEl.textContent = reason || '古墓的封印已經完全閉合。';
    if (recordEl) {
      recordEl.textContent = checkpoint
        ? `最近紀錄：${checkpoint.label}`
        : '目前沒有可以返回的紀錄。';
    }
    if (continueButton) continueButton.disabled = !checkpoint;
    overlay?.classList.remove('hidden');
  }

  function setupDeathScreenEvents() {
    document.getElementById('continue-checkpoint-btn')?.addEventListener('click', () => {
      audio.play('click');
      restoreGameCheckpoint();
    });

    document.getElementById('death-restart-btn')?.addEventListener('click', () => {
      audio.play('click');
      clearGameCheckpoint();
      document.getElementById('death-overlay')?.classList.add('hidden');
      if (window.restartGame) window.restartGame();
    });

    document.getElementById('ending-conditions-btn')?.addEventListener('click', () => {
      audio.play('click');
      document.getElementById('ending-conditions')?.classList.toggle('hidden');
    });
  }

  Game.checkpoint = readStoredCheckpoint();
  window.createGameCheckpoint = createGameCheckpoint;
  window.restoreGameCheckpoint = restoreGameCheckpoint;
  window.clearGameCheckpoint = clearGameCheckpoint;
  window.getGameCheckpointSummary = getGameCheckpointSummary;
  window.showDeathScreen = showDeathScreen;
  setupDeathScreenEvents();
})();
