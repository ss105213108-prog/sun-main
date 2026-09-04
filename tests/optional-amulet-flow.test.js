const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

class ReadyImage {
  constructor() {
    this.complete = true;
    this.naturalWidth = 1024;
    this.naturalHeight = 768;
  }
  set src(value) { this._src = value; }
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

function makeElement(initial = []) {
  const listeners = {};
  return {
    classList: makeClassList(initial),
    style: {},
    textContent: '',
    innerHTML: '',
    disabled: false,
    addEventListener(type, handler) { listeners[type] = handler; },
    dispatch(type) {
      if (listeners[type]) return listeners[type]({ currentTarget: this });
      if (type === 'click') return this.onclick?.({ currentTarget: this });
    }
  };
}

function createJudgementHarness() {
  const submitButton = makeElement();
  const collectButton = makeElement();
  const relicOverlay = makeElement(['hidden']);
  const scaleOverlay = makeElement(['hidden']);
  const elements = {
    'submit-scale-btn': submitButton,
    'collect-relic-btn': collectButton,
    'relic-reveal-overlay': relicOverlay,
    'scale-overlay': scaleOverlay
  };
  const dialogueLog = [];
  const Game = {
    width: 960,
    height: 540,
    cameraX: 0,
    currentScene: 'judgement_chamber',
    state: 'PLAYING',
    progress: {},
    inventory: [],
    scaleState: { left: null, right: null },
    timer: { remainingSeconds: 500 }
  };
  const context = {
    Image: ReadyImage,
    Game,
    player: { y: 450 },
    audio: { play() {} },
    performance: { now: () => 1000 },
    localStorage: { getItem: () => null, setItem() {} },
    document: {
      getElementById: id => elements[id] || null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => makeElement()
    },
    window: {
      player: { y: 450 },
      addEventListener(type, handler) {
        if (type === 'DOMContentLoaded') handler();
      },
      triggerDialogue(speaker, lines, callback) {
        dialogueLog.push({ speaker, lines });
        callback?.();
      }
    },
    setTimeout: handler => { handler(); return 1; },
    clearTimeout() {}
  };
  vm.runInNewContext(fs.readFileSync('js/judgement.js', 'utf8'), context);
  return {
    Game,
    dialogueLog,
    submitButton,
    collectButton,
    objects: context.window.judgementSceneObjects
  };
}

const explored = createJudgementHarness();
explored.objects.find(object => object.id === 'feather_scale_relief').onInteract();
explored.objects.find(object => object.id === 'judgement_scale').onInteract();
assert.strictEqual(explored.Game.progress.scaleCompartmentOpened, true, '先讀壁畫後應發現天秤暗格');
assert.strictEqual(explored.Game.progress.priestAmuletFound, false, '按下收取前不應提前把護符放進背包');
explored.collectButton.dispatch('click');
assert.strictEqual(explored.Game.progress.priestAmuletFound, true, '玩家應能從暗格取得祭司護符');
assert.ok(explored.Game.inventory.includes('priest_amulet'));

const rushed = createJudgementHarness();
rushed.objects.find(object => object.id === 'judgement_scale').onInteract();
assert.strictEqual(rushed.Game.progress.priestAmuletFound, false, '未讀壁畫直接操作天秤時不應自動取得護符');
assert.strictEqual(rushed.Game.progress.scalePuzzleIntroduced, true, '未讀壁畫仍可開始天秤解謎');
rushed.Game.inventory.push('stone_heart', 'truth_feather');
rushed.Game.scaleState = { left: 'stone_heart', right: 'truth_feather' };
rushed.submitButton.dispatch('click');
assert.strictEqual(rushed.Game.progress.scaleCleared, true, '沒有護符仍可完成第二試煉');
assert.strictEqual(rushed.Game.progress.scaleCompartmentSealed, true, '完成天秤後未開啟的暗格應永久鎖死');
rushed.objects.find(object => object.id === 'judgement_scale').onInteract();
assert.ok(
  rushed.dialogueLog.some(entry => entry.lines.some(line => line.includes('拿不出來'))),
  '錯過護符後再次調查應明確說明暗格已無法開啟'
);

function createTombWithoutAmuletHarness() {
  const Game = {
    width: 960,
    height: 540,
    cameraX: 0,
    currentScene: 'pharaoh_tomb',
    progress: { priestAmuletFound: false },
    inventory: [],
    mirrorState: [0, 0, 0],
    timer: { remainingSeconds: 100 }
  };
  const context = {
    Image: ReadyImage,
    Game,
    performance: { now: () => 1000 },
    window: {
      triggerDialogue(speaker, lines, callback) { callback?.(); }
    },
    document: {
      getElementById: () => null,
      querySelectorAll: () => [],
      createElement: () => null
    },
    setTimeout: () => 1,
    clearTimeout() {}
  };
  vm.runInNewContext(fs.readFileSync('js/tomb.js', 'utf8'), context);
  return { Game, window: context.window };
}

const unprotected = createTombWithoutAmuletHarness();
const throne = unprotected.window.pharaohTombSceneObjects.find(object => object.id === 'tomb_throne');
throne.onInteract();
assert.strictEqual(unprotected.Game.progress.tombMechanismActivated, true, '沒有護符仍應能啟動王座與銅鏡');
assert.strictEqual(unprotected.Game.progress.priestWarningRead, false, '沒有護符時不應讀到祭司的完整警告');
assert.strictEqual(unprotected.Game.progress.mirrorsRevealed, true, '無護符路線仍必須能繼續第三試煉');
unprotected.Game.mirrorState = [0, 1, 2];
unprotected.window.submitTombMirrorPuzzle();
assert.strictEqual(unprotected.Game.progress.mirrorPuzzleSolved, true);
assert.strictEqual(unprotected.window.chooseSunHeart('take'), true);
assert.strictEqual(unprotected.Game.progress.endingId, 'bad_entombed', '無護符帶走太陽之心應進入永眠於古墓結局');

const respectful = createTombWithoutAmuletHarness();
respectful.window.pharaohTombSceneObjects.find(object => object.id === 'tomb_throne').onInteract();
respectful.Game.mirrorState = [0, 1, 2];
respectful.window.submitTombMirrorPuzzle();
assert.strictEqual(respectful.window.chooseSunHeart('leave'), true);
assert.strictEqual(respectful.Game.progress.endingId, 'true_guardian', '沒有護符但留下太陽之心仍應進入真結局');

console.log('optional priest amulet branches test passed');
