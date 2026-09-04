const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function makeClassList(initial = []) {
  const values = new Set(initial);
  return {
    add(...items) { items.forEach(item => values.add(item)); },
    remove(...items) { items.forEach(item => values.delete(item)); },
    contains(item) { return values.has(item); }
  };
}

function makeElement(id, initial = []) {
  const listeners = {};
  const attributes = {};
  return {
    id,
    disabled: false,
    offsetWidth: 960,
    classList: makeClassList(initial),
    addEventListener(type, handler) { listeners[type] = handler; },
    dispatch(type) { return listeners[type]?.({ currentTarget: this }); },
    setAttribute(name, value) { attributes[name] = String(value); },
    getAttribute(name) { return attributes[name]; },
    focus() {},
    querySelectorAll() { return []; }
  };
}

const revealSteps = Array.from({ length: 6 }, (_, index) => makeElement(`step-${index}`, ['prologue-reveal']));
const overlay = makeElement('prologue-overlay', ['hidden']);
overlay.querySelectorAll = selector => selector === '.prologue-reveal' ? revealSteps : [];
const enterButton = makeElement('prologue-enter');
const skipButton = makeElement('prologue-skip');
const countdownTimer = makeElement('countdown-timer');
const elements = {
  'prologue-overlay': overlay,
  'prologue-enter': enterButton,
  'prologue-skip': skipButton,
  'countdown-timer': countdownTimer
};

let nextTimerId = 1;
const timers = new Map();
const Game = {
  state: 'MENU',
  inCutscene: false,
  timer: { isRunning: true, lastTick: 10 }
};
let prepareCalls = 0;
let enterCalls = 0;

const context = {
  Game,
  Promise,
  document: { getElementById: id => elements[id] || null },
  setTimeout(handler) {
    const id = nextTimerId++;
    timers.set(id, handler);
    return id;
  },
  clearTimeout(id) { timers.delete(id); },
  window: {
    audio: { play() {} }
  }
};

(async () => {
vm.runInNewContext(fs.readFileSync('js/prologue.js', 'utf8'), context);
context.window.setupPrologue({
  prepareGame() { prepareCalls += 1; },
  enterGame() { enterCalls += 1; Game.state = 'CUTSCENE'; }
});

context.window.openGamePrologue();
assert.strictEqual(overlay.classList.contains('hidden'), false, '序章應顯示');
assert.strictEqual(overlay.classList.contains('is-active'), true, '序章文字動畫應啟動');
assert.strictEqual(Game.state, 'PROLOGUE', '序章期間應鎖定遊戲操作');
assert.strictEqual(Game.inCutscene, true);
assert.strictEqual(Game.timer.isRunning, false, '序章期間倒數不得啟動');
assert.strictEqual(Game.timer.lastTick, 0);
assert.strictEqual(countdownTimer.classList.contains('hidden'), true, '序章期間不得顯示倒數 HUD');
assert.strictEqual(enterButton.classList.contains('is-visible'), false, '劇情完成前不可顯示進入按鈕');

skipButton.dispatch('click');
assert.strictEqual(overlay.classList.contains('is-complete'), true, '跳過應立即顯示完整序章');
assert.strictEqual(enterButton.classList.contains('is-visible'), true, '跳過後應停在進入古墓前');
assert.strictEqual(enterCalls, 0, '跳過不得直接開始遊戲');

const enterResult = enterButton.dispatch('click');
await Promise.resolve();
for (const handler of [...timers.values()]) handler();
timers.clear();
await enterResult;
assert.strictEqual(prepareCalls, 1, '序章期間只應準備一次遊戲素材');
assert.strictEqual(enterCalls, 1, '進入古墓只能啟動一次原遊戲流程');
assert.strictEqual(overlay.classList.contains('hidden'), true, '進入遊戲後序章應隱藏');

const html = fs.readFileSync('index.html', 'utf8');
const prologueSource = fs.readFileSync('js/prologue.js', 'utf8');
const puzzleSource = fs.readFileSync('js/puzzle.js', 'utf8');
const sceneSource = fs.readFileSync('js/scene.js', 'utf8');
assert.match(html, /id="prologue-overlay"/);
assert.match(html, /數千年前，法老王阿蒙拉的陵墓/);
assert.match(html, /直到今日——/);
assert.match(html, /考古學家亞倫・卡特/);
assert.match(html, /id="prologue-enter"[^>]*>進入古墓</);
assert.match(html, /id="prologue-skip"[^>]*>跳過</);
assert.match(puzzleSource, /preloadGameAssets\?\.\('sun_temple', \{ showOverlay: false \}\)/, '序章預載不得顯示原進度條');
assert.match(sceneSource, /pausedForDevelopment:\s*false/, '正式測試時不得暫停 900 秒倒數');
assert.match(puzzleSource, /window\.DEVELOPMENT_START_SCENE = null/, '正式測試必須從主頁與序章進入遊戲');
assert.strictEqual((puzzleSource.match(/requestAnimationFrame\(gameLoop\)/g) || []).length, 2, '只能保留一個 game loop 啟動點與其遞迴排程');
assert.doesNotMatch(prologueSource, /addEventListener\(['"]key(?:down|up)/, '序章不得重複註冊角色鍵盤控制');

console.log('prologue flow test passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
