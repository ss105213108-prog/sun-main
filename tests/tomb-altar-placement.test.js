const assert = require('assert');
const fs = require('fs');

const altarPath = 'assets/道具/祭壇愛心.png';
const emptyAltarPath = 'assets/道具/愛心祭壇沒有愛心.png';
const releasedHeartPath = 'assets/道具/解封印的愛心.png';
const tombSource = fs.readFileSync('js/tomb.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const preloadSource = fs.readFileSync('js/preload.js', 'utf8');
const puzzleSource = fs.readFileSync('js/puzzle.js', 'utf8');

assert.ok(fs.existsSync(altarPath), '太陽之心祭壇素材不存在');
assert.ok(fs.existsSync(emptyAltarPath), '解除封印後的空祭壇素材不存在');
assert.ok(fs.existsSync(releasedHeartPath), '解除封印的太陽之心素材不存在');
assert.ok(preloadSource.includes(altarPath), '第三場景進場前必須預載太陽之心祭壇');
assert.ok(preloadSource.includes(emptyAltarPath), '第三場景進場前必須預載空祭壇');
assert.match(tombSource, /sunHeartAltar:\s*\{\s*x:\s*1700,\s*y:\s*500,\s*width:\s*380\s*\}/, '祭壇應預設放在第三場景右側空位');
assert.match(tombSource, /tombSunHeartAltarImage\.src\s*=\s*'assets\/道具\/祭壇愛心\.png'/);
assert.match(tombSource, /getTombSunHeartAltarBounds/, '祭壇應維持圖片比例計算邊界');
assert.match(tombSource, /globalCompositeOperation\s*=\s*'screen'/, '深色素材必須避免矩形背景覆蓋墓室');
assert.match(tombSource, /localStorage\.setItem\(PROPS_STORAGE_KEY/, '祭壇位置必須沿用第三場景設定保存');
assert.doesNotMatch(tombSource, /setupTombAltarEditor/, '位置確認後必須移除祭壇臨時調整程式');
assert.doesNotMatch(html, /id="tomb-altar-editor-toggle"/, '位置確認後必須移除祭壇臨時調整入口');
assert.doesNotMatch(html, /id="tomb-altar-editor-toolbar"/, '位置確認後必須移除祭壇臨時調整面板');
assert.match(tombSource, /id:\s*'tomb_sun_heart_altar'/, '右側祭壇必須成為正式互動物件');
assert.match(tombSource, /onInteract:\s*inspectSunHeartAltar/, '玩家必須能在右側祭壇觸發封印與最終選擇流程');
assert.match(tombSource, /tombEmptySunHeartAltarImage/, '取走太陽之心後場景應切換成空祭壇素材');
assert.doesNotMatch(tombSource, /tombReleasedSunHeartImage/, '封印祭壇上不應再疊加另一顆太陽之心');
assert.match(
  tombSource,
  /const altarImage = Game\.progress\.sunHeartTaken === true\s*\? tombEmptySunHeartAltarImage\s*:\s*tombSunHeartAltarImage/,
  '只有玩家真正取走太陽之心後，祭壇才能切換成空祭壇'
);
assert.doesNotMatch(
  tombSource,
  /Game\.progress\.mirrorPuzzleSolved \|\| Game\.progress\.sunHeartTaken !== null\s*\? tombEmptySunHeartAltarImage/,
  '僅完成銅鏡解謎時，祭壇仍應保持有太陽之心的封印外觀'
);
assert.match(puzzleSource, /window\.DEVELOPMENT_START_SCENE = null/, '正式測試時應解除第三場景直達鎖定');
assert.match(puzzleSource, /async function enterThirdSceneForDevelopment\(\)/);
assert.match(puzzleSource, /await enterThirdSceneForDevelopment\(\)/, '測試工具仍應保留第三場景快速入口');

console.log('tomb sun-heart altar placement test passed');
