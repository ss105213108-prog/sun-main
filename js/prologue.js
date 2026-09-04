(() => {
  const REVEAL_COMPLETE_MS = 5800;
  const FADE_OUT_MS = 900;

  let overlay = null;
  let enterButton = null;
  let skipButton = null;
  let completionTimer = null;
  let preparedGame = Promise.resolve();
  let prepareGame = null;
  let enterGame = null;
  let isComplete = false;
  let isEntering = false;
  let listenersBound = false;

  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

  function clearCompletionTimer() {
    if (completionTimer !== null) {
      clearTimeout(completionTimer);
      completionTimer = null;
    }
  }

  function completePrologue() {
    if (!overlay || isComplete) return;
    clearCompletionTimer();
    isComplete = true;
    overlay.classList.add('is-complete');
    enterButton?.classList.add('is-visible');
    if (enterButton) enterButton.disabled = false;
    enterButton?.focus();
  }

  async function enterTomb() {
    if (!overlay || !isComplete || isEntering) return;
    isEntering = true;
    if (enterButton) enterButton.disabled = true;
    if (skipButton) skipButton.disabled = true;
    window.audio?.play('click');
    overlay.classList.add('is-leaving');
    if (Game.timer) {
      Game.timer.isRunning = false;
      Game.timer.lastTick = 0;
    }

    await Promise.all([preparedGame, wait(FADE_OUT_MS)]);
    overlay.classList.add('hidden');
    overlay.classList.remove('is-active', 'is-complete', 'is-leaving');
    overlay.setAttribute('aria-hidden', 'true');
    await enterGame?.();
  }

  function setupPrologue(options = {}) {
    prepareGame = options.prepareGame || null;
    enterGame = options.enterGame || null;
    overlay = document.getElementById('prologue-overlay');
    enterButton = document.getElementById('prologue-enter');
    skipButton = document.getElementById('prologue-skip');
    if (!overlay || !enterButton || !skipButton || listenersBound) return;

    skipButton.addEventListener('click', completePrologue);
    enterButton.addEventListener('click', enterTomb);
    listenersBound = true;
  }

  function openGamePrologue() {
    if (!overlay || !enterButton || !skipButton) {
      enterGame?.();
      return false;
    }

    clearCompletionTimer();
    isComplete = false;
    isEntering = false;
    enterButton.disabled = true;
    skipButton.disabled = false;
    enterButton.classList.remove('is-visible');
    overlay.classList.remove('is-active', 'is-complete', 'is-leaving');
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    void overlay.offsetWidth;
    overlay.classList.add('is-active');

    Game.state = 'PROLOGUE';
    Game.inCutscene = true;
    if (Game.timer) {
      Game.timer.isRunning = false;
      Game.timer.lastTick = 0;
    }
    document.getElementById('countdown-timer')?.classList.add('hidden');

    preparedGame = Promise.resolve()
      .then(() => prepareGame?.())
      .catch(error => {
        if (window.reportRuntimeError) window.reportRuntimeError(error);
      });
    completionTimer = setTimeout(completePrologue, REVEAL_COMPLETE_MS);
    return true;
  }

  window.setupPrologue = setupPrologue;
  window.openGamePrologue = openGamePrologue;
  window.completeGamePrologue = completePrologue;
})();
