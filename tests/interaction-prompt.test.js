const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/interaction.js', 'utf8');
const helperStart = source.indexOf('function formatInteractionPromptLabel');
const checkStart = source.indexOf('function checkInteractions()');
const exportStart = source.indexOf('window.checkInteractions = checkInteractions;', checkStart);

assert.notStrictEqual(checkStart, -1, '找不到 checkInteractions');
assert.notStrictEqual(exportStart, -1, '找不到 checkInteractions 的匯出位置');

const start = helperStart >= 0 ? helperStart : checkStart;
const codeUnderTest = source.slice(start, exportStart);

function renderPrompt(label) {
  const promptEl = {
    innerText: '',
    classList: { add() {}, remove() {} },
    style: {},
  };
  const player = { x: 100 };
  const Game = {
    inCutscene: false,
    state: 'PLAYING',
    sceneObjects: [{ x: 100, label }],
    currentInteractiveTarget: null,
  };
  const context = {
    document: { getElementById: () => promptEl },
    window: { player },
    player,
    Game,
  };

  vm.runInNewContext(`${codeUnderTest}\ncheckInteractions();`, context);
  return promptEl.innerText;
}

function selectOverlappingTarget() {
  const promptEl = {
    innerText: '',
    classList: { add() {}, remove() {} },
    style: {},
  };
  const player = { x: 100 };
  const Game = {
    inCutscene: false,
    state: 'PLAYING',
    sceneObjects: [
      { id: 'closest', x: 108, y: 300, height: 100, label: '較近物件' },
      { id: 'farther', x: 165, y: 300, height: 100, label: '較遠物件' },
    ],
    currentInteractiveTarget: null,
  };
  const context = {
    document: { getElementById: () => promptEl },
    window: { player },
    player,
    Game,
  };

  vm.runInNewContext(`${codeUnderTest}\ncheckInteractions();`, context);
  return Game.currentInteractiveTarget?.id;
}

function selectJudgementTarget(playerX) {
  const promptEl = {
    innerText: '',
    classList: { add() {}, remove() {} },
    style: {},
  };
  const player = { x: playerX };
  const Game = {
    inCutscene: false,
    state: 'PLAYING',
    sceneObjects: [
      {
        id: 'feather_scale_relief',
        x: 1008,
        interactionX: 900,
        interactionRadius: 55,
        y: 250,
        height: 200,
        label: '【死者接受審判的壁畫】'
      },
      { id: 'judgement_scale', x: 1008, y: 340, height: 260, label: '審判天秤' },
    ],
    currentInteractiveTarget: null,
  };
  const context = {
    document: { getElementById: () => promptEl },
    window: { player },
    player,
    Game,
  };

  vm.runInNewContext(`${codeUnderTest}\ncheckInteractions();`, context);
  return Game.currentInteractiveTarget?.id || null;
}

const cases = [
  ['黃金面具', 'E 調查 黃金面具'],
  ['真理羽毛', 'E 調查 真理羽毛'],
  ['石製心臟', 'E 調查 石製心臟'],
  ['寶石聖甲蟲', 'E 調查 寶石聖甲蟲'],
  ['【死者接受審判的壁畫】', 'E 調查 【死者接受審判的壁畫】'],
  ['📜 古代壁畫', 'E 調查 古代壁畫'],
];

for (const [label, expected] of cases) {
  const actual = renderPrompt(label);
  assert.strictEqual(actual, expected, `互動名稱錯誤：${label}`);
  assert.doesNotMatch(actual, /undefined/i);
}

assert.strictEqual(selectOverlappingTarget(), 'closest', '互動範圍重疊時應選擇距離玩家最近的物件');
assert.strictEqual(selectJudgementTarget(1008), 'judgement_scale', '站在天秤中央時不應被壁畫搶走調查');
assert.strictEqual(selectJudgementTarget(900), 'feather_scale_relief', '移到壁畫熱區時才應選到壁畫');

console.log('interaction prompt regression test passed');
