/**
 * 《太陽之心：法老的試煉》
 * 模組：js/puzzle.js
 * 負責：石板排序拼圖、背包道具載入、重置、遊戲渲染/物理循環、以及應用程式總初始化
 */

// 石板槽位狀態 (第四座祭壇預設安放神聖河川石板)
const slatesOrder = {
  'slot-0': null,
  'slot-1': null,
  'slot-2': null,
  'slot-3': '尼羅河'
};
window.slatesOrder = slatesOrder;

// 祭壇畫面使用中文識別字，背包使用物品 ID；所有放置與取回統一透過此映射同步。
const slateInventoryIds = {
  '太陽': 'slate_sun',
  '鷹': 'slate_bird',
  '生命': 'slate_life',
  '甲蟲': 'slate_life',
  '尼羅河': 'slate_river',
  '河川': 'slate_river'
};

function removeSlateFromInventory(slateId) {
  const inventoryId = slateInventoryIds[slateId];
  if (!inventoryId) return;
  const itemIndex = Game.inventory.indexOf(inventoryId);
  if (itemIndex >= 0) Game.inventory.splice(itemIndex, 1);
}

function returnSlateToInventory(slateId) {
  const inventoryId = slateInventoryIds[slateId];
  if (inventoryId && !Game.inventory.includes(inventoryId)) {
    Game.inventory.push(inventoryId);
  }
}

// 背包道具詳情資料庫 (整合四塊神聖石板與太陽徽章)
const itemDatabase = {
  'torch': {
    name: '🔥 長明火把',
    image: 'assets/items/torch.png',
    description: '從神殿壁座取下的長明火把。火焰不受風影響，能照亮亞倫周圍的黑暗。'
  },
  'slate_sun': {
    name: '☀️ 太陽石板',
    image: 'assets/items/slate_sun.png',
    description: '雕刻著古埃及神聖太陽神之眼的石板，散發著微溫的光芒，象徵萬物之始與晨曦。'
  },
  'slate_bird': {
    name: '🦅 聖鷹石板',
    image: 'assets/items/slate_bird.png',
    description: '雕刻著翱翔聖鷹（荷魯斯）圖騰的神聖石板，象徵守護與無垠天空。'
  },
  'slate_life': {
    name: '𓋹 生命石板',
    image: 'assets/items/slate_life.png',
    description: '雕刻著生命之符與聖甲蟲印記的石板，象徵復活、新生與大地生機。'
  },
  'slate_river': {
    name: '🌊 河川石板',
    image: 'assets/items/slate_river.png',
    description: '雕刻著蜿蜒尼羅河與金字塔倒影的石板，象徵滋養萬物的生命之泉與最終歸宿。'
  },
  'sun_badge': {
    name: '🌞 太陽徽章',
    image: 'assets/道具/太陽徽章.png',
    description: '刻著太陽神拉之眼的精緻黃金徽章。徽章沉甸甸的，背後寫著：『太陽照亮密道，指引歸人。』它可以用來開啟墓室最右側的黃金密門。'
  },
  'gold_mask': {
    name: '黃金面具',
    image: 'assets/道具/面具.png',
    description: '工藝華麗的黃金面具，象徵財富與地位。它看似珍貴，卻未必能代表靈魂的價值。'
  },
  'truth_feather': {
    name: '真理羽毛',
    image: 'assets/道具/羽毛.png',
    description: '象徵瑪亞特女神真理與秩序的羽毛。輕盈，卻是亡者審判中不可取代的標準。'
  },
  'stone_heart': {
    name: '石製心臟',
    image: 'assets/道具/石頭心臟.png',
    description: '以深紅石材雕成的心臟，代表亡者的靈魂、記憶與一生所作的選擇。'
  },
  'jewel_scarab': {
    name: '寶石聖甲蟲',
    image: 'assets/道具/聖甲蟲.png',
    description: '鑲滿寶石的聖甲蟲護飾，閃耀得近乎誘人；在審判前，它或許只是另一種貪婪。'
  },
  'priest_amulet': {
    name: '祭司護符',
    image: 'assets/道具/護符.png',
    description: '守墓祭司涅布留下的護符。石板紀錄稱，它能讓持有者穿越太陽之心引發的崩塌通道。'
  }
};

// --- 背包系統操作 ---
function openInventory() {
  audio.play('click');
  Game.state = 'BAG';
  document.getElementById('inventory-overlay').classList.remove('hidden');
  renderInventory();
}

