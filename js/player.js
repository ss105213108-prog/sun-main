/**
 * 《太陽之心：法老的試煉》
 * 模組：js/player.js
 * 負責：玩家物理狀態、鍵盤監聽、碰撞邊界、以及亞倫精靈圖（Sprite Sheet）動態切割渲染
 */

// 初始化玩家對象並掛載到 window 方便全域存取
window.player = {
  x: 200,
  y: 432, // 貼合覆蓋石柱底部的專屬石磚地板 (地板.png) 頂面的地面高度
  width: 40,
  height: 80,
  vx: 0,
  vy: 0,
  speed: 2.3,
  friction: 0.8,
  isWalking: false,
  walkFrame: 0,
  direction: 1, // 1: 右, -1: 左
  lightRadius: 260,
  lightFlicker: 0
};

// 鍵盤狀態
window.keys = {
  a: false,
  d: false
};

// 載入亞倫 0.2 倍數 GIF 移動動畫
const walkImage = new Image();
walkImage.src = 'assets/characters/aaron/走路動畫/0.2倍數.gif';

// 載入亞倫專屬的左側 (idle) 與右側 (idle_right) 待機動畫影格
const idleLeftFrames = [];
const idleRightFrames = [];

for (let i = 1; i <= 4; i++) {
  const imgL = new Image();
  imgL.src = `assets/characters/aaron/idle/idle_0${i}.png`;
  idleLeftFrames.push(imgL);

  const imgR = new Image();
  imgR.src = `assets/characters/aaron/idle_right/idle_0${i}right.png`;
  idleRightFrames.push(imgR);
}

// 監聽鍵盤事件
function handleKeyDown(e) {
  // 移動鍵允許持續按住；互動類按鍵忽略瀏覽器 key repeat，避免一次按壓跳過多句對話。
  if (e.repeat && ['e', 'E', 'b', 'B', 'Enter', ' ', 'Escape'].includes(e.key)) return;

  // 過場動畫期間按 ESC 可立即跳過
  if (Game.inCutscene && e.key === 'Escape') {
    if (window.skipOpeningCutscene) {
      window.skipOpeningCutscene();
      return;
    }
  }

  if (Game.state === 'PLAYING') {
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') keys.a = true;
    if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') keys.d = true;
    
    if (e.key === 'e' || e.key === 'E') {
      window.attemptInteraction();
    }
    
    if (e.key === 'b' || e.key === 'B') {
      window.openInventory();
    }
  } else if (Game.state === 'DIALOGUE' || Game.state === 'CUTSCENE') {
    if (e.key === 'e' || e.key === 'E' || e.key === 'Enter' || e.key === ' ') {
      window.advanceDialogue();
    }
  } else if (Game.state === 'PUZZLE' || Game.state === 'BAG' || Game.state === 'SCALE') {
    if (e.key === 'Escape' || (Game.state === 'BAG' && (e.key === 'b' || e.key === 'B'))) {
      window.closeModal();
    }
  } else if (Game.state === 'FINAL_CHOICE') {
    window.handleSunHeartChoiceKey?.(e);
  }
}

function handleKeyUp(e) {
  if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') keys.a = false;
  if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') keys.d = false;
}

window.handleKeyDown = handleKeyDown;
window.handleKeyUp = handleKeyUp;

// 物理與相機更新
function updatePlayer(timestamp) {
  // 1. 處理過場動畫中的自動導航走位
  if (player.autoWalkTarget !== null) {
    const dx = player.autoWalkTarget - player.x;
    if (Math.abs(dx) > 3) {
      player.direction = dx > 0 ? 1 : -1;
      player.vx = player.direction * 1.8;
      player.x += player.vx;
      player.isWalking = true;
      player.walkFrame += 0.15;
    } else {
      player.x = player.autoWalkTarget;
      player.vx = 0;
      player.isWalking = false;
      const cb = player.autoWalkCallback;
      player.autoWalkTarget = null;
      player.autoWalkCallback = null;
      if (cb) cb();
    }
  } else if (Game.state === 'PLAYING') {
    // 2. 玩家自由物理移動計算
    let moveDir = 0;
    if (keys.a) moveDir -= 1;
    if (keys.d) moveDir += 1;

    if (moveDir !== 0) {
      player.vx = moveDir * player.speed;
      player.direction = moveDir;
      player.isWalking = true;
      player.walkFrame += 0.15;
    } else {
      player.vx *= player.friction;
      if (Math.abs(player.vx) < 0.1) {
        player.vx = 0;
        player.isWalking = false;
      }
    }

    player.x += player.vx;
  } else {
    player.isWalking = false;
  }

  // 地圖動態邊界碰撞判定 (完全對齊 3600px 畫布 Game.worldWidth)
  const minBound = Game.entranceBlocked ? (Game.rubbleBoundaryX || 215) : 80;
  const maxBound = Game.worldWidth - 100;
  
  if (player.x < minBound) player.x = minBound;
  if (player.x > maxBound) player.x = maxBound;

  // 相機平滑跟隨 (支援導播模式 Game.cameraTargetX 與主角平滑跟隨)
  let targetCamX = (Game.cameraTargetX !== null) ? Game.cameraTargetX : (player.x - Game.width / 2);
  Game.cameraX += (targetCamX - Game.cameraX) * 0.08;
  
  // 相機邊界限制
  if (Game.cameraX < 0) Game.cameraX = 0;
  if (Game.cameraX > Game.worldWidth - Game.width) Game.cameraX = Game.worldWidth - Game.width;

  // 畫面震動 (Screen Shake) 衰減計算
  if (Game.screenShake.duration > 0) {
    Game.screenShake.elapsed += 16.6;
    if (Game.screenShake.elapsed < Game.screenShake.duration) {
      const progress = 1 - (Game.screenShake.elapsed / Game.screenShake.duration);
      const mag = Game.screenShake.magnitude * progress;
      Game.screenShake.offsetX = (Math.random() * 2 - 1) * mag;
      Game.screenShake.offsetY = (Math.random() * 2 - 1) * mag;
    } else {
      Game.screenShake.duration = 0;
      Game.screenShake.offsetX = 0;
      Game.screenShake.offsetY = 0;
    }
  }

  // 提燈光圈呼吸起伏 (Flicker)
  const timeVal = (typeof timestamp === 'number' && !isNaN(timestamp)) ? timestamp : performance.now();
  player.lightFlicker = Math.sin(timeVal * 0.005) * 5 + Math.random() * 2;
}
window.updatePlayer = updatePlayer;

