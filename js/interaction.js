/**
 * 《太陽之心：法老的試煉》
 * 模組：js/interaction.js
 * 負責：靠近提示檢測、對話打字機效果、以及 Web Audio API 合成音效管理
 */

// 音效播放與合成器
const audio = {
  ctx: null,
  output: null,
  volume: 0.8,
  init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) this.ctx = new AudioContextClass();
    }
    if (this.ctx && !this.output) {
      this.output = this.ctx.createGain();
      this.output.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.output.connect(this.ctx.destination);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },
  setVolume(value) {
    const parsed = Number(value);
    this.volume = Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 0.8;
    if (this.output && this.ctx) {
      this.output.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  },
  play(type) {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    if (type === 'click') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.1);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain).connect(this.output);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'correct') {
      const notes = [392.00, 523.25, 659.25, 783.99]; // G4, C5, E5, G5
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.06, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
        osc.connect(gain).connect(this.output);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.25);
      });
    } else if (type === 'incorrect') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(130, now);
      osc.frequency.linearRampToValueAtTime(85, now + 0.35);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain).connect(this.output);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'item') {
      const notes = [659.25, 880.00, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.045, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.22);
        osc.connect(gain).connect(this.output);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.22);
      });
    } else if (type === 'rumble') {
      const bufferSize = this.ctx.sampleRate * 1.5;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(90, now);
      filter.frequency.linearRampToValueAtTime(45, now + 1.5);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      source.connect(filter).connect(gain).connect(this.output);
      source.start(now);
      source.stop(now + 1.5);
    }
  }
};
window.audio = audio;

// 檢測是否接近可互動的物件並顯示 [E 調查] 提示
function formatInteractionPromptLabel(label) {
  const text = String(label ?? '').trim();
  return text.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u, '').trim();
}

function checkInteractions() {
  const promptEl = document.getElementById('interaction-prompt');

  // 過場動畫與對話期間完全隱藏調查提示
  if (!window.player || Game.inCutscene || Game.state === 'CUTSCENE' || Game.state === 'DIALOGUE') {
    if (promptEl) promptEl.classList.add('hidden');
    Game.currentInteractiveTarget = null;
    return;
  }

  let closestTarget = null;
  let minDist = Infinity;
  const defaultInteractionRadius = 100;

  Game.sceneObjects.forEach((obj) => {
    if (typeof obj.isAvailable === 'function' && !obj.isAvailable()) return;
    const interactionX = Number.isFinite(obj.interactionX) ? obj.interactionX : obj.x;
    const interactionRadius = Number.isFinite(obj.interactionRadius)
      ? obj.interactionRadius
      : defaultInteractionRadius;
    const dist = Math.abs(player.x - interactionX);
    if (dist < interactionRadius && dist < minDist) {
      closestTarget = obj;
      minDist = dist;
    }
  });

  Game.currentInteractiveTarget = closestTarget;

  if (closestTarget && promptEl) {
    promptEl.classList.remove('hidden');
    const promptVerb = closestTarget.promptVerb || '調查';
    promptEl.innerText = `E ${promptVerb} ${formatInteractionPromptLabel(closestTarget.label)}`;
    // 依 960x540 虛擬畫布動態計算百分比 (%) 座標，保證電影模式與全螢幕縮放下 100% 精準對齊
    const promptX = Number.isFinite(closestTarget.interactionX)
      ? closestTarget.interactionX
      : closestTarget.x;
    const screenXPercent = ((promptX - Game.cameraX) / 960) * 100;
    const screenYPercent = ((closestTarget.y - closestTarget.height / 2 - 25) / 540) * 100;
    promptEl.style.left = `${screenXPercent}%`;
    promptEl.style.top = `${screenYPercent}%`;
  } else if (promptEl) {
    promptEl.classList.add('hidden');
  }
}
window.checkInteractions = checkInteractions;

function attemptInteraction() {
  if (Game.currentInteractiveTarget) {
    audio.play('click');
    Game.currentInteractiveTarget.onInteract();
  }
}
window.attemptInteraction = attemptInteraction;

// 對話系統打字機效果 (支援多句佇列逐句呈現)
function triggerDialogue(speaker, textOrLines, callback = null) {
  // 暫停鍵盤輸入
  if (window.keys) {
    keys.a = false;
    keys.d = false;
  }
  Game.state = 'DIALOGUE';

  const panel = document.getElementById('dialogue-panel');
  panel.classList.remove('hidden');

  // 將輸入轉換為陣列
  const lines = Array.isArray(textOrLines) ? textOrLines : [textOrLines];

  Game.dialogue.speaker = speaker;
  Game.dialogue.lines = lines;
  Game.dialogue.lineIndex = 0;
  Game.dialogue.callback = callback;

  showCurrentDialogueLine();
}
window.triggerDialogue = triggerDialogue;