function renderInventory() {
  const grid = document.getElementById('inventory-grid');
  grid.innerHTML = '';

  // 第二場景會增加多件試煉物品，背包至少保留 12 格。
  for (let i = 0; i < Math.max(12, Game.inventory.length); i++) {
    const slot = document.createElement('div');
    slot.className = 'inventory-slot';

    const item = Game.inventory[i];
    if (item && itemDatabase[item]) {
      const db = itemDatabase[item];
      if (db.image) {
        const img = document.createElement('img');
        img.src = db.image;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        slot.appendChild(img);
      } else {
        const symbol = document.createElement('span');
        symbol.className = 'inventory-item-symbol';
        symbol.textContent = db.icon || '◆';
        slot.appendChild(symbol);
      }

      slot.addEventListener('click', () => {
        audio.play('click');
        document.querySelectorAll('.inventory-slot').forEach(s => s.classList.remove('selected'));
        slot.classList.add('selected');
        
        document.getElementById('item-description-box').innerHTML = `
          <p class="desc-title" style="color: #d4af37; font-weight: bold;">${db.name}</p>
          <p class="desc-body" style="font-size: 0.85rem; line-height: 1.5; color: #cbb493;">${db.description}</p>
        `;
      });
    }
    grid.appendChild(slot);
  }
}

// --- 謎題介面操作 ---
function openPuzzle() {
  audio.play('click');
  Game.state = 'PUZZLE';
  document.getElementById('puzzle-overlay').classList.remove('hidden');
  updateTimerDisplay();
  const feedback = document.getElementById('puzzle-feedback');
  if (feedback) {
    feedback.textContent = '';
    feedback.classList.remove('show');
  }

  const draggables = document.querySelectorAll('.draggable-slate');

  draggables.forEach(slate => {
    const slateId = slate.dataset.slateId;
    let hasItem = false;
    if (slateId === '太陽' && Game.inventory.includes('slate_sun')) hasItem = true;
    else if (slateId === '鷹' && Game.inventory.includes('slate_bird')) hasItem = true;
    else if (slateId === '生命' && Game.inventory.includes('slate_life')) hasItem = true;
    else if (slateId === '尼羅河' && Game.inventory.includes('slate_river')) hasItem = true;

    if (!hasItem) {
      slate.style.display = 'none';
    } else {
      // 只有尚未放置在祭壇槽位上的石板才會在側邊欄顯示
      const isAlreadyPlaced = Object.values(slatesOrder).includes(slateId);
      slate.style.display = isAlreadyPlaced ? 'none' : 'flex';
    }
  });
}

let puzzleFeedbackTimer = null;

function triggerPuzzleRockfallPenalty() {
  const layer = document.getElementById('puzzle-rockfall-layer');
  const modal = document.querySelector('.topdown-puzzle-modal');
  const feedback = document.getElementById('puzzle-feedback');

  audio.play('rumble');
  if (window.triggerScreenShake) window.triggerScreenShake(6, 650);

  if (modal) {
    modal.classList.remove('penalty-shake');
    void modal.offsetWidth;
    modal.classList.add('penalty-shake');
    setTimeout(() => modal.classList.remove('penalty-shake'), 650);
  }

  if (layer) {
    layer.innerHTML = '';
    for (let i = 0; i < 11; i++) {
      const rock = document.createElement('span');
      const size = 18 + Math.random() * 28;
      rock.className = 'puzzle-falling-rock';
      rock.style.left = `${5 + Math.random() * 90}%`;
      rock.style.width = `${size}px`;
      rock.style.height = `${size * (0.72 + Math.random() * 0.22)}px`;
      rock.style.animationDelay = `${Math.random() * 0.22}s`;
      rock.style.setProperty('--rock-duration', `${0.72 + Math.random() * 0.42}s`);
      rock.style.setProperty('--rock-drift', `${-35 + Math.random() * 70}px`);
      rock.style.setProperty('--rock-spin', `${180 + Math.random() * 420}deg`);
      layer.appendChild(rock);
    }
    setTimeout(() => { layer.innerHTML = ''; }, 1450);
  }

  if (feedback) {
    feedback.textContent = '⚠️ 順序錯誤，古墓開始崩落！';
    feedback.classList.add('show');
    if (puzzleFeedbackTimer) clearTimeout(puzzleFeedbackTimer);
    puzzleFeedbackTimer = setTimeout(() => feedback.classList.remove('show'), 2200);
  }
}

