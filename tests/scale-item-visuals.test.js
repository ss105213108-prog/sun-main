const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/judgement.js', 'utf8');

assert.match(
  source,
  /Game\.scaleState\s*=\s*\{\s*left:\s*['"]stone_heart['"],\s*right:\s*['"]truth_feather['"]\s*\}/,
  '解謎成功後應保留左盤心臟、右盤羽毛'
);
assert.match(
  source,
  /drawScaleItemOnRenderedPan\(ctx, obj, leftItem, ['"]left['"]\)/,
  '實體天秤左盤應繪製物品圖片'
);
assert.match(
  source,
  /drawScaleItemOnRenderedPan\(ctx, obj, rightItem, ['"]right['"]\)/,
  '實體天秤右盤應繪製物品圖片'
);
assert.match(source, /judgementTrialItemImages\[itemId\]/, '應使用現有道具圖片');

console.log('scale item visual regression tests passed');
