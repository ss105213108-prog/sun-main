const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function makeClassList(initiallyHidden = true) {
  const classes = new Set(initiallyHidden ? ['hidden'] : []);
  return {
    add(name) { classes.add(name); },
    remove(name) { classes.delete(name); },
    toggle(name) { classes.has(name) ? classes.delete(name) : classes.add(name); },
    contains(name) { return classes.has(name); }
  };
}

const ids = [
  'inventory-overlay', 'puzzle-overlay', 'scale-overlay', 'relic-reveal-overlay',
  'dialogue-panel', 'interaction-prompt', 'death-overlay', 'countdown-timer',
  'death-title', 'death-reason', 'death-record', 'continue-checkpoint-btn',
  'death-restart-btn', 'ending-conditions-btn', 'ending-conditions'
];
const elements = Object.fromEntries(ids.map(id => [id, {
  id,
  textContent: '',
  disabled: false,
  classList: makeClassList(),
  addEventListener() {}
}]));

const storage = new Map();
const localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, value); },
  removeItem(key) { storage.delete(key); }
};

const player = {
  x: 230,
  y: 432,
  direction: 1,
  vx: 0,
  isWalking: false,
  autoWalkTarget: null,
  autoWalkCallback: null
};
const judgementObjects = [{ id: 'judgement_scale' }];
const sunTempleObjects = [{ id: 'ancient_mural' }];
const pharaohTombObjects = [{ id: 'tomb_entrance' }];
const Game = {
  state: 'PLAYING',
  width: 960,
  worldWidth: 2500,
  currentScene: 'judgement_chamber',
  progress: {
    scene2Entered: true,
    judgementMuralRead: false,
    scaleCompartmentOpened: false,
    scaleMistakes: 0,
    collectedTrialItems: {}
  },
  inventory: ['priest_amulet'],
  selectedItem: null,
  scaleState: { left: null, right: null },
  timer: { remainingSeconds: 420, isRunning: true, lastTick: 0 },
  screenShake: { duration: 0, offsetX: 0, offsetY: 0 },
  sceneObjects: judgementObjects,
  particles: [],
  fallingRocks: [],
  dustParticles: []
};

const context = {
  Game,
  player,
  localStorage,
  performance: { now: () => 12345 },
  Date,
  JSON,
  console,
  document: { getElementById: id => elements[id] || null },
  window: {
    player,
    judgementSceneObjects: judgementObjects,
    judgementWorldWidth: 2500,
    pharaohTombSceneObjects: pharaohTombObjects,
    pharaohTombWorldWidth: 2000,
    sunTempleSceneObjects: sunTempleObjects,
    updateTimerDisplay() {}
  }
};

vm.runInNewContext(fs.readFileSync('js/checkpoint.js', 'utf8'), context);

const checkpoint = context.window.createGameCheckpoint('天秤審判室入口');
assert.strictEqual(checkpoint.sceneId, 'judgement_chamber');
assert.strictEqual(checkpoint.progress.scaleMistakes, 0);
assert.ok(storage.has('sunHeartCheckpointV1'), '檢查點應寫入 localStorage');
assert.strictEqual(context.window.getGameCheckpointSummary().label, '天秤審判室入口');

Game.progress.scaleMistakes = 2;
Game.progress.judgementMuralRead = true;
Game.inventory.length = 0;
Game.scaleState.left = 'stone_heart';
Game.timer.remainingSeconds = 0;
player.x = 1800;

assert.strictEqual(context.window.restoreGameCheckpoint(), true);
assert.strictEqual(Game.currentScene, 'judgement_chamber');
assert.strictEqual(Game.progress.scaleMistakes, 0, '死亡造成的錯誤不應保留');
assert.strictEqual(Game.progress.judgementMuralRead, false);
assert.strictEqual(Game.inventory.join(','), 'priest_amulet');
assert.strictEqual(Game.scaleState.left, null);
assert.strictEqual(Game.timer.remainingSeconds, 420);
assert.strictEqual(Game.timer.lastTick, 12345);
assert.strictEqual(player.x, 230);
assert.strictEqual(Game.sceneObjects, judgementObjects);

context.window.showDeathScreen({
  title: 'BAD END：未通過的審判',
  reason: '天秤錯誤操作累積兩次。'
});
assert.strictEqual(Game.state, 'GAME_OVER');
assert.strictEqual(Game.timer.isRunning, false);
assert.strictEqual(elements['death-overlay'].classList.contains('hidden'), false);
assert.strictEqual(elements['death-record'].textContent, '最近紀錄：天秤審判室入口');
assert.strictEqual(elements['continue-checkpoint-btn'].disabled, false);

context.window.clearGameCheckpoint();
assert.strictEqual(storage.has('sunHeartCheckpointV1'), false);
assert.strictEqual(Game.checkpoint, null);

Game.currentScene = 'pharaoh_tomb';
Game.sceneObjects = pharaohTombObjects;
Game.worldWidth = 2000;
Game.progress.scene3Entered = true;
Game.mirrorState = [1, 2, 3];
Game.timer.remainingSeconds = 300;
player.x = 180;
context.window.createGameCheckpoint('法老王墓室入口');
Game.currentScene = 'sun_temple';
Game.mirrorState = [0, 0, 0];
player.x = 900;

assert.strictEqual(context.window.restoreGameCheckpoint(), true);
assert.strictEqual(Game.currentScene, 'pharaoh_tomb');
assert.strictEqual(Game.sceneObjects, pharaohTombObjects);
assert.strictEqual(Game.worldWidth, 2000);
assert.strictEqual(Game.mirrorState.join(','), '1,2,3');
assert.strictEqual(player.x, 180);
context.window.clearGameCheckpoint();

const judgementSource = fs.readFileSync('js/judgement.js', 'utf8');
assert.doesNotMatch(judgementSource, /fillText\(['"]已取走['"]/);

console.log('checkpoint and collected-item regression tests passed');