// 初始化謎題拖放與點擊快速放置雙軌制
function initPuzzleInteractions() {
  const draggables = document.querySelectorAll('.draggable-slate');
  const slots = document.querySelectorAll('.topdown-slot, .slate-slot');

  // 1. 側邊欄拖曳機制
  draggables.forEach(slate => {
    slate.addEventListener('dragstart', (e) => {
      slate.classList.add('dragging');
      const payload = JSON.stringify({ slateId: slate.dataset.slateId, fromSlot: -1 });
      e.dataTransfer.setData('application/json', payload);
      e.dataTransfer.setData('text/plain', slate.dataset.slateId);
    });

    slate.addEventListener('dragend', () => {
      slate.classList.remove('dragging');
    });

    // 點擊快速放置（尋找第一個空槽）
    slate.addEventListener('click', () => {
      audio.play('click');
      for (let i = 0; i < 4; i++) {
        const slotKey = `slot-${i}`;
        if (!slatesOrder[slotKey]) {
          placeSlate(slate.dataset.slateId, i);
          slate.style.display = 'none';
          break;
        }
      }
    });
  });

  // 2. 槽位拖放與互換機制 (Drop & Swap)
  slots.forEach(slot => {
    slot.addEventListener('dragover', (e) => {
      e.preventDefault();
      const placedSlate = slot.querySelector('.placed-slate');
      if (placedSlate) placedSlate.classList.add('drag-hover');
    });

    slot.addEventListener('dragleave', () => {
      const placedSlate = slot.querySelector('.placed-slate');
      if (placedSlate) placedSlate.classList.remove('drag-hover');
    });

    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      const placedSlate = slot.querySelector('.placed-slate');
      if (placedSlate) placedSlate.classList.remove('drag-hover');

      const targetSlotIndex = parseInt(slot.dataset.slot, 10);
      if (isSlotLocked(targetSlotIndex)) {
        showLockedSlateFeedback();
        return;
      }

      let slateId = '';
      let fromSlot = -1;

      try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        slateId = data.slateId;
        fromSlot = data.fromSlot;
      } catch (err) {
        slateId = e.dataTransfer.getData('text/plain');
      }

      if (!slateId) return;
      if (fromSlot >= 0 && isSlotLocked(fromSlot)) {
        showLockedSlateFeedback();
        return;
      }
      const targetKey = `slot-${targetSlotIndex}`;
      const existingSlateOnTarget = slatesOrder[targetKey];

      // 情況 A：從另一個槽位拖過來 (來自 fromSlot)
      if (fromSlot >= 0 && fromSlot !== targetSlotIndex) {
        const fromKey = `slot-${fromSlot}`;
        if (existingSlateOnTarget) {
          // 互換 (SWAP)
          placeSlate(existingSlateOnTarget, fromSlot);
          placeSlate(slateId, targetSlotIndex);
        } else {
          // 純移動
          clearSlot(fromSlot);
          placeSlate(slateId, targetSlotIndex);
        }
        return;
      }

      // 情況 B：從側邊欄拖過來
      if (existingSlateOnTarget) {
        returnSlateToPool(existingSlateOnTarget);
      }

      // 檢查此石板是否已在其他槽位，若是則清空原槽位以防重複
      for (let i = 0; i < 4; i++) {
        if (i !== targetSlotIndex && slatesOrder[`slot-${i}`] === slateId) {
          clearSlot(i);
        }
      }

      placeSlate(slateId, targetSlotIndex);

      // 隱藏側邊欄該石板
      const original = document.querySelector(`.draggable-slate[data-slate-id="${slateId}"]`);
      if (original) original.style.display = 'none';
    });
  });

  // 第四座祭壇預設安放神聖河川石板
  placeSlate('尼羅河', 3, true);
}

function isSlotLocked(slotIndex) {
  const token = document.querySelector(`#slot-${slotIndex} .slate-token`);
  return token?.dataset.locked === 'true';
}

function showLockedSlateFeedback() {
  const feedback = document.getElementById('puzzle-feedback');
  audio.play('click');
  if (!feedback) return;
  feedback.textContent = '🔒 河川石板已固定在第四座祭壇，無法取下或替換。';
  feedback.classList.add('show');
  if (puzzleFeedbackTimer) clearTimeout(puzzleFeedbackTimer);
  puzzleFeedbackTimer = setTimeout(() => feedback.classList.remove('show'), 2200);
}

function clearSlot(slotIndex) {
  if (isSlotLocked(slotIndex)) return false;
  const slotKey = `slot-${slotIndex}`;
  slatesOrder[slotKey] = null;
  const slotEl = document.getElementById(slotKey);
  if (slotEl) slotEl.innerHTML = '';
  return true;
}