function stopDialogueTyping() {
  if (Game.dialogue.typingTimer) {
    cancelAnimationFrame(Game.dialogue.typingTimer);
    Game.dialogue.typingTimer = null;
  }
}

function showCurrentDialogueLine() {
  const panel = document.getElementById('dialogue-panel');
  const speakerEl = document.getElementById('dialogue-speaker');
  const textEl = document.getElementById('dialogue-text');
  const portraitEl = document.getElementById('dialogue-portrait');

  speakerEl.innerText = Game.dialogue.speaker;
  const isAaronSpeaking = String(Game.dialogue.speaker || '').includes('亞倫');
  panel?.classList.toggle('has-aaron-portrait', isAaronSpeaking);
  portraitEl?.classList.toggle('hidden', !isAaronSpeaking);

  // 重置打字狀態
  stopDialogueTyping();

  const currentLine = Game.dialogue.lines[Game.dialogue.lineIndex] || '';
  Game.dialogue.fullText = currentLine;
  Game.dialogue.charIndex = 0;
  Game.dialogue.isTyping = true;
  textEl.innerText = '';

  textEl.classList.remove('line-enter');
  void textEl.offsetWidth;
  textEl.classList.add('line-enter');

  const startedAt = performance.now();
  const charsPerSecond = Number(window.gameSettings?.textSpeed) || 42;
  let lastRenderedCount = 0;

  const typeFrame = (now) => {
    const targetCount = Math.min(
      Game.dialogue.fullText.length,
      Math.floor(((now - startedAt) / 1000) * charsPerSecond) + 1
    );

    if (targetCount !== lastRenderedCount) {
      textEl.innerText = Game.dialogue.fullText.slice(0, targetCount);
      Game.dialogue.charIndex = targetCount;
      lastRenderedCount = targetCount;
    }

    if (targetCount >= Game.dialogue.fullText.length) {
      Game.dialogue.isTyping = false;
      Game.dialogue.typingTimer = null;
      return;
    }

    Game.dialogue.typingTimer = requestAnimationFrame(typeFrame);
  };

  Game.dialogue.typingTimer = requestAnimationFrame(typeFrame);
}

function advanceDialogue() {
  audio.play('click');
  const textEl = document.getElementById('dialogue-text');

  if (Game.dialogue.isTyping) {
    // 立即顯示當前句子全部文字
    stopDialogueTyping();
    textEl.innerText = Game.dialogue.fullText;
    Game.dialogue.isTyping = false;
  } else {
    // 檢查是否還有下一句
    Game.dialogue.lineIndex++;
    if (Game.dialogue.lines && Game.dialogue.lineIndex < Game.dialogue.lines.length) {
      showCurrentDialogueLine();
    } else {
      // 全部句子讀完，關閉對話框
      document.getElementById('dialogue-panel').classList.add('hidden');
      
      const cb = Game.dialogue.callback;
      Game.dialogue.callback = null;

      if (Game.inCutscene) {
        Game.state = 'CUTSCENE';
      } else {
        const puzzleOverlay = document.getElementById('puzzle-overlay');
        const inventoryOverlay = document.getElementById('inventory-overlay');
        const scaleOverlay = document.getElementById('scale-overlay');
        if (puzzleOverlay && !puzzleOverlay.classList.contains('hidden')) {
          Game.state = 'PUZZLE';
        } else if (inventoryOverlay && !inventoryOverlay.classList.contains('hidden')) {
          Game.state = 'BAG';
        } else if (scaleOverlay && !scaleOverlay.classList.contains('hidden')) {
          Game.state = 'SCALE';
        } else {
          Game.state = 'PLAYING';
        }
      }

      if (cb) {
        cb();
      }
    }
  }
}
window.advanceDialogue = advanceDialogue;

function closeModal() {
  audio.play('click');
  document.getElementById('inventory-overlay').classList.add('hidden');
  document.getElementById('puzzle-overlay').classList.add('hidden');
  document.getElementById('scale-overlay')?.classList.add('hidden');
  document.getElementById('relic-reveal-overlay')?.classList.add('hidden');
  document.getElementById('sun-heart-choice-overlay')?.classList.add('hidden');
  document.getElementById('tomb-ending-overlay')?.classList.add('hidden');
  document.getElementById('game-container')?.classList.remove('final-choice-active');
  Game.state = 'PLAYING';
}
window.closeModal = closeModal;

// ----------------------------------------------------
// 9.1 開場電影級過場動畫：被封閉的入口 (Opening Cutscene)
// ----------------------------------------------------
let cutsceneTimer = null;

