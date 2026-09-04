const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function makeClassList(initial = []) {
  const values = new Set(initial);
  return {
    add(...items) { items.forEach(item => values.add(item)); },
    remove(...items) { items.forEach(item => values.delete(item)); },
    contains(value) { return values.has(value); }
  };
}

function makeElement(id, hidden = false) {
  const listeners = {};
  return {
    id,
    value: '',
    textContent: '',
    disabled: false,
    classList: makeClassList(hidden ? ['hidden'] : []),
    addEventListener(type, handler) { listeners[type] = handler; },
    focus() {},
    dispatch(type) { return listeners[type]?.({ target: this }); }
  };
}

const ids = [
  'main-menu-overlay', 'main-menu-actions', 'main-menu-settings-panel',
  'main-menu-new-game', 'main-menu-continue', 'main-menu-instructions',
  'main-menu-settings', 'main-menu-instructions-panel',
  'main-menu-instructions-back', 'main-menu-settings-back',
  'main-menu-save-status', 'setting-volume', 'setting-volume-value',
  'setting-text-speed', 'interaction-prompt', 'dialogue-panel',
  'sun-heart-choice-overlay', 'game-container'
];
const elements = Object.fromEntries(ids.map(id => [id, makeElement(id, id === 'main-menu-overlay')]));
const windowListeners = new Map();
let summaryCalls = 0;

const Game = {
  state: 'AUTH_GATE',
  inCutscene: false,
  timer: { isRunning: false }
};

const windowStub = {
  keys: {},
  player: {},
  audio: { setVolume() {}, play() {} },
  addEventListener(type, listener) { windowListeners.set(type, listener); },
  async getActiveGameSaveSummary() {
    summaryCalls += 1;
    if (summaryCalls <= 4) {
      windowListeners.get('sunheart:save-state')?.({
        detail: { status: 'empty', message: '目前沒有雲端探勘紀錄。' }
      });
    }
    return { ok: true, exists: false, source: 'cloud' };
  }
};

const context = {
  Game,
  window: windowStub,
  localStorage: { getItem() { return null; }, setItem() {} },
  document: { getElementById: id => elements[id] || null },
  JSON,
  Number,
  Math,
  Promise
};

(async () => {
  vm.runInNewContext(fs.readFileSync('js/main-menu.js', 'utf8'), context);
  context.window.setupMainMenu({ startNewGame() {}, continueGame() { return false; } });
  await new Promise(resolve => setImmediate(resolve));

  assert.strictEqual(summaryCalls, 1, 'Member + 0 cloud save must not trigger a load feedback loop');
  assert.strictEqual(Game.state, 'MENU');
  assert.strictEqual(elements['main-menu-overlay'].classList.contains('hidden'), false);
  assert.strictEqual(elements['main-menu-new-game'].disabled, false, 'member without a save can start a new game');
  assert.strictEqual(elements['main-menu-continue'].disabled, true, 'continue remains disabled without a save');
  assert.strictEqual(elements['main-menu-save-status'].textContent, '目前沒有可以繼續的紀錄');

  console.log('member + empty cloud save main-menu regression test passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
