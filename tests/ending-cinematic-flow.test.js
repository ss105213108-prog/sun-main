const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

class ReadyImage {
  constructor() {
    this.complete = true;
    this.naturalWidth = 100;
    this.naturalHeight = 100;
  }
}

function makeClassList(initial = []) {
  const values = new Set(initial);
  return {
    add(...items) { items.forEach(item => values.add(item)); },
    remove(...items) { items.forEach(item => values.delete(item)); },
    toggle(item, force) {
      if (force === true) values.add(item);
      else if (force === false) values.delete(item);
      else if (values.has(item)) values.delete(item);
      else values.add(item);
    },
    contains(item) { return values.has(item); }
  };
}

let activeElement = null;

function makeElement(id, initial = []) {
  const children = [];
  return {
    id,
    offsetWidth: 960,
    classList: makeClassList(initial),
    style: { setProperty(name, value) { this[name] = value; } },
    children,
    appendChild(child) { children.push(child); },
    replaceChildren(...next) { children.splice(0, children.length, ...next); },
    setAttribute() {},
    focus() { activeElement = this; },
    blur() { if (activeElement === this) activeElement = null; },
    querySelector() { return null; }
  };
}

function createHarness() {
  activeElement = null;
  const ids = [
    'sun-heart-choice-overlay', 'take-sun-heart-btn', 'leave-sun-heart-btn', 'tomb-ending-overlay',
    'tomb-ending-title', 'tomb-ending-story', 'tomb-ending-skip-btn',
    'tomb-ending-checkpoint-btn'
  ];
  const elements = Object.fromEntries(ids.map(id => [id, makeElement(id, id.includes('overlay') ? ['hidden'] : [])]));
  const actions = makeElement('tomb-ending-actions');
  elements['tomb-ending-overlay'].querySelector = selector => selector === '.tomb-ending-actions' ? actions : null;
  const dialogueLog = [];
  let returnToMenuCalls = 0;
  let menuPreparedBeforeEndingHidden = false;
  let nextTimerId = 1;
  const timers = new Map();
  const Game = {
    width: 960,
    height: 540,
    cameraX: 0,
    currentScene: 'pharaoh_tomb',
    progress: {
      priestAmuletFound: false,
      tombMechanismActivated: true,
      mirrorsRevealed: true
    },
    inventory: [],
    mirrorState: [0, 1, 2],
    timer: { isRunning: true, lastTick: 99, remainingSeconds: 100 }
  };
  const context = {
    Image: ReadyImage,
    Game,
    performance: { now: () => 1000 },
    window: {
      triggerDialogue(speaker, lines, callback) {
        dialogueLog.push({ speaker, lines });
        callback?.();
      },
      getGameCheckpointSummary: () => ({ label: '法老王墓室入口' }),
      restoreGameCheckpoint() {},
      returnToMainMenu() {
        returnToMenuCalls += 1;
        menuPreparedBeforeEndingHidden = !elements['tomb-ending-overlay'].classList.contains('hidden');
      }
    },
    document: {
      getElementById: id => elements[id] || null,
      querySelectorAll: () => [],
      createElement: () => makeElement('ending-line'),
      get activeElement() { return activeElement; }
    },
    setTimeout(handler) {
      const id = nextTimerId++;
      timers.set(id, handler);
      return id;
    },
    clearTimeout(id) { timers.delete(id); }
  };
  vm.runInNewContext(fs.readFileSync('js/tomb.js', 'utf8'), context);
  return {
    Game,
    window: context.window,
    elements,
    dialogueLog,
    runNextTimer() {
      const entry = timers.entries().next().value;
      if (!entry) return false;
      const [id, handler] = entry;
      timers.delete(id);
      handler();
      return true;
    },
    getReturnToMenuCalls: () => returnToMenuCalls,
    wasMenuPreparedBeforeEndingHidden: () => menuPreparedBeforeEndingHidden
  };
}

const flow = createHarness();
assert.strictEqual(flow.window.submitTombMirrorPuzzle(), true);
assert.strictEqual(flow.Game.progress.mirrorPuzzleSolved, true);
assert.strictEqual(flow.Game.timer.isRunning, false, '最後機關完成後應停止倒數');
assert.strictEqual(flow.Game.timer.lastTick, 0);
assert.strictEqual(flow.elements['sun-heart-choice-overlay'].classList.contains('hidden'), true, '完成光路後不應在玩家抵達祭壇前顯示選擇');

