/**
 * 《太陽之心：法老的試煉》
 * 第三場景：法老王墓室
 * 包含場景切換、護符分支、三面銅鏡光路與右側太陽之心祭壇的最終選擇。
 */
(function setupPharaohTomb() {
  const SCENE_ID = 'pharaoh_tomb';
  const WORLD_WIDTH = 2000;
  const LAYOUT_STORAGE_KEY = 'pharaohTombLayoutSettings';
  const PROPS_STORAGE_KEY = 'pharaohTombPropsSettings';
  const defaultTombLayoutSettings = {
    backgroundScale: 1,
    backgroundOffsetY: 0,
    playerScale: 1,
    playerFloorY: 500
  };
  let tombLayoutSettings = { ...defaultTombLayoutSettings };
  try {
    const savedLayout = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (savedLayout) {
      const parsed = JSON.parse(savedLayout);
      Object.keys(defaultTombLayoutSettings).forEach(key => {
        if (Number.isFinite(parsed[key])) tombLayoutSettings[key] = parsed[key];
      });
    }
  } catch (error) {}
  const defaultTombPropsSettings = {
    entranceDoor: { x: 170, y: 390, width: 330, height: 220 },
    torches: [
      { x: 390, y: 175, scale: 1 },
      { x: 820, y: 175, scale: 1 },
      { x: 1250, y: 175, scale: 1 },
      { x: 1680, y: 175, scale: 1 }
    ],
    mirrors: [
      { x: 750, y: 500, scale: 1 },
      { x: 1000, y: 500, scale: 1 },
      { x: 1250, y: 500, scale: 1 }
    ],
    sunHeartAltar: { x: 1700, y: 500, width: 380 },
    beamPoints: {
      source: { x: 1000, y: 42 },
      sun: { x: 1450, y: 165 },
      moon: { x: 550, y: 165 },
      throne: { x: 1000, y: 285 }
    }
  };
  let tombPropsSettings = JSON.parse(JSON.stringify(defaultTombPropsSettings));
  try {
    const savedProps = localStorage.getItem(PROPS_STORAGE_KEY);
    if (savedProps) {
      const parsed = JSON.parse(savedProps);
      if (parsed.entranceDoor && typeof parsed.entranceDoor === 'object') {
        Object.assign(tombPropsSettings.entranceDoor, parsed.entranceDoor);
      }
      if (Array.isArray(parsed.torches)) {
        tombPropsSettings.torches = parsed.torches
          .filter(torch => Number.isFinite(torch.x) && Number.isFinite(torch.y))
          .map(torch => ({ x: torch.x, y: torch.y, scale: Number.isFinite(torch.scale) ? torch.scale : 1 }));
      }
      if (Array.isArray(parsed.mirrors) && parsed.mirrors.length === 3) {
        tombPropsSettings.mirrors = parsed.mirrors.map((mirror, index) => ({
          ...(defaultTombPropsSettings.mirrors[index]),
          ...mirror
        }));
      }
      if (parsed.sunHeartAltar && typeof parsed.sunHeartAltar === 'object') {
        const altar = parsed.sunHeartAltar;
        if (Number.isFinite(altar.x) && Number.isFinite(altar.y) && Number.isFinite(altar.width)) {
          tombPropsSettings.sunHeartAltar = {
            ...defaultTombPropsSettings.sunHeartAltar,
            ...altar
          };
        }
      }
      if (parsed.beamPoints && typeof parsed.beamPoints === 'object') {
        Object.keys(defaultTombPropsSettings.beamPoints).forEach(key => {
          const point = parsed.beamPoints[key];
          if (Number.isFinite(point?.x) && Number.isFinite(point?.y)) {
            tombPropsSettings.beamPoints[key] = { x: point.x, y: point.y };
          }
        });
      }
    }
  } catch (error) {}
  let transitionTimer = null;
  let tombEditorActive = false;
  let selectedTorchIndex = -1;
  let selectedMirrorIndex = -1;
  let selectedBeamPointKey = null;
  let draggingProp = null;
  let dragOffset = { x: 0, y: 0 };
  let endingRevealTimer = null;
  let endingReturnTimer = null;
  const mirrorFeedbackUntil = [0, 0, 0];
  const mirrorDirectionLabels = ['向左', '直行', '向右'];
  const TOMB_MIRROR_SOLUTION = [0, 1, 2];

  const tombBackgroundImage = new Image();
  tombBackgroundImage.src = 'assets/道具/法老王墓室太陽月亮柱子.png';
  const tombEntranceDoorImage = new Image();
  tombEntranceDoorImage.src = 'assets/道具/往法老大廳的門.png';
  const tombTorchImage = new Image();
  tombTorchImage.src = 'assets/items/torch.png';
  const tombMirrorImage = new Image();
  tombMirrorImage.src = 'assets/道具/銅鏡.png';
  const tombSunHeartAltarImage = new Image();
  tombSunHeartAltarImage.src = 'assets/道具/祭壇愛心.png';
  const tombEmptySunHeartAltarImage = new Image();
  tombEmptySunHeartAltarImage.src = 'assets/道具/愛心祭壇沒有愛心.png';

  const TOMB_MIRROR_BASE_HEIGHT = 185;

  function getTombMirrorBounds(mirror) {
    const height = TOMB_MIRROR_BASE_HEIGHT * mirror.scale;
    const imageRatio = tombMirrorImage.naturalWidth && tombMirrorImage.naturalHeight
      ? tombMirrorImage.naturalWidth / tombMirrorImage.naturalHeight
      : 2 / 3;
    const width = height * imageRatio;
    return {
      x: mirror.x - width / 2,
      y: mirror.y - height,
      width,
      height
    };
  }

  function getTombSunHeartAltarBounds() {
    const altar = tombPropsSettings.sunHeartAltar;
    const imageRatio = tombSunHeartAltarImage.naturalWidth && tombSunHeartAltarImage.naturalHeight
      ? tombSunHeartAltarImage.naturalWidth / tombSunHeartAltarImage.naturalHeight
      : 1.5;
    const height = altar.width / imageRatio;
    return {
      x: altar.x - altar.width / 2,
      y: altar.y - height,
      width: altar.width,
      height
    };
  }

  function drawTombMirrorBacking(ctx, bounds, alpha = 1) {
    const point = (x, y) => [bounds.x + bounds.width * x, bounds.y + bounds.height * y];
    const outline = [
      point(0.5, 0.01), point(0.75, 0.13), point(0.84, 0.34), point(0.83, 0.68),
      point(0.71, 0.76), point(0.64, 0.82), point(0.72, 0.91), point(0.66, 0.98),
      point(0.34, 0.98), point(0.28, 0.91), point(0.36, 0.82), point(0.29, 0.76),
      point(0.17, 0.68), point(0.16, 0.34), point(0.25, 0.13)
    ];

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.94 * alpha;
    ctx.fillStyle = '#21150f';
    ctx.beginPath();
    ctx.moveTo(outline[0][0], outline[0][1]);
    outline.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.closePath();
    ctx.fill();

    const glass = ctx.createLinearGradient(bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height);
    glass.addColorStop(0, '#d8d5c8');
    glass.addColorStop(0.48, '#777b7b');
    glass.addColorStop(1, '#c9bda5');
    ctx.globalAlpha = 0.88 * alpha;
    ctx.fillStyle = glass;
    ctx.fillRect(
      bounds.x + bounds.width * 0.355,
      bounds.y + bounds.height * 0.235,
      bounds.width * 0.29,
      bounds.height * 0.39
    );
    ctx.restore();
  }

  function ensureTombState() {
    Game.progress.scene3Entered ??= false;
    Game.progress.tombMechanismActivated ??= false;
    Game.progress.priestAmuletActivated ??= false;
    Game.progress.priestWarningRead ??= false;
    Game.progress.mirrorsRevealed ??= false;
    Game.progress.mirrorRiseStartedAt ??= 0;
    Game.progress.mirrorMistakes ??= 0;
    Game.progress.mirrorPuzzleSolved ??= false;
    Game.progress.sealedHeartAltarViewed ??= false;
    Game.progress.sunHeartAltarRevealed ??= false;
    Game.progress.tombEscapeActive ??= false;
    Game.progress.sunHeartTaken ??= null;
    Game.progress.endingId ??= null;
    if (!Array.isArray(Game.mirrorState) || Game.mirrorState.length !== 3) {
      Game.mirrorState = [0, 0, 0];
    }
  }

  function revealTombMirrors() {
    Game.progress.mirrorsRevealed = true;
    Game.progress.mirrorRiseStartedAt = performance.now();
    window.triggerDialogue('亞倫・卡特', [
      '「地面正在震動……三面銅鏡從王座前升起了。」',
      '「鏡座上的寶石會指出反射方向。我可以靠近後旋轉它們。」'
    ]);
  }

  function inspectTombThrone() {
    ensureTombState();
    if (Game.progress.tombMechanismActivated || Game.progress.priestAmuletActivated) {
      if (Game.progress.mirrorsRevealed && !Game.progress.mirrorPuzzleSolved) {
        submitTombMirrorPuzzle();
        return;
      }
      if (Game.progress.mirrorPuzzleSolved && Game.progress.sunHeartTaken === null) {
        window.triggerDialogue('亞倫・卡特', [
          '「王座的光路已經完成了。」',
          '「封印的力量正流向右側祭壇……太陽之心應該已經出現了。」'
        ]);
        return;
      }
      window.triggerDialogue('亞倫・卡特', [
        Game.progress.priestAmuletActivated
          ? '「護符已經回到我手中，表面的文字仍帶著溫度。」'
          : '「王座的機關已經啟動，但我沒有守墓者留下的護符。」',
        Game.progress.tombEscapeActive
          ? '「墓室正在崩塌，必須立刻回到左側石門！」'
          : Game.progress.sunHeartTaken === false
            ? '「太陽之心仍留在祭壇上，墓室重新恢復了平靜。」'
            : Game.progress.mirrorPuzzleSolved
          ? '「太陽與月亮的光已經回到王座，封印正在解除。」'
          : '「王座底部的機關似乎還在運轉。」'
      ]);
      return;
    }

    if (!Game.inventory.includes('priest_amulet')) {
      window.triggerDialogue('亞倫・卡特', [
        '「王座底部留著一個護符形狀的凹槽。」',
        '「我身上沒有能與它吻合的東西……但凹槽外圍的文字似乎也是一道啟動機關。」',
        '「沒有護符的保護，也許仍能前進，只是我不會知道守墓祭司留下了什麼警告。」'
      ], () => {
        Game.progress.tombMechanismActivated = true;
        Game.progress.priestWarningRead = false;
        window.triggerDialogue('古墓的聲音', [
          '『日與月皆為見證。讓光回歸王之心。』'
        ], revealTombMirrors);
      });
      return;
    }

    window.triggerDialogue('亞倫・卡特', [
      '「這個凹槽和祭司護符完全吻合。」',
      '「護符被凹槽吸住了……上面的文字正在發光。」'
    ], () => {
      Game.progress.tombMechanismActivated = true;
      Game.progress.priestAmuletActivated = true;
      Game.progress.priestWarningRead = true;
      window.triggerDialogue('祭司涅布的殘響', [
        '『後來者，太陽之心並非法老王的陪葬財寶。』',
        '『它維繫著光明、封印與整座墓室。若你仍要將它帶走，願這枚護符替你承受王的憤怒。』',
        '『讓光先行於日，再沉入月，最後回歸王之心。』'
      ], revealTombMirrors);
    });
  }

  function rotateTombMirror(index) {
    if (!Game.progress.mirrorsRevealed || Game.progress.mirrorPuzzleSolved) return;
    Game.mirrorState[index] = (Game.mirrorState[index] + 1) % mirrorDirectionLabels.length;
    mirrorFeedbackUntil[index] = performance.now() + 900;
  }

  function isTombMirrorSolutionReady() {
    return TOMB_MIRROR_SOLUTION.every((direction, index) => Game.mirrorState[index] === direction);
  }

  function inspectSunHeartAltar() {
    ensureTombState();

    if (Game.progress.sunHeartTaken === true) {
      window.triggerDialogue('亞倫・卡特', [
        '「祭壇中央只剩下一道空的凹槽。」',
        '「太陽之心已經被我取下，墓室也開始失去支撐了。」'
      ]);
      return;
    }

    if (Game.progress.sunHeartTaken === false) {
      window.triggerDialogue('亞倫・卡特', [
        '「太陽之心仍安穩地懸浮在祭壇上。」',
        '「讓它留在這裡，才不會破壞延續了三千年的封印。」'
      ]);
      return;
    }

    if (!Game.progress.mirrorPuzzleSolved) {
      Game.progress.sealedHeartAltarViewed = true;
      const lines = Game.progress.mirrorsRevealed
        ? [
            '「祭壇中央封著一顆如心臟般的金色核心。」',
            '「光線還沒有抵達這裡。三面銅鏡的位置一定還不對。」'
          ]
        : [
            '「祭壇中央封著一顆如心臟般的金色核心。」',
            '「鎖鏈與太陽、月亮的刻紋彼此相連……現在還無法取下。」',
            '「中央王座上的機關，也許控制著這道封印。」'
          ];
      window.triggerDialogue('亞倫・卡特', lines);
      return;
    }

    Game.progress.sunHeartAltarRevealed = true;
    window.triggerDialogue('亞倫・卡特', [
      '「封印的鎖鏈已經鬆開……太陽之心仍嵌在祭壇中央。」',
      '「現在最後的問題，只剩下我是否該將它帶走。」'
    ], showSunHeartChoice);
  }

  function completeTombEndingReveal() {
    const overlay = document.getElementById('tomb-ending-overlay');
    if (!overlay) return;
    if (endingRevealTimer) {
      clearTimeout(endingRevealTimer);
      endingRevealTimer = null;
    }
    overlay.classList.add('is-complete');
    document.getElementById('tomb-ending-skip-btn')?.classList.add('hidden');
    if (endingReturnTimer) clearTimeout(endingReturnTimer);
    endingReturnTimer = setTimeout(() => {
      // 先把主頁準備在結局層下方，再淡出結局；避免淡出途中露出墓室場景。
      window.returnToMainMenu?.();
      overlay.classList.add('is-leaving');
      endingReturnTimer = setTimeout(() => {
        endingReturnTimer = null;
        overlay.classList.add('hidden');
        overlay.classList.remove('is-active', 'is-complete', 'is-leaving');
        overlay.setAttribute('aria-hidden', 'true');
      }, 900);
    }, 1800);
  }

  function showTombEnding({ id, title, lines = [], summary, epilogue, allowCheckpoint = false }) {
    Game.progress.endingId = id;
    Game.progress.tombEscapeActive = false;
    Game.state = 'ENDING';
    if (Game.timer) Game.timer.isRunning = false;

    const overlay = document.getElementById('tomb-ending-overlay');
    const titleEl = document.getElementById('tomb-ending-title');
    const storyEl = document.getElementById('tomb-ending-story');
    const skipButton = document.getElementById('tomb-ending-skip-btn');
    const checkpointButton = document.getElementById('tomb-ending-checkpoint-btn');
    const actionsEl = overlay?.querySelector?.('.tomb-ending-actions');
    if (titleEl) titleEl.textContent = title;
    const storyLines = lines.length ? lines : [summary, epilogue].filter(Boolean);
    if (storyEl) {
      storyEl.replaceChildren();
      storyLines.forEach((line, index) => {
        const paragraph = document.createElement('p');
        paragraph.className = 'tomb-ending-line ending-scene-reveal';
        paragraph.textContent = line;
        paragraph.style.setProperty('--ending-step', index + 2);
        storyEl.appendChild(paragraph);
      });
    }
    if (checkpointButton) {
      const canRestore = Boolean(allowCheckpoint && window.getGameCheckpointSummary?.());
      checkpointButton.classList.toggle('hidden', !canRestore);
      checkpointButton.onclick = canRestore ? () => {
        if (endingRevealTimer) clearTimeout(endingRevealTimer);
        if (endingReturnTimer) clearTimeout(endingReturnTimer);
        endingRevealTimer = null;
        endingReturnTimer = null;
        window.restoreGameCheckpoint?.();
      } : null;
      actionsEl?.classList.toggle('hidden', !canRestore);
    }
    actionsEl?.style.setProperty('--ending-step', storyLines.length + 2);
    if (skipButton) {
      skipButton.classList.remove('hidden');
      skipButton.onclick = completeTombEndingReveal;
    }
    if (!overlay) return;
    if (endingRevealTimer) clearTimeout(endingRevealTimer);
    if (endingReturnTimer) clearTimeout(endingReturnTimer);
    endingReturnTimer = null;
    overlay.classList.remove('hidden', 'is-active', 'is-complete');
    overlay.setAttribute('aria-hidden', 'false');
    void overlay.offsetWidth;
    overlay.classList.add('is-active');
    const revealDuration = Math.max(3600, 1450 + storyLines.length * 820);
    endingRevealTimer = setTimeout(completeTombEndingReveal, revealDuration);
  }

  function finishTombEscape() {
    if (!Game.progress.tombEscapeActive) return false;
    showTombEnding({
      id: 'normal_taken_seal',
      title: 'NORMAL END：被帶走的封印',
      lines: [
        '祭司護符在崩塌中發出耀眼的光芒，替亞倫擋下墜落的碎石。',
        '他穿過即將封閉的通道，終於在古墓徹底崩塌前逃回地面。',
        '亞倫回頭望去，只看見入口再次被黃沙掩埋。',
        '數月後，太陽之心被放入現代博物館的展示櫃。',
        '夜深時，無人的展廳裡再次亮起一抹微弱的金色光芒。'
      ]
    });
    return true;
  }

  function activateTombEscape() {
    Game.progress.tombEscapeActive = true;
    Game.state = 'PLAYING';
    window.triggerScreenShake?.(9, 1300);
    window.triggerDialogue('祭司涅布的殘響', [
      '『你選擇帶走它，至少記得它曾經保護過你。』',
      '『護符會替你擋下王的憤怒。回到左側石門，離開這座正在崩塌的墓室。』'
    ]);
  }

  function chooseSunHeart(choice) {
    if (!Game.progress.mirrorPuzzleSolved || Game.progress.sunHeartTaken !== null) return false;
    document.getElementById('sun-heart-choice-overlay')?.classList.add('hidden');
    document.getElementById('game-container')?.classList.remove('final-choice-active');
    document.activeElement?.blur?.();

    if (choice === 'leave') {
      Game.progress.sunHeartTaken = false;
      window.triggerDialogue('亞倫・卡特', [
        '「我會記錄它，但不會帶走它。這不是屬於我的寶物。」'
      ], () => {
        window.triggerDialogue('法老王幻影', [
          '『真正的寶藏，並非黃金，而是理解歷史的智慧。』'
        ], () => {
          showTombEnding({
            id: 'true_guardian',
            title: 'TRUE END：歷史的守護者',
            lines: [
              '亞倫收回了伸向太陽之心的手。',
              '金色光芒重新沉入祭壇，墓室的震動也逐漸平息。',
              '石門在低沉的轟鳴中開啟，為他讓出一條安全的離開通道。',
              '他帶回了完整的考古紀錄，卻沒有取走任何不屬於自己的寶物。'
            ]
          });
        });
      });
      return true;
    }

    if (choice !== 'take') return false;
    Game.progress.sunHeartTaken = true;
    window.triggerDialogue('亞倫・卡特', [
      '「這項發現足以改寫整個考古學界。我不能把它永遠留在黑暗裡。」',
      '「糟了……太陽之心離開祭壇後，整座墓室開始崩塌了！」'
    ], () => {
      if (Game.inventory.includes('priest_amulet') || Game.progress.priestAmuletFound) {
        activateTombEscape();
      } else {
        window.triggerScreenShake?.(11, 1600);
        showTombEnding({
          id: 'bad_entombed',
          title: 'BAD END：永眠於古墓',
          lines: [
            '太陽之心離開祭壇的瞬間，墓室裡所有光芒同時熄滅。',
            '失去護符的保護，亞倫只能在落石間奔向來時的入口。',
            '然而出口已被巨石封死，黑暗中只剩法老王最後的低語。',
            '『又一位被黃金蒙蔽雙眼的人。』'
          ],
          allowCheckpoint: true
        });
      }
    });
    return true;
  }

  function showSunHeartChoice() {
    if (!Game.progress.mirrorPuzzleSolved || Game.progress.sunHeartTaken !== null) return false;
    const overlay = document.getElementById('sun-heart-choice-overlay');
    const takeButton = document.getElementById('take-sun-heart-btn');
    const leaveButton = document.getElementById('leave-sun-heart-btn');
    if (!overlay || !takeButton || !leaveButton) return false;

    Game.state = 'FINAL_CHOICE';
    if (window.keys) {
      keys.a = false;
      keys.d = false;
    }
    if (window.player) {
      player.vx = 0;
      player.isWalking = false;
    }
    document.getElementById('game-container')?.classList.add('final-choice-active');
    overlay.classList.remove('hidden');
    takeButton.onclick = () => chooseSunHeart('take');
    leaveButton.onclick = () => chooseSunHeart('leave');
    takeButton.focus?.();
    return true;
  }

  function handleSunHeartChoiceKey(event) {
    if (Game.state !== 'FINAL_CHOICE') return false;
    const takeButton = document.getElementById('take-sun-heart-btn');
    const leaveButton = document.getElementById('leave-sun-heart-btn');
    if (!takeButton || !leaveButton) return false;

    const key = event?.key || '';
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
      takeButton.focus?.();
      event?.preventDefault?.();
      return true;
    }
    if (key === 'ArrowRight' || key === 'd' || key === 'D') {
      leaveButton.focus?.();
      event?.preventDefault?.();
      return true;
    }
    if (key === 'e' || key === 'E') {
      const choice = document.activeElement === leaveButton ? 'leave' : 'take';
      event?.preventDefault?.();
      return chooseSunHeart(choice);
    }
    return false;
  }

  function interactTombEntrance() {
    if (Game.progress.tombEscapeActive) {
      finishTombEscape();
      return;
    }
    window.triggerDialogue('亞倫・卡特', [
      '「身後的石門已經關上。只有完成最後的試煉，才能離開這座墓室。」'
    ]);
  }

  function submitTombMirrorPuzzle() {
    ensureTombState();
    if (!Game.progress.mirrorsRevealed || Game.progress.mirrorPuzzleSolved) return false;
    const solved = isTombMirrorSolutionReady();

    if (!solved) {
      Game.progress.mirrorMistakes += 1;
      if (Game.timer) {
        Game.timer.remainingSeconds = Math.max(0, Game.timer.remainingSeconds - 10);
        if (window.updateTimerDisplay) window.updateTimerDisplay();
      }
      window.triggerDialogue('古墓的聲音', [
        '『光路中斷。日與月尚未回應王之心。』',
        '「鏡子的位置沒有被重設，我可以沿著目前亮起的光線繼續調整。」'
      ]);
      return false;
    }

    Game.progress.mirrorPuzzleSolved = true;
    if (Game.timer) {
      Game.timer.isRunning = false;
      Game.timer.lastTick = 0;
    }
    window.triggerDialogue('法老王幻影', [
      '『光已回歸王之心。右側祭壇的封印已開。』',
      '『前往太陽之心面前，讓你的選擇證明你是記錄者，還是掠奪者。』'
    ]);
    return true;
  }

  const pharaohTombSceneObjects = [
    {
      id: 'tomb_entrance',
      x: 70,
      y: 410,
      width: 130,
      height: 220,
      label: '審判室入口',
      onInteract: interactTombEntrance
    },
    {
      id: 'tomb_throne',
      x: 1000,
      y: 320,
      width: 250,
      height: 260,
      label: '中央王座的護符凹槽',
      onInteract: inspectTombThrone
    },
    {
      id: 'tomb_sun_heart_altar',
      x: defaultTombPropsSettings.sunHeartAltar.x,
      y: defaultTombPropsSettings.sunHeartAltar.y,
      width: defaultTombPropsSettings.sunHeartAltar.width,
      height: 250,
      interactionRadius: 125,
      label: '封印中的太陽之心祭壇',
      onInteract: inspectSunHeartAltar
    },
    ...[0, 1, 2].map(index => ({
      id: `tomb_mirror_${index}`,
      x: defaultTombPropsSettings.mirrors[index].x,
      y: defaultTombPropsSettings.mirrors[index].y - TOMB_MIRROR_BASE_HEIGHT / 2,
      width: 120,
      height: TOMB_MIRROR_BASE_HEIGHT,
      label: `銅鏡${['一', '二', '三'][index]}`,
      promptVerb: '旋轉',
      isAvailable: () => Boolean(
        Game.progress.mirrorsRevealed
        && !Game.progress.mirrorPuzzleSolved
        && !isTombMirrorSolutionReady()
      ),
      onInteract: () => rotateTombMirror(index)
    }))
  ];

  function syncTombInteractiveObjects() {
    const door = tombPropsSettings.entranceDoor;
    const entrance = pharaohTombSceneObjects.find(object => object.id === 'tomb_entrance');
    if (entrance) {
      Object.assign(entrance, door);
      entrance.label = Game.progress.tombEscapeActive ? '逃離墓室' : '審判室入口';
      entrance.promptVerb = Game.progress.tombEscapeActive ? '逃離' : '調查';
    }

    const throne = pharaohTombSceneObjects.find(object => object.id === 'tomb_throne');
    if (throne) {
      if (Game.progress.mirrorsRevealed && !Game.progress.mirrorPuzzleSolved) {
        throne.label = '王座光路機關';
        throne.promptVerb = '啟動';
      } else if (Game.progress.mirrorPuzzleSolved) {
        throne.label = '已完成的王座光路機關';
        throne.promptVerb = '調查';
      } else {
        throne.label = '中央王座的護符凹槽';
        throne.promptVerb = '調查';
      }
    }

    const altar = pharaohTombSceneObjects.find(object => object.id === 'tomb_sun_heart_altar');
    if (altar) {
      const bounds = getTombSunHeartAltarBounds();
      altar.x = tombPropsSettings.sunHeartAltar.x;
      altar.y = bounds.y + bounds.height / 2;
      altar.width = bounds.width;
      altar.height = bounds.height;
      altar.promptVerb = Game.progress.mirrorPuzzleSolved && Game.progress.sunHeartTaken === null
        ? '觸碰'
        : '調查';
      altar.label = Game.progress.sunHeartTaken === true
        ? '空的太陽之心祭壇'
        : Game.progress.sunHeartTaken === false
          ? '留在祭壇的太陽之心'
          : '封印中的太陽之心祭壇';
    }

    tombPropsSettings.mirrors.forEach((mirror, index) => {
      const object = pharaohTombSceneObjects.find(item => item.id === `tomb_mirror_${index}`);
      if (!object) return;
      const bounds = getTombMirrorBounds(mirror);
      object.x = mirror.x;
      object.y = bounds.y + bounds.height / 2;
      object.width = bounds.width;
      object.height = bounds.height;
    });
  }

  async function enterPharaohTomb() {
    if (Game.currentScene === SCENE_ID) return;
    if (Game.inCutscene && window.skipOpeningCutscene) window.skipOpeningCutscene();
    ensureTombState();

    Game.state = 'CUTSCENE';
    Game.currentInteractiveTarget = null;
    if (window.preloadSceneAssets) {
      await window.preloadSceneAssets('tomb', '正在開啟法老王墓室……');
    }
    const fade = document.getElementById('screen-fade');
    if (fade) {
      fade.classList.remove('fade-out');
      fade.classList.add('fade-in');
    }

    if (transitionTimer) clearTimeout(transitionTimer);
    transitionTimer = setTimeout(() => {
      Game.currentScene = SCENE_ID;
      Game.progress.scene3Entered = true;
      Game.sceneObjects = pharaohTombSceneObjects;
      Game.worldWidth = WORLD_WIDTH;
      Game.entranceBlocked = false;
      Game.fallingRocks = [];
      Game.dustParticles = [];
      Game.particles = [];
      Game.cameraX = 0;
      Game.cameraTargetX = null;

      if (window.player) {
        player.x = 180;
        player.y = tombLayoutSettings.playerFloorY;
        player.direction = 1;
        player.vx = 0;
        player.isWalking = false;
        player.autoWalkTarget = null;
        player.autoWalkCallback = null;
      }

      if (window.createGameCheckpoint) {
        window.createGameCheckpoint('法老王墓室入口');
      }

      if (fade) {
        fade.classList.remove('fade-in');
        fade.classList.add('fade-out');
      }

      transitionTimer = setTimeout(() => {
        window.triggerDialogue('法老王幻影', [
          '『你已經走到王的最後一扇門前。現在，讓光線回答你的問題。』'
        ], () => {
          window.triggerDialogue('亞倫・卡特', [
            '「太陽之心不是被藏起來，而是被連接在整座墓室的機關裡。」',
            '「這裡還缺少能引導光線的裝置。我得先看清整座墓室的構造。」'
          ]);
        });
      }, 550);
    }, 850);
  }

  function drawPharaohTombBackground(ctx) {
    Game.worldWidth = WORLD_WIDTH;
    ctx.fillStyle = '#0b0806';
    ctx.fillRect(0, 0, WORLD_WIDTH, Game.height);

    if (tombBackgroundImage.complete && tombBackgroundImage.naturalWidth) {
      const baseScale = Math.max(
        WORLD_WIDTH / tombBackgroundImage.naturalWidth,
        Game.height / tombBackgroundImage.naturalHeight
      );
      const scale = baseScale * tombLayoutSettings.backgroundScale;
      const drawWidth = tombBackgroundImage.naturalWidth * scale;
      const drawHeight = tombBackgroundImage.naturalHeight * scale;
      const drawX = (WORLD_WIDTH - drawWidth) / 2;
      const drawY = (Game.height - drawHeight) / 2 + tombLayoutSettings.backgroundOffsetY;
      ctx.drawImage(tombBackgroundImage, drawX, drawY, drawWidth, drawHeight);
    } else {
      const glow = ctx.createRadialGradient(WORLD_WIDTH / 2, 220, 10, WORLD_WIDTH / 2, 220, 520);
      glow.addColorStop(0, 'rgba(182, 121, 43, 0.32)');
      glow.addColorStop(1, 'rgba(11, 8, 6, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, WORLD_WIDTH, Game.height);
    }

    // 新背景已內建地板，不再額外疊加共用 floor.png。
    if (window.player) player.y = tombLayoutSettings.playerFloorY;
  }

  function drawTombBeam(ctx, from, to, color = '255, 214, 92') {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(${color}, 0.2)`;
    ctx.lineWidth = 12;
    ctx.shadowColor = `rgba(${color}, 0.85)`;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.strokeStyle = `rgba(${color}, 0.9)`;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();
  }

  function getWrongBeamTarget(origin, direction) {
    if (direction === 0) return { x: origin.x - 190, y: origin.y - 70 };
    if (direction === 2) return { x: origin.x + 190, y: origin.y - 70 };
    return { x: origin.x, y: origin.y - 175 };
  }

  function drawTombMirrorLightPath(ctx) {
    if (!Game.progress.mirrorsRevealed && !tombEditorActive) return;
    const mirrors = tombPropsSettings.mirrors.map(mirror => {
      const bounds = getTombMirrorBounds(mirror);
      return { x: mirror.x, y: bounds.y + bounds.height * 0.42 };
    });
    const { source, sun, moon, throne } = tombPropsSettings.beamPoints;

    drawTombBeam(ctx, source, mirrors[0]);
    if (!tombEditorActive && Game.mirrorState[0] !== TOMB_MIRROR_SOLUTION[0]) {
      drawTombBeam(ctx, mirrors[0], getWrongBeamTarget(mirrors[0], Game.mirrorState[0]), '255, 126, 58');
      return;
    }

    drawTombBeam(ctx, mirrors[0], sun);
    drawTombBeam(ctx, sun, mirrors[1]);
    if (!tombEditorActive && Game.mirrorState[1] !== TOMB_MIRROR_SOLUTION[1]) {
      drawTombBeam(ctx, mirrors[1], getWrongBeamTarget(mirrors[1], Game.mirrorState[1]), '255, 126, 58');
      return;
    }

    drawTombBeam(ctx, mirrors[1], moon, '180, 218, 255');
    drawTombBeam(ctx, moon, mirrors[2], '180, 218, 255');
    if (!tombEditorActive && Game.mirrorState[2] !== TOMB_MIRROR_SOLUTION[2]) {
      drawTombBeam(ctx, mirrors[2], getWrongBeamTarget(mirrors[2], Game.mirrorState[2]), '255, 126, 58');
      return;
    }

    drawTombBeam(ctx, mirrors[2], throne, '255, 239, 166');
    if (Game.progress.mirrorPuzzleSolved) {
      const altarBounds = getTombSunHeartAltarBounds();
      drawTombBeam(ctx, throne, {
        x: altarBounds.x + altarBounds.width * 0.5,
        y: altarBounds.y + altarBounds.height * 0.45
      }, '255, 239, 166');
    }
  }

  function drawPharaohTombSceneObjects() {
    const ctx = arguments[0];
    if (!ctx) return;
    syncTombInteractiveObjects();
    const door = tombPropsSettings.entranceDoor;

    if (tombEntranceDoorImage.complete && tombEntranceDoorImage.naturalWidth) {
      ctx.drawImage(
        tombEntranceDoorImage,
        door.x - door.width / 2,
        door.y - door.height / 2,
        door.width,
        door.height
      );
    }

    if (Game.progress.tombEscapeActive) {
      const escapePulse = (Math.sin(performance.now() * 0.008) + 1) / 2;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const exitGlow = ctx.createRadialGradient(door.x, door.y, 20, door.x, door.y, Math.max(door.width, door.height) * 0.72);
      exitGlow.addColorStop(0, `rgba(255, 239, 166, ${0.34 + escapePulse * 0.2})`);
      exitGlow.addColorStop(0.48, 'rgba(255, 173, 48, 0.2)');
      exitGlow.addColorStop(1, 'rgba(255, 92, 25, 0)');
      ctx.fillStyle = exitGlow;
      ctx.beginPath();
      ctx.arc(door.x, door.y, Math.max(door.width, door.height) * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    tombPropsSettings.torches.forEach((torch, index) => {
      const width = 24 * torch.scale;
      const height = 112 * torch.scale;
      const flameY = torch.y - height * 0.38;
      const flicker = Math.sin(performance.now() * 0.012 + index * 1.9) * 4;
      const glowRadius = 145 * torch.scale + flicker;

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const glow = ctx.createRadialGradient(torch.x, flameY, 4, torch.x, flameY, glowRadius);
      glow.addColorStop(0, 'rgba(255, 224, 135, 0.76)');
      glow.addColorStop(0.38, 'rgba(255, 151, 38, 0.28)');
      glow.addColorStop(1, 'rgba(255, 93, 12, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(torch.x, flameY, glowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (tombTorchImage.complete && tombTorchImage.naturalWidth) {
        ctx.drawImage(tombTorchImage, torch.x - width / 2, torch.y - height / 2, width, height);
      }
    });

    const sunHeartAltarBounds = getTombSunHeartAltarBounds();
    const altarImage = Game.progress.sunHeartTaken === true
      ? tombEmptySunHeartAltarImage
      : tombSunHeartAltarImage;
    if (altarImage.complete && altarImage.naturalWidth) {
      ctx.save();
      // 素材周圍是深色背景，screen 混合可保留祭壇輪廓而不蓋住墓室。
      ctx.globalCompositeOperation = 'screen';
      ctx.filter = 'brightness(1.08) saturate(1.04) contrast(1.08)';
      ctx.drawImage(
        altarImage,
        sunHeartAltarBounds.x,
        sunHeartAltarBounds.y,
        sunHeartAltarBounds.width,
        sunHeartAltarBounds.height
      );
      ctx.restore();
    }

    const throneGlowX = WORLD_WIDTH / 2;
    const throneGlowY = 377;
    const thronePulse = (Math.sin(performance.now() * 0.004) + 1) / 2;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const throneGlow = ctx.createRadialGradient(throneGlowX, throneGlowY, 4, throneGlowX, throneGlowY, 52);
    const throneAlpha = Game.progress.sunHeartTaken === true
      ? 0.06
      : Game.progress.priestAmuletActivated
        ? 0.38
        : Game.progress.tombMechanismActivated
          ? 0.27
          : 0.18 + thronePulse * 0.18;
    throneGlow.addColorStop(0, `rgba(255, 231, 139, ${throneAlpha})`);
    throneGlow.addColorStop(0.45, `rgba(255, 183, 59, ${throneAlpha * 0.55})`);
    throneGlow.addColorStop(1, 'rgba(255, 142, 32, 0)');
    ctx.fillStyle = throneGlow;
    ctx.beginPath();
    ctx.arc(throneGlowX, throneGlowY, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const shouldDrawMirrors = Game.progress.mirrorsRevealed || tombEditorActive;
    if (shouldDrawMirrors && tombMirrorImage.complete && tombMirrorImage.naturalWidth) {
      const now = performance.now();
      tombPropsSettings.mirrors.forEach((mirror, index) => {
        let riseProgress = 1;
        if (!tombEditorActive && Game.progress.mirrorRiseStartedAt) {
          const elapsed = now - Game.progress.mirrorRiseStartedAt - index * 180;
          riseProgress = Math.max(0, Math.min(1, elapsed / 820));
          riseProgress = 1 - Math.pow(1 - riseProgress, 3);
        }
        if (riseProgress <= 0) return;

        const displayMirror = {
          ...mirror,
          y: mirror.y + (1 - riseProgress) * 150
        };
        const bounds = getTombMirrorBounds(displayMirror);
        drawTombMirrorBacking(ctx, bounds, Math.max(0.35, riseProgress));
        ctx.save();
        // 原始圖的黑色區域在 screen 混合下不覆蓋墓室，棕色漸層則成為微弱光暈。
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = Math.max(0.2, riseProgress);
        ctx.filter = 'brightness(1.18) saturate(1.08) contrast(1.06)';
        ctx.drawImage(tombMirrorImage, bounds.x, bounds.y, bounds.width, bounds.height);

        const direction = Game.mirrorState[index] ?? 0;
        const gemPositions = [
          { x: bounds.x + bounds.width * 0.24, y: bounds.y + bounds.height * 0.39, color: '255, 75, 28' },
          { x: bounds.x + bounds.width * 0.5, y: bounds.y + bounds.height * 0.11, color: '255, 222, 92' },
          { x: bounds.x + bounds.width * 0.76, y: bounds.y + bounds.height * 0.39, color: '255, 75, 28' }
        ];
        const activeGem = gemPositions[direction];
        const gemGlow = ctx.createRadialGradient(activeGem.x, activeGem.y, 2, activeGem.x, activeGem.y, 22 * mirror.scale);
        gemGlow.addColorStop(0, `rgba(${activeGem.color}, 0.95)`);
        gemGlow.addColorStop(0.4, `rgba(${activeGem.color}, 0.52)`);
        gemGlow.addColorStop(1, `rgba(${activeGem.color}, 0)`);
        ctx.fillStyle = gemGlow;
        ctx.beginPath();
        ctx.arc(activeGem.x, activeGem.y, 22 * mirror.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (!Game.progress.mirrorPuzzleSolved) {
          const recentlyChanged = mirrorFeedbackUntil[index] > now;
          ctx.save();
          ctx.fillStyle = recentlyChanged ? '#fff1a6' : 'rgba(214, 239, 247, 0.82)';
          ctx.font = `${recentlyChanged ? 'bold ' : ''}${recentlyChanged ? 17 : 15}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.shadowColor = '#000';
          ctx.shadowBlur = recentlyChanged ? 6 : 4;
          ctx.fillText(`鏡${index + 1}：${mirrorDirectionLabels[Game.mirrorState[index]]}`, mirror.x, bounds.y - 14);
          ctx.restore();
        }
      });
      drawTombMirrorLightPath(ctx);
    }

    if (tombEditorActive) {
      ctx.save();
      ctx.strokeStyle = '#ffe477';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.strokeRect(door.x - door.width / 2, door.y - door.height / 2, door.width, door.height);
      tombPropsSettings.torches.forEach((torch, index) => {
        const width = 24 * torch.scale;
        const height = 112 * torch.scale;
        ctx.strokeStyle = index === selectedTorchIndex ? '#fff4a8' : 'rgba(255, 210, 78, 0.55)';
        ctx.strokeRect(torch.x - width / 2 - 6, torch.y - height / 2 - 6, width + 12, height + 12);
      });
      tombPropsSettings.mirrors.forEach((mirror, index) => {
        const bounds = getTombMirrorBounds(mirror);
        ctx.strokeStyle = index === selectedMirrorIndex ? '#9fe8ff' : 'rgba(117, 201, 232, 0.6)';
        ctx.strokeRect(bounds.x - 6, bounds.y - 6, bounds.width + 12, bounds.height + 12);
        ctx.fillStyle = index === selectedMirrorIndex ? '#d9f8ff' : '#aadce8';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`鏡 ${index + 1}`, mirror.x, bounds.y - 12);
      });
      const beamPointLabels = { source: '光源', sun: '太陽柱', moon: '月亮柱', throne: '王座' };
      Object.entries(tombPropsSettings.beamPoints).forEach(([key, point]) => {
        const selected = key === selectedBeamPointKey;
        ctx.setLineDash([]);
        ctx.fillStyle = selected ? '#fff4a8' : '#76d9ff';
        ctx.strokeStyle = selected ? '#ffbe3b' : '#173948';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(point.x, point.y, selected ? 11 : 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = selected ? '#fff4a8' : '#bcefff';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(beamPointLabels[key], point.x, Math.max(18, point.y - 15));
      });
      ctx.restore();
    }
  }

  function applyPharaohTombLighting(ctx) {
    ctx.save();
    const darkness = document.createElement('canvas');
    darkness.width = Game.width;
    darkness.height = Game.height;
    const lightCtx = darkness.getContext('2d');
    lightCtx.fillStyle = 'rgba(5, 4, 4, 0.46)';
    lightCtx.fillRect(0, 0, Game.width, Game.height);
    lightCtx.globalCompositeOperation = 'destination-out';

    tombPropsSettings.torches.forEach((torch, index) => {
      const screenX = torch.x - Game.cameraX;
      if (screenX < -320 || screenX > Game.width + 320) return;
      const height = 112 * torch.scale;
      const flameY = torch.y - height * 0.38;
      const flicker = Math.sin(performance.now() * 0.012 + index * 1.9) * 7;
      const radius = 220 * torch.scale + flicker;
      const light = lightCtx.createRadialGradient(screenX, flameY, 8, screenX, flameY, radius);
      light.addColorStop(0, 'rgba(0, 0, 0, 1)');
      light.addColorStop(0.5, 'rgba(0, 0, 0, 0.78)');
      light.addColorStop(1, 'rgba(0, 0, 0, 0)');
      lightCtx.fillStyle = light;
      lightCtx.beginPath();
      lightCtx.arc(screenX, flameY, radius, 0, Math.PI * 2);
      lightCtx.fill();
    });

    ctx.drawImage(darkness, 0, 0);
    ctx.restore();
  }

  function saveTombLayoutSettings() {
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(tombLayoutSettings));
    } catch (error) {}
  }

  function saveTombPropsSettings() {
    try {
      localStorage.setItem(PROPS_STORAGE_KEY, JSON.stringify(tombPropsSettings));
    } catch (error) {}
  }

  function setupTombLayoutEditor() {
    const toggle = document.getElementById('tomb-editor-toggle');
    const toolbar = document.getElementById('tomb-editor-toolbar');
    const close = document.getElementById('tomb-editor-close');
    const reset = document.getElementById('tomb-editor-reset');
    const controls = {
      backgroundScale: document.getElementById('tomb-bg-scale'),
      backgroundOffsetY: document.getElementById('tomb-bg-y'),
      playerScale: document.getElementById('tomb-player-scale'),
      playerFloorY: document.getElementById('tomb-player-y')
    };
    const outputs = {
      backgroundScale: document.getElementById('tomb-bg-scale-value'),
      backgroundOffsetY: document.getElementById('tomb-bg-y-value'),
      playerScale: document.getElementById('tomb-player-scale-value'),
      playerFloorY: document.getElementById('tomb-player-y-value')
    };
    const doorControls = {
      x: document.getElementById('tomb-door-x'),
      y: document.getElementById('tomb-door-y'),
      width: document.getElementById('tomb-door-width'),
      height: document.getElementById('tomb-door-height')
    };
    const doorOutputs = {
      x: document.getElementById('tomb-door-x-value'),
      y: document.getElementById('tomb-door-y-value'),
      width: document.getElementById('tomb-door-width-value'),
      height: document.getElementById('tomb-door-height-value')
    };
    const torchControls = {
      x: document.getElementById('tomb-torch-x'),
      y: document.getElementById('tomb-torch-y'),
      scale: document.getElementById('tomb-torch-scale')
    };
    const torchOutputs = {
      x: document.getElementById('tomb-torch-x-value'),
      y: document.getElementById('tomb-torch-y-value'),
      scale: document.getElementById('tomb-torch-scale-value')
    };
    const torchStatus = document.getElementById('tomb-torch-status');
    const addTorch = document.getElementById('tomb-torch-add');
    const deleteTorch = document.getElementById('tomb-torch-delete');
    const mirrorControls = {
      x: document.getElementById('tomb-mirror-x'),
      y: document.getElementById('tomb-mirror-y'),
      scale: document.getElementById('tomb-mirror-scale')
    };
    const mirrorOutputs = {
      x: document.getElementById('tomb-mirror-x-value'),
      y: document.getElementById('tomb-mirror-y-value'),
      scale: document.getElementById('tomb-mirror-scale-value')
    };
    const mirrorStatus = document.getElementById('tomb-mirror-status');
    const mirrorButtons = [...(document.querySelectorAll?.('[data-tomb-mirror]') || [])];
    const beamPointControls = {
      x: document.getElementById('tomb-beam-point-x'),
      y: document.getElementById('tomb-beam-point-y')
    };
    const beamPointOutputs = {
      x: document.getElementById('tomb-beam-point-x-value'),
      y: document.getElementById('tomb-beam-point-y-value')
    };
    const beamPointStatus = document.getElementById('tomb-beam-point-status');
    const beamPointButtons = [...(document.querySelectorAll?.('[data-tomb-beam-point]') || [])];
    const beamPointLabels = { source: '光源', sun: '太陽柱', moon: '月亮柱', throne: '王座' };

    function syncEditor() {
      if (controls.backgroundScale) controls.backgroundScale.value = Math.round(tombLayoutSettings.backgroundScale * 100);
      if (controls.backgroundOffsetY) controls.backgroundOffsetY.value = tombLayoutSettings.backgroundOffsetY;
      if (controls.playerScale) controls.playerScale.value = Math.round(tombLayoutSettings.playerScale * 100);
      if (controls.playerFloorY) controls.playerFloorY.value = tombLayoutSettings.playerFloorY;
      if (outputs.backgroundScale) outputs.backgroundScale.textContent = `${Math.round(tombLayoutSettings.backgroundScale * 100)}%`;
      if (outputs.backgroundOffsetY) outputs.backgroundOffsetY.textContent = Math.round(tombLayoutSettings.backgroundOffsetY);
      if (outputs.playerScale) outputs.playerScale.textContent = `${Math.round(tombLayoutSettings.playerScale * 100)}%`;
      if (outputs.playerFloorY) outputs.playerFloorY.textContent = Math.round(tombLayoutSettings.playerFloorY);
      Object.entries(doorControls).forEach(([key, control]) => {
        if (control) control.value = tombPropsSettings.entranceDoor[key];
        if (doorOutputs[key]) doorOutputs[key].textContent = Math.round(tombPropsSettings.entranceDoor[key]);
      });

      const selectedTorch = tombPropsSettings.torches[selectedTorchIndex];
      Object.entries(torchControls).forEach(([key, control]) => {
        if (!control) return;
        control.disabled = !selectedTorch;
        if (selectedTorch) control.value = key === 'scale' ? Math.round(selectedTorch.scale * 100) : selectedTorch[key];
      });
      if (torchOutputs.x) torchOutputs.x.textContent = selectedTorch ? Math.round(selectedTorch.x) : '—';
      if (torchOutputs.y) torchOutputs.y.textContent = selectedTorch ? Math.round(selectedTorch.y) : '—';
      if (torchOutputs.scale) torchOutputs.scale.textContent = selectedTorch ? `${Math.round(selectedTorch.scale * 100)}%` : '—';
      if (torchStatus) {
        torchStatus.textContent = selectedTorch
          ? `火把 ${selectedTorchIndex + 1} / ${tombPropsSettings.torches.length}`
          : `共 ${tombPropsSettings.torches.length} 支`;
      }
      if (deleteTorch) deleteTorch.disabled = !selectedTorch;

      const selectedMirror = tombPropsSettings.mirrors[selectedMirrorIndex];
      Object.entries(mirrorControls).forEach(([key, control]) => {
        if (!control) return;
        control.disabled = !selectedMirror;
        if (selectedMirror) control.value = key === 'scale' ? Math.round(selectedMirror.scale * 100) : selectedMirror[key];
      });
      if (mirrorOutputs.x) mirrorOutputs.x.textContent = selectedMirror ? Math.round(selectedMirror.x) : '—';
      if (mirrorOutputs.y) mirrorOutputs.y.textContent = selectedMirror ? Math.round(selectedMirror.y) : '—';
      if (mirrorOutputs.scale) mirrorOutputs.scale.textContent = selectedMirror ? `${Math.round(selectedMirror.scale * 100)}%` : '—';
      if (mirrorStatus) mirrorStatus.textContent = selectedMirror ? `鏡 ${selectedMirrorIndex + 1}` : '尚未選取';
      mirrorButtons.forEach((button, index) => button.classList.toggle('selected', index === selectedMirrorIndex));

      const selectedBeamPoint = selectedBeamPointKey ? tombPropsSettings.beamPoints[selectedBeamPointKey] : null;
      Object.entries(beamPointControls).forEach(([key, control]) => {
        if (!control) return;
        control.disabled = !selectedBeamPoint;
        if (selectedBeamPoint) control.value = selectedBeamPoint[key];
      });
      if (beamPointOutputs.x) beamPointOutputs.x.textContent = selectedBeamPoint ? Math.round(selectedBeamPoint.x) : '—';
      if (beamPointOutputs.y) beamPointOutputs.y.textContent = selectedBeamPoint ? Math.round(selectedBeamPoint.y) : '—';
      if (beamPointStatus) beamPointStatus.textContent = selectedBeamPoint ? beamPointLabels[selectedBeamPointKey] : '尚未選取';
      beamPointButtons.forEach(button => button.classList.toggle('selected', button.dataset.tombBeamPoint === selectedBeamPointKey));
    }

    toggle?.addEventListener('click', () => {
      toggle.classList.add('hidden');
      toolbar?.classList.remove('hidden');
      tombEditorActive = true;
      syncEditor();
    });
    close?.addEventListener('click', () => {
      toolbar?.classList.add('hidden');
      tombEditorActive = false;
      draggingProp = null;
      if (Game.currentScene === SCENE_ID) toggle?.classList.remove('hidden');
    });

    controls.backgroundScale?.addEventListener('input', event => {
      tombLayoutSettings.backgroundScale = Number(event.target.value) / 100;
      saveTombLayoutSettings();
      syncEditor();
    });
    controls.backgroundOffsetY?.addEventListener('input', event => {
      tombLayoutSettings.backgroundOffsetY = Number(event.target.value);
      saveTombLayoutSettings();
      syncEditor();
    });
    controls.playerScale?.addEventListener('input', event => {
      tombLayoutSettings.playerScale = Number(event.target.value) / 100;
      saveTombLayoutSettings();
      syncEditor();
    });
    controls.playerFloorY?.addEventListener('input', event => {
      tombLayoutSettings.playerFloorY = Number(event.target.value);
      saveTombLayoutSettings();
      syncEditor();
    });
    Object.entries(doorControls).forEach(([key, control]) => {
      control?.addEventListener('input', event => {
        tombPropsSettings.entranceDoor[key] = Number(event.target.value);
        saveTombPropsSettings();
        syncEditor();
      });
    });
    torchControls.x?.addEventListener('input', event => {
      const torch = tombPropsSettings.torches[selectedTorchIndex];
      if (!torch) return;
      torch.x = Number(event.target.value);
      saveTombPropsSettings();
      syncEditor();
    });
    torchControls.y?.addEventListener('input', event => {
      const torch = tombPropsSettings.torches[selectedTorchIndex];
      if (!torch) return;
      torch.y = Number(event.target.value);
      saveTombPropsSettings();
      syncEditor();
    });
    torchControls.scale?.addEventListener('input', event => {
      const torch = tombPropsSettings.torches[selectedTorchIndex];
      if (!torch) return;
      torch.scale = Number(event.target.value) / 100;
      saveTombPropsSettings();
      syncEditor();
    });
    addTorch?.addEventListener('click', () => {
      const visibleCenter = Math.min(WORLD_WIDTH - 40, Math.max(40, Game.cameraX + Game.width / 2));
      tombPropsSettings.torches.push({ x: Math.round(visibleCenter / 5) * 5, y: 175, scale: 1 });
      selectedTorchIndex = tombPropsSettings.torches.length - 1;
      saveTombPropsSettings();
      syncEditor();
    });
    deleteTorch?.addEventListener('click', () => {
      if (!tombPropsSettings.torches[selectedTorchIndex]) return;
      tombPropsSettings.torches.splice(selectedTorchIndex, 1);
      selectedTorchIndex = Math.min(selectedTorchIndex, tombPropsSettings.torches.length - 1);
      saveTombPropsSettings();
      syncEditor();
    });
    mirrorButtons.forEach((button, index) => {
      button.addEventListener('click', () => {
        selectedMirrorIndex = index;
        syncEditor();
      });
    });
    mirrorControls.x?.addEventListener('input', event => {
      const mirror = tombPropsSettings.mirrors[selectedMirrorIndex];
      if (!mirror) return;
      mirror.x = Number(event.target.value);
      saveTombPropsSettings();
      syncEditor();
    });
    mirrorControls.y?.addEventListener('input', event => {
      const mirror = tombPropsSettings.mirrors[selectedMirrorIndex];
      if (!mirror) return;
      mirror.y = Number(event.target.value);
      saveTombPropsSettings();
      syncEditor();
    });
    mirrorControls.scale?.addEventListener('input', event => {
      const mirror = tombPropsSettings.mirrors[selectedMirrorIndex];
      if (!mirror) return;
      mirror.scale = Number(event.target.value) / 100;
      saveTombPropsSettings();
      syncEditor();
    });
    beamPointButtons.forEach(button => {
      button.addEventListener('click', () => {
        selectedBeamPointKey = button.dataset.tombBeamPoint;
        syncEditor();
      });
    });
    Object.entries(beamPointControls).forEach(([key, control]) => {
      control?.addEventListener('input', event => {
        const point = tombPropsSettings.beamPoints[selectedBeamPointKey];
        if (!point) return;
        point[key] = Number(event.target.value);
        saveTombPropsSettings();
        syncEditor();
      });
    });
    reset?.addEventListener('click', () => {
      Object.assign(tombLayoutSettings, defaultTombLayoutSettings);
      tombPropsSettings.entranceDoor = { ...defaultTombPropsSettings.entranceDoor };
      tombPropsSettings.torches = defaultTombPropsSettings.torches.map(torch => ({ ...torch }));
      tombPropsSettings.mirrors = defaultTombPropsSettings.mirrors.map(mirror => ({ ...mirror }));
      tombPropsSettings.sunHeartAltar = { ...defaultTombPropsSettings.sunHeartAltar };
      tombPropsSettings.beamPoints = JSON.parse(JSON.stringify(defaultTombPropsSettings.beamPoints));
      selectedTorchIndex = -1;
      selectedMirrorIndex = -1;
      selectedBeamPointKey = null;
      saveTombLayoutSettings();
      saveTombPropsSettings();
      syncEditor();
    });

    const canvas = document.getElementById('gameCanvas');
    function getWorldPointer(event) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * Game.width / rect.width + Game.cameraX,
        y: (event.clientY - rect.top) * Game.height / rect.height
      };
    }
    canvas?.addEventListener('pointerdown', event => {
      if (!tombEditorActive || Game.currentScene !== SCENE_ID) return;
      const point = getWorldPointer(event);
      for (const [key, beamPoint] of Object.entries(tombPropsSettings.beamPoints)) {
        if (Math.hypot(point.x - beamPoint.x, point.y - beamPoint.y) <= 22) {
          selectedBeamPointKey = key;
          draggingProp = 'beam-point';
          dragOffset = { x: point.x - beamPoint.x, y: point.y - beamPoint.y };
          canvas.setPointerCapture?.(event.pointerId);
          syncEditor();
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
      }
      for (let index = tombPropsSettings.mirrors.length - 1; index >= 0; index -= 1) {
        const mirror = tombPropsSettings.mirrors[index];
        const bounds = getTombMirrorBounds(mirror);
        if (point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height) {
          selectedMirrorIndex = index;
          draggingProp = 'mirror';
          dragOffset = { x: point.x - mirror.x, y: point.y - mirror.y };
          canvas.setPointerCapture?.(event.pointerId);
          syncEditor();
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
      }
      for (let index = tombPropsSettings.torches.length - 1; index >= 0; index -= 1) {
        const torch = tombPropsSettings.torches[index];
        const width = Math.max(38, 24 * torch.scale + 18);
        const height = 112 * torch.scale + 18;
        if (Math.abs(point.x - torch.x) <= width / 2 && Math.abs(point.y - torch.y) <= height / 2) {
          selectedTorchIndex = index;
          draggingProp = 'torch';
          dragOffset = { x: point.x - torch.x, y: point.y - torch.y };
          canvas.setPointerCapture?.(event.pointerId);
          syncEditor();
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
      }

      const door = tombPropsSettings.entranceDoor;
      if (Math.abs(point.x - door.x) <= door.width / 2 && Math.abs(point.y - door.y) <= door.height / 2) {
        draggingProp = 'door';
        dragOffset = { x: point.x - door.x, y: point.y - door.y };
        canvas.setPointerCapture?.(event.pointerId);
        syncEditor();
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
    canvas?.addEventListener('pointermove', event => {
      if (!tombEditorActive || !draggingProp || Game.currentScene !== SCENE_ID) return;
      const point = getWorldPointer(event);
      if (draggingProp === 'door') {
        const door = tombPropsSettings.entranceDoor;
        door.x = Math.round(Math.max(0, Math.min(WORLD_WIDTH, point.x - dragOffset.x)) / 5) * 5;
        door.y = Math.round(Math.max(80, Math.min(Game.height, point.y - dragOffset.y)) / 2) * 2;
      } else if (draggingProp === 'torch') {
        const torch = tombPropsSettings.torches[selectedTorchIndex];
        if (torch) {
          torch.x = Math.round(Math.max(0, Math.min(WORLD_WIDTH, point.x - dragOffset.x)) / 5) * 5;
          torch.y = Math.round(Math.max(40, Math.min(440, point.y - dragOffset.y)) / 2) * 2;
        }
      } else if (draggingProp === 'mirror') {
        const mirror = tombPropsSettings.mirrors[selectedMirrorIndex];
        if (mirror) {
          mirror.x = Math.round(Math.max(0, Math.min(WORLD_WIDTH, point.x - dragOffset.x)) / 5) * 5;
          mirror.y = Math.round(Math.max(350, Math.min(540, point.y - dragOffset.y)) / 2) * 2;
        }
      } else if (draggingProp === 'beam-point') {
        const beamPoint = tombPropsSettings.beamPoints[selectedBeamPointKey];
        if (beamPoint) {
          beamPoint.x = Math.round(Math.max(0, Math.min(WORLD_WIDTH, point.x - dragOffset.x)) / 2) * 2;
          beamPoint.y = Math.round(Math.max(0, Math.min(Game.height, point.y - dragOffset.y)) / 2) * 2;
        }
      }
      saveTombPropsSettings();
      syncEditor();
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    const stopDragging = event => {
      if (!draggingProp) return;
      draggingProp = null;
      saveTombPropsSettings();
      event.stopImmediatePropagation();
    };
    canvas?.addEventListener('pointerup', stopDragging, true);
    canvas?.addEventListener('pointercancel', stopDragging, true);

    syncEditor();
  }

  window.getTombPlayerScale = () => tombLayoutSettings.playerScale;
  window.getTombPlayerFloorY = () => tombLayoutSettings.playerFloorY;
  window.tombLayoutSettings = tombLayoutSettings;
  window.tombPropsSettings = tombPropsSettings;
  window.submitTombMirrorPuzzle = submitTombMirrorPuzzle;
  window.showSunHeartChoice = showSunHeartChoice;
  window.handleSunHeartChoiceKey = handleSunHeartChoiceKey;
  window.chooseSunHeart = chooseSunHeart;
  window.finishTombEscape = finishTombEscape;
  window.pharaohTombSceneObjects = pharaohTombSceneObjects;
  window.pharaohTombWorldWidth = WORLD_WIDTH;
  window.enterPharaohTomb = enterPharaohTomb;
  window.drawPharaohTombBackground = drawPharaohTombBackground;
  window.drawPharaohTombSceneObjects = drawPharaohTombSceneObjects;
  window.applyPharaohTombLighting = applyPharaohTombLighting;
})();
