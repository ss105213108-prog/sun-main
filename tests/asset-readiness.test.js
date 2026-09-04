const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function extractFunction(source, name) {
  const candidates = [`async function ${name}(`, `function ${name}(`];
  const start = candidates
    .map(candidate => source.indexOf(candidate))
    .filter(index => index >= 0)
    .sort((a, b) => a - b)[0];
  assert.notStrictEqual(start, undefined, `找不到 ${name}`);

  const braceStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = braceStart; index < source.length; index++) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} 函式不完整`);
}

async function testMenuAppearsBeforeAssetLoading() {
  const puzzleSource = fs.readFileSync('js/puzzle.js', 'utf8');
  const initSource = extractFunction(puzzleSource, 'initApp');
  let resolvePreload;
  const preloadPromise = new Promise(resolve => { resolvePreload = resolve; });
  let startCalls = 0;
  let restartCalls = 0;
  let preloadCalls = 0;
  let menuOptions = null;

  const element = {
    getContext: () => ({}),
    addEventListener() {},
    classList: { add() {}, remove() {} }
  };
  const context = {
    Game: {},
    document: {
      getElementById: () => element,
      querySelectorAll: () => []
    },
    window: {
      addEventListener() {},
      handleKeyDown() {},
      handleKeyUp() {},
      advanceDialogue() {},
      hideGameLoadingOverlay() {},
      preloadGameAssets: () => {
        preloadCalls += 1;
        return preloadPromise;
      },
      setupMainMenu(options) { menuOptions = options; },
      startGame: () => { startCalls += 1; },
      reportRuntimeError(error) { throw error; }
    },
    initPuzzleInteractions() {},
    setupSlotCalibrationEvents() {},
    setupTestControls() {},
    restartGame() { restartCalls += 1; },
    submitPuzzle() {},
    closeModal() {},
    requestAnimationFrame() {},
    gameLoop() {}
  };

  vm.runInNewContext(initSource, context);
  await vm.runInNewContext('initApp()', context);
  assert.ok(menuOptions, '初始化完成後應先顯示遊戲主頁');
  assert.strictEqual(preloadCalls, 0, '玩家尚未選擇開始，卻已顯示遊戲載入流程');
  assert.strictEqual(startCalls, 0, '主頁顯示時不應直接開始劇情');

  const startResult = menuOptions.startNewGame();
  assert.strictEqual(preloadCalls, 1, '點擊開始遊戲後應開始載入素材');
  assert.strictEqual(restartCalls, 0, '素材尚未完成時不應進入遊戲');
  resolvePreload();
  await startResult;
  assert.strictEqual(restartCalls, 1, '素材完成後應啟動一次新遊戲');
}

function testCriticalAssetUrlsCanUseBrowserCache() {
  const files = ['js/scene.js', 'js/player.js', 'js/judgement.js', 'js/tomb.js'];
  const offenders = files.filter(file => /\.src\s*=.*Date\.now\(\)/.test(fs.readFileSync(file, 'utf8')));
  assert.deepStrictEqual(
    offenders,
    [],
    `關鍵圖片網址每次啟動都被強制改變，瀏覽器無法重用快取：${offenders.join(', ')}`
  );
}

async function testPreloaderLoadsAndDecodesCriticalAssets() {
  const requested = [];
  class FakeImage {
    constructor() {
      this.complete = false;
      this.naturalWidth = 0;
    }
    set src(value) {
      this._src = value;
      requested.push(value);
      queueMicrotask(() => {
        this.complete = true;
        this.naturalWidth = 100;
        this.onload?.();
      });
    }
    decode() { return Promise.resolve(); }
  }

  const loadingOverlay = { classList: { add() {}, remove() {} } };
  const loadingLabel = { textContent: '' };
  const loadingProgress = {
    style: {},
    parentElement: { setAttribute() {} }
  };
  const context = {
    Image: FakeImage,
    Promise,
    Map,
    Set,
    document: {
      getElementById(id) {
        if (id === 'loading-overlay') return loadingOverlay;
        if (id === 'loading-label') return loadingLabel;
        if (id === 'loading-progress') return loadingProgress;
        return null;
      }
    },
    window: {}
  };

  vm.runInNewContext(fs.readFileSync('js/preload.js', 'utf8'), context);
  await context.window.preloadGameAssets();
  assert.ok(requested.includes('assets/characters/aaron/走路動畫/0.2倍數.gif'));
  assert.ok(requested.includes('assets/backgrounds/wall_48_9.png'));
  assert.ok(requested.every(url => !url.includes('?v=')), '預載網址必須可被瀏覽器快取');
}

(async () => {
  await testMenuAppearsBeforeAssetLoading();
  testCriticalAssetUrlsCanUseBrowserCache();
  await testPreloaderLoadsAndDecodesCriticalAssets();
  console.log('asset readiness regression tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