function placeSlate(slateId, slotIndex, isLocked = false) {
  if (!isLocked) audio.play('click');
  const slotKey = `slot-${slotIndex}`;
  slatesOrder[slotKey] = slateId;
  if (!isLocked) removeSlateFromInventory(slateId);

  // 判斷當前槽位放的是否為正確的石板
  let isSlotCorrect = false;
  if (slotIndex === 0 && slateId === '太陽') isSlotCorrect = true;
  else if (slotIndex === 1 && slateId === '鷹') isSlotCorrect = true;
  else if (slotIndex === 2 && (slateId === '生命' || slateId === '甲蟲')) isSlotCorrect = true;
  else if (slotIndex === 3 && (slateId === '尼羅河' || slateId === '河川')) isSlotCorrect = true;

  // 渲染槽位內部
  const slotEl = document.getElementById(`slot-${slotIndex}`);
  let imgSrc = 'assets/items/slate_sun.png';
  let label = '太陽';
  if (slateId === '鷹') { imgSrc = 'assets/items/slate_bird.png'; label = '聖鷹'; }
  else if (slateId === '生命' || slateId === '甲蟲') { imgSrc = 'assets/items/slate_life.png'; label = '生命'; }
  else if (slateId === '尼羅河') { imgSrc = 'assets/items/slate_river.png'; label = '河川'; }

  const glowClass = isSlotCorrect ? 'correct-glow-token' : '';

  slotEl.innerHTML = `
    <div class="slate-token ${glowClass} ${isLocked ? 'locked-slate' : ''}" draggable="${!isLocked}" data-locked="${isLocked}" title="${isLocked ? '河川石板已固定在第四座祭壇' : '點擊可取回石板'}" style="
      cursor: ${isLocked ? 'default' : 'grab'};
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      background: transparent;
      border: none;
      box-shadow: none;
      transition: all 0.3s ease;
    ">
      <img src="${imgSrc}" style="
        width: 100%;
        height: 100%;
        object-fit: contain;
        ${isSlotCorrect ? 'filter: drop-shadow(0 0 16px rgba(255, 225, 100, 1)) drop-shadow(0 0 28px rgba(255, 215, 0, 0.75));' : 'filter: drop-shadow(0 4px 8px rgba(0,0,0,0.85));'}
      " alt="${label}">
    </div>
  `;

  if (isSlotCorrect && !isLocked) {
    audio.play('correct');
  }

  const token = slotEl.querySelector('.slate-token');

  // 讓已放置的石板也能被按住拖曳至另一個槽位實現互換 (Drag-to-Swap)
  token.addEventListener('dragstart', (e) => {
    if (isLocked) {
      e.preventDefault();
      showLockedSlateFeedback();
      return;
    }
    token.classList.add('dragging');
    const payload = JSON.stringify({ slateId, fromSlot: slotIndex });
    e.dataTransfer.setData('application/json', payload);
    e.dataTransfer.setData('text/plain', slateId);
  });

  token.addEventListener('dragend', () => {
    token.classList.remove('dragging');
  });

  // 點擊槽位可收回側邊欄
  token.addEventListener('click', () => {
    if (isLocked) {
      showLockedSlateFeedback();
      return;
    }
    audio.play('click');
    returnSlateToPool(slateId);
    clearSlot(slotIndex);
  });
}

function returnSlateToPool(slateId) {
  returnSlateToInventory(slateId);
  const original = document.querySelector(`.draggable-slate[data-slate-id="${slateId}"]`);
  if (original) original.style.display = 'flex';
}

// 祭壇凹槽配置載入與套用
function setupSlotCalibrationEvents() {
  const defaultSlots = [
    { left: 7.5, top: 29.5, width: 16.5, height: 46 },
    { left: 31.0, top: 29.5, width: 16.5, height: 46 },
    { left: 54.5, top: 29.5, width: 16.5, height: 46 },
    { left: 78.0, top: 29.5, width: 16.5, height: 46 }
  ];

  let currentSlots = JSON.parse(JSON.stringify(defaultSlots));

  try {
    const saved = localStorage.getItem('customTopdownSlotsList');
    if (saved) currentSlots = JSON.parse(saved);
  } catch (e) {}

  const slots = document.querySelectorAll('.topdown-slot');
  slots.forEach((s, idx) => {
    const cfg = currentSlots[idx] || defaultSlots[idx];
    s.style.left = cfg.left + '%';
    s.style.top = cfg.top + '%';
    s.style.width = cfg.width + '%';
    s.style.height = cfg.height + '%';
  });
}

