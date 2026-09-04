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

let interactionCalls = 0;
let dialogueCalls = 0;
let finalChoiceKey = null;

const Game = {
  state: 'PLAYING',
  inCutscene: false,
  entranceBlocked: false,
  worldWidth: 3600,
  width: 960,
  height: 540,
  cameraX: 0,
  cameraTargetX: null,
  currentScene: 'sun_temple',
  screenShake: { duration: 0, elapsed: 0, magnitude: 0, offsetX: 0, offsetY: 0 }
};

const windowStub = {
  attemptInteraction() { interactionCalls += 1; },
  openInventory() {},
  advanceDialogue() { dialogueCalls += 1; },
  closeModal() {},
  handleSunHeartChoiceKey(event) { finalChoiceKey = event.key; }
};

const context = {
  Game,
  window: windowStub,
  Image: ReadyImage,
  document: { getElementById() { return null; } },
  performance: { now: () => 0 },
  Math,
  isNaN
};

vm.runInNewContext(fs.readFileSync('js/player.js', 'utf8'), context);
context.keys = windowStub.keys;
context.player = windowStub.player;

windowStub.handleKeyDown({ key: 'E', repeat: true });
assert.strictEqual(interactionCalls, 0, '按住 E 不應重複觸發場景互動');
windowStub.handleKeyDown({ key: 'E', repeat: false });
assert.strictEqual(interactionCalls, 1, '首次按下 E 應正常互動');

Game.state = 'DIALOGUE';
windowStub.handleKeyDown({ key: 'Enter', repeat: true });
assert.strictEqual(dialogueCalls, 0, '按住對話鍵不應一次跳過多句');
windowStub.handleKeyDown({ key: 'Enter', repeat: false });
assert.strictEqual(dialogueCalls, 1, '首次按下對話鍵應正常推進');

Game.state = 'FINAL_CHOICE';
windowStub.handleKeyDown({ key: 'ArrowRight', repeat: false });
assert.strictEqual(finalChoiceKey, 'ArrowRight', '最終選擇應交給專用鍵盤處理器');

Game.state = 'PLAYING';
windowStub.handleKeyDown({ key: 'ArrowLeft', repeat: true });
assert.strictEqual(windowStub.keys.a, true, '移動鍵持續按住仍應保持有效');

console.log('keyboard input flow regression test passed');
