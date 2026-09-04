const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const windowStub = {};
const context = {
  window: windowStub,
  globalThis: windowStub,
  document: { getElementById: () => null }
};

vm.runInNewContext(fs.readFileSync('js/objective.js', 'utf8'), context);

const objectiveFor = (currentScene, progress) => {
  const game = { currentScene, progress };
  return context.window.getCurrentObjectiveText(game);
};

assert.strictEqual(
  objectiveFor('sun_temple', { investigatedMural: false }),
  '調查神殿壁畫，尋找試煉線索'
);
assert.strictEqual(
  objectiveFor('sun_temple', {
    investigatedMural: true,
    torchTaken: true,
    investigatedTablet: true,
    puzzleCleared: true,
    sunBadgeTaken: true
  }),
  '將太陽徽章放上右側石門'
);
assert.strictEqual(
  objectiveFor('judgement_chamber', {
    judgementMuralRead: false,
    scaleCompartmentOpened: false,
    collectedTrialItems: {}
  }),
  '探索審判室，尋找天秤試煉的線索'
);
assert.strictEqual(
  objectiveFor('judgement_chamber', {
    judgementMuralRead: false,
    scalePuzzleIntroduced: true,
    scaleCompartmentOpened: false,
    collectedTrialItems: { golden_mask: true }
  }),
  '探索四座祭壇，準備天秤審判'
);
assert.strictEqual(
  objectiveFor('judgement_chamber', {
    judgementMuralRead: true,
    scaleCompartmentOpened: true,
    collectedTrialItems: { golden_mask: true, truth_feather: true }
  }),
  '探索四座祭壇，準備天秤審判'
);
assert.strictEqual(
  objectiveFor('pharaoh_tomb', {
    priestAmuletActivated: true,
    mirrorPuzzleSolved: false
  }),
  '旋轉三面銅鏡，讓光線回到王座'
);
assert.strictEqual(
  objectiveFor('pharaoh_tomb', {
    priestAmuletActivated: true,
    mirrorPuzzleSolved: true,
    sunHeartTaken: null
  }),
  '前往右側祭壇，決定太陽之心的去留'
);
assert.strictEqual(
  objectiveFor('pharaoh_tomb', {
    priestAmuletActivated: true,
    mirrorPuzzleSolved: true,
    sunHeartTaken: true,
    tombEscapeActive: true
  }),
  '返回最左側石門，逃離墓室'
);

console.log('current objective flow test passed');