const altar = flow.window.pharaohTombSceneObjects.find(object => object.id === 'tomb_sun_heart_altar');
assert.ok(altar, '右側太陽之心祭壇必須可互動');
altar.onInteract();
assert.strictEqual(flow.Game.progress.sunHeartAltarRevealed, true, '玩家調查右側祭壇後應記錄已看見解封的太陽之心');
assert.strictEqual(flow.Game.state, 'FINAL_CHOICE', '祭壇短對話結束後應直接進入最終選擇');
assert.strictEqual(flow.elements['sun-heart-choice-overlay'].classList.contains('hidden'), false);
assert.ok(flow.dialogueLog.some(entry => entry.lines.some(line => line.includes('是否該將它帶走'))));

let prevented = false;
assert.strictEqual(flow.window.handleSunHeartChoiceKey({ key: 'ArrowRight', preventDefault() { prevented = true; } }), true);
assert.strictEqual(flow.elements['leave-sun-heart-btn'], activeElement, '向右應選取留下太陽之心');
assert.strictEqual(prevented, true, '方向鍵選擇不應同時觸發瀏覽器捲動');
assert.strictEqual(flow.window.handleSunHeartChoiceKey({ key: 'E', preventDefault() {} }), true);
assert.strictEqual(flow.Game.progress.endingId, 'true_guardian');
assert.strictEqual(flow.elements['tomb-ending-story'].children.length, 4, '真結局應分成四段淡入文字');
assert.strictEqual(flow.elements['tomb-ending-overlay'].classList.contains('is-active'), true);
flow.elements['tomb-ending-skip-btn'].onclick();
assert.strictEqual(flow.elements['tomb-ending-overlay'].classList.contains('is-complete'), true, '略過動畫只應完成文字顯示');
assert.strictEqual(flow.Game.progress.endingId, 'true_guardian', '略過動畫不得改變結局');
assert.strictEqual(flow.runNextTimer(), true, '完整結局顯示後應排程淡出');
assert.strictEqual(flow.elements['tomb-ending-overlay'].classList.contains('is-leaving'), true);
assert.strictEqual(flow.getReturnToMenuCalls(), 1, '結局開始淡出前應先準備主頁');
assert.strictEqual(flow.wasMenuPreparedBeforeEndingHidden(), true, '主頁顯示時結局層仍應覆蓋場景');
assert.strictEqual(flow.runNextTimer(), true, '淡出後應回到主頁');
assert.strictEqual(flow.getReturnToMenuCalls(), 1);
assert.strictEqual(flow.elements['tomb-ending-overlay'].classList.contains('hidden'), true);

const source = fs.readFileSync('js/tomb.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/style.css', 'utf8');
assert.match(source, /\], showSunHeartChoice\);/, '祭壇短對話結束後必須直接串接最終選擇');
assert.match(source, /onInteract:\s*inspectSunHeartAltar/, '最終選擇必須由右側祭壇互動觸發');
assert.doesNotMatch(source, /sun-heart-altar-overlay/, '祭壇互動不應再開啟大型 CG 視窗');
assert.doesNotMatch(html, /id="sun-heart-altar-overlay"/, '頁面不應保留大型祭壇 CG 視窗');
assert.match(html, /太陽之心仍在微微跳動……/, '最終選擇應使用指定標題');
assert.match(html, /你要將它帶離這座陵墓嗎？/, '最終選擇應使用指定說明文字');
assert.match(html, /class="sun-heart-choice-tablet take-tablet"/, '取走選項應使用石刻選擇牌');
assert.match(html, /class="sun-heart-choice-tablet leave-tablet"/, '留下選項應使用石刻選擇牌');
assert.doesNotMatch(html, /id="take-sun-heart-btn" class="indie-btn"/, '最終選項不應沿用普通網頁按鈕樣式');
assert.match(css, /\.sun-heart-choice-tablet:hover[\s\S]*?translateY\(-3px\)/, '石板 hover 應輕微上浮');
assert.match(css, /transition:\s*transform 0\.24s ease/, '石板 hover 應使用平緩短過場');
assert.match(css, /#game-container\.final-choice-active #hud-panel/, '進入最終選擇時應弱化 HUD');
assert.match(css, /#tomb-ending-overlay\s*\{[\s\S]*?z-index:\s*650/, '結局層應高於主頁，淡出時才不會露出遊戲場景');
assert.match(source, /Game\.state = 'FINAL_CHOICE'/, '選擇期間應使用鎖定角色操作的狀態');
assert.match(source, /window\.handleSunHeartChoiceKey = handleSunHeartChoiceKey/, '最終選擇應提供共用鍵盤操作入口');
assert.doesNotMatch(html, /id="tomb-ending-restart-btn"/, '最終結局不應再顯示重新開始');

console.log('cinematic ending flow test passed');
