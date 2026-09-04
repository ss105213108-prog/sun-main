const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

class ReadyImage {
  constructor() {
    this.complete = true;
    this.naturalWidth = 1024;
    this.naturalHeight = 1536;
  }
  set src(value) { this._src = value; }
}

const Game = {
  width: 960,
  height: 540,
  cameraX: 0,
  currentScene: 'pharaoh_tomb',
  progress: { priestAmuletFound: true },
  inventory: ['priest_amulet'],
  mirrorState: [0, 0, 0],
  timer: { remainingSeconds: 100 }
};
const dialogueLog = [];
const context = {
  Image: ReadyImage,
  Game,
  performance: { now: () => 1000 },
  window: {
    triggerDialogue(speaker, lines, callback) {
      dialogueLog.push({ speaker, lines });
      callback?.();
    }
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

const objects = context.window.pharaohTombSceneObjects;
const throne = objects.find(object => object.id === 'tomb_throne');
const mirror = objects.find(object => object.id === 'tomb_mirror_0');
const altar = objects.find(object => object.id === 'tomb_sun_heart_altar');

assert.ok(throne, '第三場景應有中央王座護符互動點');
assert.ok(mirror, '第三場景應有三面鏡子的互動物件');
assert.ok(altar, '第三場景右側應有太陽之心祭壇互動點');
assert.strictEqual(mirror.isAvailable(), false, '護符尚未啟動前，銅鏡不可互動');

throne.onInteract();

assert.strictEqual(Game.progress.priestAmuletActivated, true, '護符放入王座後應被啟動');
assert.strictEqual(Game.progress.priestWarningRead, true, '護符啟動時應讀取祭司警告');
assert.strictEqual(Game.progress.mirrorsRevealed, true, '祭司留言結束後三面銅鏡應升起');
assert.strictEqual(Game.progress.sealedHeartAltarViewed, false, '銅鏡升起後不應強迫玩家觀看右側祭壇');
assert.strictEqual(mirror.isAvailable(), true, '銅鏡升起後應可互動');
assert.ok(dialogueLog.some(entry => entry.speaker === '祭司涅布的殘響'), '應播放祭司涅布的留言');

altar.onInteract();
assert.strictEqual(Game.progress.sealedHeartAltarViewed, true, '玩家調查右側祭壇後才記錄封印祭壇已查看');
assert.ok(dialogueLog.some(entry => entry.lines.some(line => line.includes('光線還沒有抵達'))), '解謎前調查祭壇應提示光路尚未完成');

mirror.onInteract();
assert.strictEqual(Game.mirrorState[0], 1, '按 E 旋轉銅鏡後應切換方向');
assert.strictEqual(mirror.promptVerb, '旋轉', '銅鏡提示應顯示旋轉而非調查');

assert.strictEqual(typeof context.window.submitTombMirrorPuzzle, 'function', '第三場景應提供光路答案判定');
Game.mirrorState = [0, 0, 0];
context.window.submitTombMirrorPuzzle();
assert.strictEqual(Game.progress.mirrorPuzzleSolved, false, '錯誤方向不可解除封印');
assert.strictEqual(Game.timer.remainingSeconds, 90, '錯誤提交應扣除 10 秒');

Game.mirrorState = [0, 1, 2];
assert.strictEqual(mirror.isAvailable(), false, '光路完整後銅鏡應暫停互動，讓中央王座可以被選取');
context.window.submitTombMirrorPuzzle();
assert.strictEqual(Game.progress.mirrorPuzzleSolved, true, '鏡一向左、鏡二直行、鏡三向右應解除封印');
assert.strictEqual(Game.progress.sunHeartAltarRevealed, false, '光路完成後應等待玩家前往右側祭壇');
altar.onInteract();
assert.strictEqual(Game.progress.sunHeartAltarRevealed, true, '玩家調查解封祭壇後才顯示太陽之心祭壇 CG');

assert.strictEqual(context.window.chooseSunHeart('take'), true, '應能選擇帶走太陽之心');
assert.strictEqual(Game.progress.sunHeartTaken, true, '帶走選擇應記錄太陽之心已被取下');
assert.strictEqual(Game.progress.tombEscapeActive, true, '帶走後應啟動左側石門逃生流程');
assert.strictEqual(context.window.finishTombEscape(), true, '抵達左側石門後應完成逃生');
assert.strictEqual(Game.progress.endingId, 'normal_taken_seal', '持有護符逃生應進入普通結局');

Game.progress.sunHeartTaken = null;
Game.progress.tombEscapeActive = false;
assert.strictEqual(context.window.chooseSunHeart('leave'), true, '應能選擇將太陽之心留在祭壇');
assert.strictEqual(Game.progress.sunHeartTaken, false, '留下選擇應保留太陽之心');
assert.strictEqual(Game.progress.endingId, 'true_guardian', '留下太陽之心應進入守護者真結局');

console.log('tomb amulet and mirror interaction flow test passed');
