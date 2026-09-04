const assert = require('assert');
const fs = require('fs');

const css = fs.readFileSync('css/style.css', 'utf8');

function readRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`));
  assert.ok(match, `找不到 ${selector} 樣式`);
  return match[1];
}

const actionsRule = readRule('.main-menu-actions');
const buttonRule = readRule('.main-menu-art-button');
const titleRule = readRule('.main-menu-title-art');
const actionWidth = Number(actionsRule.match(/width:\s*min\((\d+)px/)?.[1]);
assert.ok(actionWidth > 0, '無法取得主選單按鈕寬度');

const aspectMatch = buttonRule.match(/aspect-ratio:\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
const heightMatch = buttonRule.match(/height:\s*(\d+(?:\.\d+)?)px/);
const buttonHeight = aspectMatch
  ? actionWidth / (Number(aspectMatch[1]) / Number(aspectMatch[2]))
  : Number(heightMatch?.[1]);

const sourceImageHeight = actionWidth / (2172 / 724);
assert.ok(
  buttonHeight >= sourceImageHeight - 0.5,
  `按鈕容器高 ${buttonHeight}px，小於圖片顯示高度 ${sourceImageHeight.toFixed(1)}px，裝飾會與相鄰按鈕重疊`
);

const titleWidth = Number(titleRule.match(/width:\s*min\((\d+)px/)?.[1]);
const titleHeight = titleWidth / (1672 / 941);
const actionGap = Number(actionsRule.match(/gap:\s*(\d+(?:\.\d+)?)px/)?.[1] || 0);
const saveStatusHeight = 16;
const panelChrome = 40;
const estimatedPanelHeight = titleHeight + (buttonHeight * 4) + (actionGap * 3) + saveStatusHeight + panelChrome;
assert.ok(
  estimatedPanelHeight <= 560,
  `主選單內容估計高 ${estimatedPanelHeight.toFixed(1)}px，超過 560px 的安全高度，底部按鈕會被裁切`
);

console.log('main menu artwork spacing test passed');