function playOpeningCutscene() {
  Game.inCutscene = true;
  Game.state = 'CUTSCENE';
  Game.entranceBlocked = false;

  // 顯示跳過按鈕
  const skipBtn = document.getElementById('skip-cutscene-btn');
  if (skipBtn) skipBtn.classList.remove('hidden');

  // 隱藏倒數計時器 (待開場結束後再啟動)
  const timerEl = document.getElementById('countdown-timer');
  if (timerEl) timerEl.classList.add('hidden');

  // 主角初始生成於入口處
  if (window.player) {
    player.x = 60;
    player.direction = 1;
    player.isWalking = false;
    player.autoWalkTarget = null;
  }
  Game.cameraX = 0;
  Game.cameraTargetX = null;

  // 黑幕淡出
  const fadeEl = document.getElementById('screen-fade');
  if (fadeEl) {
    fadeEl.classList.remove('fade-in');
    fadeEl.classList.add('fade-out');
  }

  // Phase 1：亞倫踏入神殿長廊 (X: 60 ➔ 450)
  cutsceneTimer = setTimeout(() => {
    if (!Game.inCutscene) return;
    
    player.autoWalkTarget = 450;
    player.autoWalkCallback = () => {
      if (!Game.inCutscene) return;
      // 停下腳步觀察牆壁圖案
      cutsceneTimer = setTimeout(() => {
        if (!Game.inCutscene) return;
        triggerDialogue('亞倫・卡特', [
          '「這裡沒有出現在任何探勘紀錄裡……」',
          '「牆上的圖案，至少有三千年的歷史。」'
        ], () => {
          if (!Game.inCutscene) return;
          // Phase 2：走向太陽石門前調查
          playCutscenePhase2();
        });
      }, 400);
    };
  }, 600);
}
window.playOpeningCutscene = playOpeningCutscene;

function playCutscenePhase2() {
  if (!Game.inCutscene) return;

  // 亞倫自動走向太陽石門正前方
  const targetX = (window.doorSettings && doorSettings.x) ? Math.max(100, doorSettings.x - 70) : 1000;
  player.autoWalkTarget = targetX;
  player.autoWalkCallback = () => {
    if (!Game.inCutscene) return;
    cutsceneTimer = setTimeout(() => {
      if (!Game.inCutscene) return;
      triggerDialogue('亞倫・卡特', [
        '「石門上的太陽像是被某種力量鎖住了。」',
        '「這不是普通的墓室入口。」'
      ], () => {
        if (!Game.inCutscene) return;
        // Phase 3：劇烈震動與落石崩塌
        playCutscenePhase3();
      });
    }, 400);
  };
}

function playCutscenePhase3() {
  if (!Game.inCutscene) return;

  // 1. 播放石崩轟鳴聲並觸發全螢幕劇烈震動
  audio.play('rumble');
  window.triggerScreenShake(14, 2500);

  // 2. 鏡頭迅速平移特寫至左側入口 (X: 0)
  Game.cameraTargetX = 0;

  // 3. 延遲 300ms 傾瀉落石封路
  cutsceneTimer = setTimeout(() => {
    if (!Game.inCutscene) return;
    window.triggerRockslide(() => {
      if (!Game.inCutscene) return;
      // Phase 4：古墓莊嚴宣告
      playCutscenePhase4();
    });
  }, 300);
}

function playCutscenePhase4() {
  if (!Game.inCutscene) return;

  cutsceneTimer = setTimeout(() => {
    if (!Game.inCutscene) return;
    triggerDialogue('古墓的聲音', [
      '『古墓封印已啟動。』',
      '『貪婪者將永遠沉睡，理解王之意志者方能重見陽光。』'
    ], () => {
      if (!Game.inCutscene) return;
      // Phase 5：鏡頭移回亞倫 ➔ 亞倫決意
      playCutscenePhase5();
    });
  }, 600);
}

function playCutscenePhase5() {
  if (!Game.inCutscene) return;

  // 鏡頭平滑移回亞倫
  Game.cameraTargetX = null;

  cutsceneTimer = setTimeout(() => {
    if (!Game.inCutscene) return;
    triggerDialogue('亞倫・卡特', [
      '「如果這裡真的有出口，它一定和這些試煉有關。」',
      '「我得往前走。」'
    ], () => {
      finishOpeningCutscene();
    });
  }, 1000);
}

