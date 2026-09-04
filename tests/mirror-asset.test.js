const assert = require('assert');
const fs = require('fs');

const mirrorPath = 'assets/道具/銅鏡.png';
const tombSource = fs.readFileSync('js/tomb.js', 'utf8');
const preloadSource = fs.readFileSync('js/preload.js', 'utf8');

assert.ok(fs.existsSync(mirrorPath), '第三場景銅鏡素材不存在');
assert.ok(preloadSource.includes(mirrorPath), '第三場景進場前必須預載銅鏡');
assert.ok(/mirrors:\s*\[([\s\S]*?\{[\s\S]*?\}){3}/.test(tombSource), '第三場景應預設放置三面銅鏡');
assert.ok(tombSource.includes("ctx.globalCompositeOperation = 'screen'"), '非透明原圖需以混合方式避免黑色矩形覆蓋場景');
assert.ok(tombSource.includes('drawTombMirrorBacking'), '銅鏡需先繪製實心輪廓底層，避免 screen 混合造成幻影感');
assert.ok(tombSource.includes("draggingProp = 'mirror'"), '銅鏡應可在第三場景調整工具中拖曳');

console.log('mirror placement asset test passed');