// 驗證提交結果
function submitPuzzle() {
  // 正確順序：1. 太陽 ☀️ ➔ 2. 聖鷹 🦅 ➔ 3. 生命 𓋹/甲蟲 ➔ 4. 尼羅河/河川 🌊
  const isCorrect = 
    slatesOrder['slot-0'] === '太陽' &&
    slatesOrder['slot-1'] === '鷹' &&
    (slatesOrder['slot-2'] === '生命' || slatesOrder['slot-2'] === '甲蟲') &&
    (slatesOrder['slot-3'] === '尼羅河' || slatesOrder['slot-3'] === '河川');

  if (isCorrect) {
    audio.play('correct');
    audio.play('rumble');
    
    Game.progress.puzzleCleared = true;
    Game.progress.doorOpened = false;
    Game.progress.awakeningStartedAt = performance.now();
    Game.progress.sunBadgeRevealed = true;
    Game.progress.sunBadgeTaken = false;

    // 溫和雅緻的微光粒子 (適中亮度，不刺眼)
    spawnGoldParticles(1900, 380, 16);

    closeModal();
    window.triggerDialogue('古墓的低語', [
      '「第一試煉完成。你看見了文字，也理解了順序。」',
      '「四座祭壇的太陽印記同時亮起，拉神石像在轟鳴中甦醒。」'
    ], () => {
      window.triggerDialogue('亞倫・卡特', [
        '「等等，石像底部傳來了石板滑動的聲音……」',
        '「底部的暗格打開了，裡面有一枚徽章！」',
        '「那可能就是開啟右側石門的鑰匙，去把它取出來看看。」'
      ]);
    });
  } else {
    audio.play('incorrect');
    triggerPuzzleRockfallPenalty();
  }
}

// 金色粒子發射器
function spawnGoldParticles(x, y, count) {
  for (let i = 0; i < count; i++) {
    Game.particles.push({
      x: x + (Math.random() * 100 - 50),
      y: y + (Math.random() * 40 - 20),
      vx: Math.random() * 3 - 1.5,
      vy: -(Math.random() * 4 + 1.5),
      size: Math.random() * 4 + 2,
      color: Math.random() > 0.3 ? '#ffd700' : '#fffbcf',
      alpha: 1.0
    });
  }
}

// 重置遊戲
function resetSunTemplePuzzleToEntrance() {
  for (let i = 0; i < 3; i++) {
    const slotKey = `slot-${i}`;
    slatesOrder[slotKey] = null;
    const slot = document.getElementById(slotKey);
    if (slot) slot.innerHTML = '';
  }
  placeSlate('尼羅河', 3, true);

  document.querySelectorAll('.draggable-slate').forEach(slate => {
    slate.style.display = 'flex';
  });
}
window.resetSunTemplePuzzleToEntrance = resetSunTemplePuzzleToEntrance;

function restartGame() {
  audio.play('click');
  if (window.clearGameCheckpoint) window.clearGameCheckpoint();
  document.getElementById('death-overlay')?.classList.add('hidden');

  // 重置關卡進度與背包
  Game.progress.investigatedMural = false;
  Game.progress.investigatedTablet = false;
  Game.progress.puzzleCleared = false;
  Game.progress.torchTaken = false;
  Game.progress.doorOpened = false;
  Game.progress.awakeningStartedAt = 0;
  Game.progress.sunBadgeRevealed = false;
  Game.progress.sunBadgeTaken = false;
  Game.progress.sunBadgePlaced = false;
  Game.progress.scene2Entered = false;
  Game.progress.judgementMuralRead = false;
  Game.progress.scaleCompartmentOpened = false;
  Game.progress.scaleCompartmentSealed = false;
  Game.progress.scalePuzzleIntroduced = false;
  Game.progress.priestAmuletFound = false;
  Game.progress.scaleCleared = false;
  Game.progress.scaleMistakes = 0;
  Game.progress.collectedTrialItems = {};
  Game.progress.scene3Entered = false;
  Game.progress.tombMechanismActivated = false;
  Game.progress.priestAmuletActivated = false;
  Game.progress.priestWarningRead = false;
  Game.progress.mirrorsRevealed = false;
  Game.progress.mirrorRiseStartedAt = 0;
  Game.progress.mirrorMistakes = 0;
  Game.progress.mirrorPuzzleSolved = false;
  Game.progress.sealedHeartAltarViewed = false;
  Game.progress.sunHeartAltarRevealed = false;
  Game.progress.tombEscapeActive = false;
  Game.progress.sunHeartTaken = null;
  Game.progress.endingId = null;
  Game.currentScene = 'sun_temple';
  Game.scaleState = { left: null, right: null };
  Game.mirrorState = [0, 0, 0];
  Game.sceneObjects = window.sunTempleSceneObjects || Game.sceneObjects;
  Game.inventory = [];
  Game.selectedItem = null;

  // 正式模式重置為 15 分鐘；測試模式重置為 30 秒。
  Game.timer.remainingSeconds = Game.testMode ? 30 : 15 * 60;
  Game.timer.isRunning = false;
  Game.timer.lastTick = 0;
  updateTimerDisplay();
  const timerEl = document.getElementById('countdown-timer');
  if (timerEl) timerEl.classList.add('hidden');
  // 重置落石與震動狀態
  Game.entranceBlocked = false;
  Game.rockslideStartedAt = 0;
  Game.rockslideSettledAt = 0;
  Game.fallingRocks = [];
  Game.dustParticles = [];
  Game.screenShake.duration = 0;
  Game.screenShake.offsetX = 0;
  Game.screenShake.offsetY = 0;

  // 重置石板槽位與備選池 (第四座祭壇恢復安放河川石板)
  resetSunTemplePuzzleToEntrance();

  closeModal();
  document.getElementById('dialogue-panel').classList.add('hidden');

  // 重新啟動 9.1 開場電影級過場動畫
  window.startGame();
}