function finishOpeningCutscene() {
  Game.inCutscene = false;
  Game.state = 'PLAYING';
  Game.entranceBlocked = true;
  Game.cameraTargetX = null;

  // 隱藏跳過按鈕
  const skipBtn = document.getElementById('skip-cutscene-btn');
  if (skipBtn) skipBtn.classList.add('hidden');

  // 正式模式為 15 分鐘；測試模式縮短為 30 秒。
  const timerEl = document.getElementById('countdown-timer');
  if (timerEl) {
    timerEl.classList.remove('hidden');
  }
  Game.timer.remainingSeconds = Game.testMode ? 30 : 15 * 60;
  Game.timer.isRunning = true;
  Game.timer.lastTick = performance.now();
  if (window.updateTimerDisplay) window.updateTimerDisplay();
  if (window.createGameCheckpoint) {
    window.createGameCheckpoint('太陽神殿入口');
  }
}
window.finishOpeningCutscene = finishOpeningCutscene;

function skipOpeningCutscene() {
  if (!Game.inCutscene) return;
  if (cutsceneTimer) clearTimeout(cutsceneTimer);

  // 停止打字與關閉對話
  stopDialogueTyping();
  const panel = document.getElementById('dialogue-panel');
  if (panel) panel.classList.add('hidden');

  // 重置主角與相機
  if (window.player) {
    player.autoWalkTarget = null;
    player.autoWalkCallback = null;
    player.isWalking = false;
    player.x = 450;
    player.direction = 1;
  }
  Game.cameraTargetX = null;
  Game.cameraX = player.x - Game.width / 2;
  Game.screenShake.duration = 0;
  Game.fallingRocks = [];
  Game.dustParticles = [];
  Game.rockslideStartedAt = 0;
  Game.rockslideSettledAt = 0;

  finishOpeningCutscene();
}
window.skipOpeningCutscene = skipOpeningCutscene;

function startGame() {
  // 玩家點擊解鎖音訊
  const startAudio = () => {
    audio.init();
    window.removeEventListener('click', startAudio);
    window.removeEventListener('keydown', startAudio);
  };
  window.addEventListener('click', startAudio);
  window.addEventListener('keydown', startAudio);

  if (Game.startInScene3ForDevelopment && window.enterPharaohTomb) {
    // 第三場景開發直達：視為前兩道試煉已完成，並保留會影響結局的祭司護符。
    Game.inCutscene = false;
    Game.progress.puzzleCleared = true;
    Game.progress.doorOpened = true;
    Game.progress.sunBadgeRevealed = true;
    Game.progress.sunBadgeTaken = true;
    Game.progress.sunBadgePlaced = true;
    Game.progress.scene2Entered = true;
    Game.progress.judgementMuralRead = true;
    Game.progress.scaleCompartmentOpened = true;
    Game.progress.scalePuzzleIntroduced = true;
    Game.progress.priestAmuletFound = true;
    Game.progress.scaleCleared = true;
    Game.progress.scaleMistakes = 0;
    Game.progress.collectedTrialItems = {
      gold_mask: true,
      truth_feather: true,
      stone_heart: true,
      jewel_scarab: true
    };
    Game.scaleState = { left: 'stone_heart', right: 'truth_feather' };
    Game.inventory = ['priest_amulet'];

    document.getElementById('skip-cutscene-btn')?.classList.add('hidden');
    document.getElementById('countdown-timer')?.classList.remove('hidden');
    Game.timer.remainingSeconds = 5 * 60;
    Game.timer.isRunning = true;
    Game.timer.lastTick = performance.now();
    if (window.updateTimerDisplay) window.updateTimerDisplay();

    window.enterPharaohTomb();
    return;
  }

  if (Game.startInScene2ForDevelopment && window.enterJudgementChamber) {
    // 暫時視為第一場景已完成，避免開發第二場景時重跑祭壇與石門流程。
    Game.inCutscene = false;
    Game.progress.puzzleCleared = true;
    Game.progress.doorOpened = true;
    Game.progress.awakeningStartedAt = performance.now();
    Game.progress.sunBadgeRevealed = true;
    Game.progress.sunBadgeTaken = true;
    Game.progress.sunBadgePlaced = true;
    Game.inventory = Game.inventory.filter(itemId => itemId !== 'sun_badge');

    const skipBtn = document.getElementById('skip-cutscene-btn');
    if (skipBtn) skipBtn.classList.add('hidden');
    const timerEl = document.getElementById('countdown-timer');
    if (timerEl) timerEl.classList.remove('hidden');
    Game.timer.isRunning = true;
    Game.timer.lastTick = performance.now();
    if (window.updateTimerDisplay) window.updateTimerDisplay();

    window.enterJudgementChamber();
    return;
  }

  // 啟動 9.1 開場電影級過場動畫
  playOpeningCutscene();
}
window.startGame = startGame;