// 全域快取 DOM GIF 元素
let playerGifElem = null;

// 繪製玩家亞倫
function drawPlayer(ctx) {
  if (!playerGifElem) {
    playerGifElem = document.getElementById('player-gif');
  }

  // 縮放比例計算：目標高度 95px (與 540px 神殿長廊石柱、壁畫及 140px 石磚地板形成最佳建築透視黃金比例)
  // 512x512 畫布中角色的實際高度為 410px，腳底固定於 y=470px
  const sceneScale = Game.currentScene === 'pharaoh_tomb' && window.getTombPlayerScale
    ? window.getTombPlayerScale()
    : 1;
  const scale = (95 * sceneScale) / 410;
  const drawW = 512 * scale;
  const drawH = 512 * scale;

  // 1. 移動中狀態 (按 A/D 鍵移動)：顯示並播放 0.2 倍數 GIF 動畫
  if (player.isWalking) {
    if (playerGifElem) {
      playerGifElem.classList.remove('hidden');
      playerGifElem.style.display = 'block';

      // 依 960x540 虛擬畫布計算動態百分比 (%) 座標，保證全螢幕與電影模式下 100% 零誤差對齊
      const screenXPercent = ((player.x - Game.cameraX - 256 * scale) / 960) * 100;
      const screenYPercent = ((player.y - 470 * scale) / 540) * 100;
      const drawWPercent = (drawW / 960) * 100;
      const drawHPercent = (drawH / 540) * 100;

      playerGifElem.style.left = `${screenXPercent}%`;
      playerGifElem.style.top = `${screenYPercent}%`;
      playerGifElem.style.width = `${drawWPercent}%`;
      playerGifElem.style.height = `${drawHPercent}%`;

      // 面向與水平翻轉：0.2 倍數 GIF 原圖面向左側。
      // 當 direction === 1 (向右走) 時套用 scaleX(-1) 翻轉面向右；
      // 當 direction === -1 (向左走) 時套用 scaleX(1) 面向左。
      playerGifElem.style.transform = player.direction === 1 ? 'scaleX(-1)' : 'scaleX(1)';

      // 計算主角與牆面實體火把 [280, 1240, 1720] 的相對距離，使人物在 0.65 (陰影中) ~ 1.00 (火把下) 之間自然過渡
      const torchXList = [280, 1240, 1720];
      let minTorchDist = 9999;
      torchXList.forEach(tx => {
        const dist = Math.abs(player.x - tx);
        if (dist < minTorchDist) minTorchDist = dist;
      });
      const torchBonus = Math.max(0, (260 - minTorchDist) / 260) * 0.35;
      const currentBrightness = 0.65 + torchBonus;
      playerGifElem.style.filter = `brightness(${currentBrightness.toFixed(2)})`;
    }

    return;
  }

  // 2. 停止移動待機狀態：隱藏 DOM GIF，在 Canvas 繪製對應方向的專屬 Idle 呼吸 PNG
  if (playerGifElem) {
    playerGifElem.classList.add('hidden');
    playerGifElem.style.display = 'none';
  }

  ctx.save();
  ctx.translate(player.x, player.y);

  // 依方向選擇專屬原生的面向影格 (向右使用 idleRightFrames，向左使用 idleLeftFrames)
  const currentFrames = (player.direction === 1) ? idleRightFrames : idleLeftFrames;
  const allLoaded = currentFrames.every(img => img.complete && img.naturalWidth !== 0);
  
  if (allLoaded) {
    const frameIndex = Math.floor(performance.now() * 0.005) % 4;
    const currentFrame = currentFrames[frameIndex];

    const dx = -256 * scale;
    const dy = -470 * scale;

    ctx.drawImage(currentFrame, dx, dy, drawW, drawH);

    ctx.restore();
    return;
  }

  // Fallback 向量人物 (只有當圖片完全載入失敗時作為最後防線)
  const bob = player.isWalking ? Math.abs(Math.sin(player.walkFrame)) * 4 : 0;
  ctx.fillStyle = '#4c3930';
  ctx.fillRect(-12, -50 - bob, 24, 40);
  ctx.fillStyle = '#221915';
  ctx.fillRect(-8, -10 - bob, 6, 12);
  ctx.fillRect(2, -10 - bob, 6, 12);
  ctx.fillStyle = '#e5cca8';
  ctx.beginPath(); ctx.arc(0, -60 - bob, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a2b24';
  ctx.fillRect(-12, -68 - bob, 24, 3);
  ctx.fillRect(-6, -75 - bob, 12, 7);
  ctx.fillStyle = '#ffd700';
  ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 10;
  ctx.fillRect(10, -25 - bob, 6, 10);
  ctx.shadowBlur = 0;

  ctx.restore();
}
window.drawPlayer = drawPlayer;