// 暴露給全域
window.openPuzzle = openPuzzle;
window.closeModal = closeModal;
window.restartGame = restartGame;

// --- 5. 遊戲主循環與核心更新 ---
function update(timestamp) {
  // 1. 物理位置與相機更新
  window.updatePlayer(timestamp);

  // 2. 粒子系統更新
  for (let i = Game.particles.length - 1; i >= 0; i--) {
    const p = Game.particles[i];
    p.y += p.vy;
    p.x += p.vx;
    p.alpha -= 0.01;
    p.size = Math.max(0.1, p.size - 0.05);
    if (p.alpha <= 0 || p.size <= 0) {
      Game.particles.splice(i, 1);
    }
  }

  // 3. 更新開場巨石崩塌物理與漫天沙塵
  if (window.updateFallingRocksAndDust) {
    window.updateFallingRocksAndDust();
  }

  // 4. 15 分鐘古墓封印倒數計時器更新
  if (Game.timer && Game.timer.isRunning) {
    const now = performance.now();
    if (!Game.timer.lastTick) Game.timer.lastTick = now;
    const deltaSec = (now - Game.timer.lastTick) / 1000;
    Game.timer.lastTick = now;

    if (Game.timer.remainingSeconds <= 0) {
      Game.timer.isRunning = false;
      triggerTimeUpGameOver();
    } else if (!Game.timer.pausedForDevelopment) {
      Game.timer.remainingSeconds -= deltaSec;
      if (Game.timer.remainingSeconds < 0) Game.timer.remainingSeconds = 0;
      updateTimerDisplay();
    }
  }

  // 5. 接近檢測
  window.checkInteractions();

  if (window.updateCurrentObjective) window.updateCurrentObjective();
}

