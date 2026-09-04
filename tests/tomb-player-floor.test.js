const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

class ReadyImage {
  constructor() {
    this.complete = true;
    this.naturalWidth = 1910;
    this.naturalHeight = 829;
  }
  set src(value) { this._src = value; }
}

const player = { x: 180, y: 432, direction: 1 };
const Game = {
  height: 540,
  worldWidth: 2000,
  progress: {},
  mirrorState: [0, 0, 0]
};
const gradient = { addColorStop() {} };
const ctx = {
  fillStyle: '',
  fillRect() {},
  drawImage() {},
  createRadialGradient: () => gradient
};
const context = {
  Image: ReadyImage,
  Game,
  player,
  window: { player },
  document: { getElementById: () => null },
  Date,
  setTimeout: () => 1,
  clearTimeout() {}
};

vm.runInNewContext(fs.readFileSync('js/tomb.js', 'utf8'), context);
context.window.drawPharaohTombBackground(ctx);

assert.strictEqual(
  player.y,
  500,
  '第三場景人物腳底應落在新背景的前景石地板，而不是王座台階'
);

console.log('tomb player floor alignment test passed');
