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
    dispatch(type, value) {
      if (typeof value !== 'undefined') this.value = value;
      listeners[type]?.({ target: this });
    }
  };
}

const elements = {
  'main-menu-overlay': makeElement('main-menu-overlay', true),
  'main-menu-actions': makeElement('main-menu-actions'),
  'main-menu-settings-panel': makeElement('main-menu-settings-panel', true),
  'main-menu-new-game': makeElement('main-menu-new-game'),
  'main-menu-continue': makeElement('main-menu-continue'),
  'main-menu-instructions': makeElement('main-menu-instructions'),
  'main-menu-settings': makeElement('main-menu-settings'),
  'main-menu-instructions-panel': makeElement('main-menu-instructions-panel', true),
  'main-menu-instructions-back': makeElement('main-menu-instructions-back'),
  'main-menu-settings-back': makeElement('main-menu-settings-back'),
  'main-menu-save-status': makeElement('main-menu-save-status'),
  'setting-volume': makeElement('setting-volume'),
  'setting-volume-value': makeElement('setting-volume-value'),
  'setting-text-speed': makeElement('setting-text-speed'),
  'interaction-prompt': makeElement('interaction-prompt'),
  'dialogue-panel': makeElement('dialogue-panel'),
  'sun-heart-choice-overlay': makeElement('sun-heart-choice-overlay'),
  'game-container': makeElement('game-container')
};

const storage = new Map([
  ['sunHeartSettingsV1', JSON.stringify({ volume: 0.55, textSpeed: 28 })]
]);
const localStorage = {
  getItem(key) { return storage.get(key) ?? null; },
  setItem(key, value) { storage.set(key, value); }
};

let appliedVolume = null;
let newGameStarted = false;
const Game = {
  state: 'PLAYING',
  inCutscene: false,
  timer: { isRunning: true }
};
const windowStub = {
  keys: { a: true, d: true },
  player: {
    vx: 3,
    isWalking: true,
    autoWalkTarget: 400,
    autoWalkCallback() {}
  },
  audio: {
    setVolume(value) { appliedVolume = value; },
    play() {}
  },
  getGameCheckpointSummary() {
    return { label: '法老王墓室入口', sceneId: 'pharaoh_tomb', createdAt: 1 };
  }
};

const context = {
  Game,
  window: windowStub,
  localStorage,
  document: { getElementById: id => elements[id] || null },
  JSON,
  Number,
  Math
};

vm.runInNewContext(fs.readFileSync('js/main-menu.js', 'utf8'), context);
context.window.setupMainMenu({
  startNewGame() { newGameStarted = true; },
  continueGame() { return true; }
});

assert.strictEqual(Game.state, 'MENU');
assert.strictEqual(Game.timer.isRunning, false);
assert.strictEqual(elements['main-menu-overlay'].classList.contains('hidden'), false);
assert.strictEqual(elements['main-menu-continue'].disabled, false);
assert.strictEqual(elements['main-menu-save-status'].textContent, '最近紀錄：法老王墓室入口');
assert.strictEqual(appliedVolume, 0.55);

elements['main-menu-settings'].dispatch('click');
assert.strictEqual(elements['main-menu-actions'].classList.contains('hidden'), true);
assert.strictEqual(elements['main-menu-settings-panel'].classList.contains('hidden'), false);

elements['setting-volume'].dispatch('input', '25');
assert.strictEqual(context.window.gameSettings.volume, 0.25);
assert.strictEqual(appliedVolume, 0.25);
elements['setting-text-speed'].dispatch('change', '70');
assert.strictEqual(context.window.gameSettings.textSpeed, 70);

elements['main-menu-settings-back'].dispatch('click');
elements['main-menu-instructions'].dispatch('click');
assert.strictEqual(elements['main-menu-actions'].classList.contains('hidden'), true);
assert.strictEqual(elements['main-menu-instructions-panel'].classList.contains('hidden'), false);
elements['main-menu-instructions-back'].dispatch('click');
assert.strictEqual(elements['main-menu-actions'].classList.contains('hidden'), false);

elements['main-menu-new-game'].dispatch('click');
assert.strictEqual(newGameStarted, true);
assert.strictEqual(elements['main-menu-overlay'].classList.contains('hidden'), true);

context.window.returnToMainMenu();
assert.strictEqual(Game.state, 'MENU', '結局後應回到既有主頁狀態');
assert.strictEqual(Game.timer.isRunning, false);
assert.strictEqual(windowStub.keys.a, false, '回主頁時應清除水平移動輸入');
assert.strictEqual(windowStub.keys.d, false, '回主頁時應清除水平移動輸入');
assert.strictEqual(windowStub.player.vx, 0, '回主頁時角色不得繼續移動');
assert.strictEqual(windowStub.player.autoWalkTarget, null, '回主頁時應取消自動行走');
assert.strictEqual(elements['interaction-prompt'].classList.contains('hidden'), true);
assert.strictEqual(elements['dialogue-panel'].classList.contains('hidden'), true);
assert.strictEqual(elements['sun-heart-choice-overlay'].classList.contains('hidden'), true);
assert.strictEqual(elements['main-menu-overlay'].classList.contains('hidden'), false, '返回主頁不應重新初始化遊戲');
assert.strictEqual(elements['main-menu-actions'].classList.contains('hidden'), false);

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/style.css', 'utf8');
const tombSource = fs.readFileSync('js/tomb.js', 'utf8');
assert.doesNotMatch(html, /id="tomb-editor-toggle"/);
assert.doesNotMatch(tombSource, /\n\s*setupTombLayoutEditor\(\);/);
assert.match(html, /id="loading-overlay" class="hidden"/);
assert.match(html, /id="main-menu-overlay" class="main-menu-overlay"/);
assert.match(html, /主頁面按鈕\/太陽之心標題\.png/);
assert.match(html, /主頁面按鈕\/開始遊戲\.png/);
assert.match(html, /main-menu-art-button/);
assert.match(css, /主畫面背景\.png/);

console.log('main menu and retired tomb editor test passed');