function updateTimerDisplay() {
  const timerEl = document.getElementById('countdown-timer');
  const puzzleTimerEl = document.getElementById('puzzle-countdown-timer');
  const scaleTimerEl = document.getElementById('scale-countdown-timer');
  if (!timerEl && !puzzleTimerEl && !scaleTimerEl) return;
  const totalSec = Math.ceil(Game.timer.remainingSeconds);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const modeLabels = [];
  if (Game.testMode) modeLabels.push('測試');
  if (Game.timer.pausedForDevelopment) modeLabels.push('開發暫停');
  const modeLabel = modeLabels.length ? `（${modeLabels.join('・')}）` : '';
  const timerText = `⏳ 封印倒數${modeLabel} ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  [timerEl, puzzleTimerEl, scaleTimerEl].filter(Boolean).forEach(element => {
    element.innerText = timerText;
    element.classList.toggle('warning', totalSec <= 180);
  });
}
window.updateTimerDisplay = updateTimerDisplay;

// 正式流程由主頁與序章開始；需要局部測試時仍可使用 ?test=1 的測試工具。
window.DEVELOPMENT_START_SCENE = null;

async function enterThirdSceneForDevelopment() {
  if (window.clearGameCheckpoint) window.clearGameCheckpoint();
  document.getElementById('main-menu-overlay')?.classList.add('hidden');
  document.getElementById('prologue-overlay')?.classList.add('hidden');
  document.getElementById('death-overlay')?.classList.add('hidden');
  document.getElementById('tomb-ending-overlay')?.classList.add('hidden');
  document.getElementById('dialogue-panel')?.classList.add('hidden');

  Game.inCutscene = false;
  Game.state = 'PLAYING';
  Game.currentScene = 'sun_temple';
  Game.progress.puzzleCleared = true;
  Game.progress.doorOpened = true;
  Game.progress.sunBadgeRevealed = true;
  Game.progress.sunBadgeTaken = true;
  Game.progress.sunBadgePlaced = true;
  Game.progress.scene2Entered = true;
  Game.progress.judgementMuralRead = true;
  Game.progress.scaleCompartmentOpened = true;
  Game.progress.scaleCompartmentSealed = false;
  Game.progress.scalePuzzleIntroduced = true;
  Game.progress.priestAmuletFound = true;
  Game.progress.scaleCleared = true;
  Game.progress.scaleMistakes = 0;
  Game.progress.collectedTrialItems = {
    golden_mask: true,
    truth_feather: true,
    stone_heart: true,
    jewel_scarab: true
  };
  Game.progress.scene3Entered = false;
  Game.progress.tombMechanismActivated = false;
  Game.progress.priestAmuletActivated = false;
  Game.progress.priestWarningRead = false;
  Game.progress.mirrorsRevealed = false;
  Game.progress.mirrorRiseStartedAt = 0;
  Game.progress.mirrorMistakes = 0;
  Game.progress.mirrorPuzzleSolved = false;
  Game.progress.sealedHeartAltarViewed = false;
  Game.progress.sunHeartAltarRevealed = false;
  Game.progress.tombEscapeActive = false;
  Game.progress.sunHeartTaken = null;
  Game.progress.endingId = null;
  Game.inventory = ['priest_amulet'];
  Game.selectedItem = null;
  Game.mirrorState = [0, 0, 0];
  Game.timer.remainingSeconds = 5 * 60;
  Game.timer.isRunning = false;
  Game.timer.lastTick = 0;
  updateTimerDisplay();

  if (window.enterPharaohTomb) await window.enterPharaohTomb();
}

function setupTestControls() {
  const controls = document.getElementById('test-controls');
  if (!controls || !Game.testMode) return;

  controls.classList.remove('hidden');
  const quickBtn = document.getElementById('test-30s-btn');
  const pauseBtn = document.getElementById('test-pause-btn');
  const scene2Btn = document.getElementById('test-scene2-btn');
  const scene3Btn = document.getElementById('test-scene3-btn');
  const timeUpBtn = document.getElementById('test-timeup-btn');

  if (quickBtn) {
    quickBtn.addEventListener('click', () => {
      Game.timer.remainingSeconds = 30;
      Game.timer.isRunning = true;
      Game.timer.lastTick = performance.now();
      if (pauseBtn) pauseBtn.textContent = '暫停';
      document.getElementById('countdown-timer')?.classList.remove('hidden');
      updateTimerDisplay();
    });
  }

  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      Game.timer.isRunning = !Game.timer.isRunning;
      Game.timer.lastTick = performance.now();
      pauseBtn.textContent = Game.timer.isRunning ? '暫停' : '繼續';
    });
  }

  if (scene2Btn) {
    scene2Btn.addEventListener('click', () => {
      Game.progress.puzzleCleared = true;
      Game.progress.doorOpened = true;
      Game.progress.awakeningStartedAt = performance.now();
      Game.progress.sunBadgeRevealed = true;
      Game.progress.sunBadgeTaken = true;
      Game.progress.sunBadgePlaced = true;
      Game.inventory = Game.inventory.filter(itemId => itemId !== 'sun_badge');
      Game.timer.remainingSeconds = 5 * 60;
      Game.timer.isRunning = false;
      Game.timer.lastTick = performance.now();
      if (pauseBtn) pauseBtn.textContent = '繼續';
      updateTimerDisplay();
      if (window.enterJudgementChamber) window.enterJudgementChamber();
    });
  }

  if (scene3Btn) {
    scene3Btn.addEventListener('click', async () => {
      await enterThirdSceneForDevelopment();
      if (pauseBtn) pauseBtn.textContent = '繼續';
    });
  }

  if (timeUpBtn) {
    timeUpBtn.addEventListener('click', () => {
      Game.timer.remainingSeconds = 0;
      Game.timer.isRunning = true;
      Game.timer.lastTick = performance.now();
      document.getElementById('countdown-timer')?.classList.remove('hidden');
      updateTimerDisplay();
    });
  }
}

function triggerTimeUpGameOver() {
  document.getElementById('puzzle-overlay')?.classList.add('hidden');
  document.getElementById('scale-overlay')?.classList.add('hidden');
  Game.state = 'DIALOGUE';
  window.triggerDialogue('古墓的終末', [
    '『時間已盡，空氣在沙塵中凝結……』',
    '『古老的封印再次合攏，沉睡的靈魂將長伴法老。』'
  ], () => {
    if (window.showDeathScreen) {
      window.showDeathScreen({
        title: 'BAD END：未通過的審判',
        reason: '封印倒數已經歸零，古墓完全封閉。'
      });
    } else {
      restartGame();
    }
  });
}

function render() {
  const ctx = Game.ctx;
  if (!ctx) return;

  ctx.clearRect(0, 0, Game.width, Game.height);

  // 儲存並套用相機偏移與畫面劇烈震動 (Screen Shake)
  ctx.save();
  const shakeX = Game.screenShake ? Game.screenShake.offsetX : 0;
  const shakeY = Game.screenShake ? Game.screenShake.offsetY : 0;
  ctx.translate(-Game.cameraX + shakeX, shakeY);

  // 1. 繪製背景層
  window.drawBackground(ctx);

  // 2. 繪製場景物件層
  window.drawSceneObjects(ctx);

  // 3. 繪製主角亞倫
  window.drawPlayer(ctx);

  // 4. 繪製解密成功粒子與落石
  window.drawParticles(ctx);

  ctx.restore();

  // 5. 疊加黑暗燈光遮罩
  window.applyLightingFilter(ctx);
}

function gameLoop(timestamp) {
  try {
    update(timestamp);
    render();
    requestAnimationFrame(gameLoop);
  } catch (e) {
    if (window.reportRuntimeError) window.reportRuntimeError(e);
  }
}

// --- 6. 應用程式入口總初始化 ---
async function initApp() {
  try {
    Game.canvas = document.getElementById('gameCanvas');
    Game.ctx = Game.canvas.getContext('2d');

    // 鍵盤監聽註冊
    window.addEventListener('keydown', window.handleKeyDown);
    window.addEventListener('keyup', window.handleKeyUp);

    // DOM 按鈕事件綁定 (加入安全空值防護)
    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) restartBtn.addEventListener('click', restartGame);

    const skipCutsceneBtn = document.getElementById('skip-cutscene-btn');
    if (skipCutsceneBtn) {
      skipCutsceneBtn.addEventListener('click', () => {
        if (window.skipOpeningCutscene) window.skipOpeningCutscene();
      });
    }

    const dialoguePanel = document.getElementById('dialogue-panel');
    if (dialoguePanel) dialoguePanel.addEventListener('click', window.advanceDialogue);

    const submitBtn = document.getElementById('submit-puzzle-btn');
    if (submitBtn) submitBtn.addEventListener('click', submitPuzzle);

    const closeBtns = document.querySelectorAll('.close-modal-btn');
    closeBtns.forEach(btn => {
      btn.addEventListener('click', closeModal);
    });

    // 初始化石板拖放與槽位微調校準
    initPuzzleInteractions();
    setupSlotCalibrationEvents();
    setupTestControls();

    // 主頁面優先顯示；開始新遊戲時先進序章，素材在序章背後靜默準備。
    window.hideGameLoadingOverlay?.();
    if (window.setupPrologue) {
      window.setupPrologue({
        prepareGame: () => window.preloadGameAssets?.('sun_temple', { showOverlay: false }),
        enterGame: () => restartGame()
      });
    }
    if (window.setupMainMenu) {
      window.setupMainMenu({
        startNewGame: async () => {
          if (window.DEVELOPMENT_START_SCENE === 'pharaoh_tomb') {
            await enterThirdSceneForDevelopment();
            return;
          }
          if (window.openGamePrologue) {
            window.openGamePrologue();
            return;
          }
          if (window.preloadGameAssets) await window.preloadGameAssets('sun_temple');
          restartGame();
        },
        continueGame: async () => {
          if (typeof window.loadActiveGameSave === 'function') {
            const loaded = await window.loadActiveGameSave();
            if (!loaded?.ok || !loaded.exists || !loaded.save) return false;
            if (window.preloadGameAssets) await window.preloadGameAssets(loaded.save.sceneId);
            return window.restoreGameCheckpoint?.(loaded.save) ?? false;
          }
          const checkpoint = window.getGameCheckpointSummary?.();
          if (!checkpoint) return false;
          if (window.preloadGameAssets) await window.preloadGameAssets(checkpoint.sceneId);
          return window.restoreGameCheckpoint?.() ?? false;
        }
      });
      if (window.DEVELOPMENT_START_SCENE === 'pharaoh_tomb') {
        await enterThirdSceneForDevelopment();
      }
    } else {
      if (window.DEVELOPMENT_START_SCENE === 'pharaoh_tomb') await enterThirdSceneForDevelopment();
      else window.startGame();
    }

    // 登入／訪客入口最後啟用，覆蓋既有主選單且不重複初始化遊戲。
    window.setupExplorerGate?.();
    
    // 啟動主畫布渲染循環
    requestAnimationFrame(gameLoop);
  } catch (e) {
    if (window.reportRuntimeError) window.reportRuntimeError(e);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initApp();
});
