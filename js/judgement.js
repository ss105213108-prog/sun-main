/**
 * 《太陽之心：法老的試煉》
 * 場景二：天秤審判室
 * 負責場景切換、四件審判物品、祭司暗格與天秤謎題。
 */

(() => {
  const SCENE_ID = 'judgement_chamber';
  const WORLD_WIDTH = 2500;

  const trialItems = {
    gold_mask: {
      label: '黃金面具',
      shortName: '黃金面具',
      x: 1250,
      color: '#f1c84d',
      pickup: '「這副黃金面具幾乎沒有氧化。它象徵權力與財富……也可能正是試煉想讓人誤選的東西。」'
    },
    truth_feather: {
      label: '真理羽毛',
      shortName: '真理羽毛',
      x: 1420,
      color: '#fff1bc',
      pickup: '「一根潔白羽毛，保存得不可思議。瑪亞特的羽毛……它代表真理與秩序。」'
    },
    stone_heart: {
      label: '石製心臟',
      shortName: '石製心臟',
      x: 2130,
      color: '#a4463e',
      pickup: '「這顆石製心臟被磨得十分光滑。在亡者審判裡，心臟代表一個人的靈魂與記憶。」'
    },
    jewel_scarab: {
      label: '寶石聖甲蟲',
      shortName: '寶石聖甲蟲',
      x: 2250,
      color: '#50b9b0',
      pickup: '「寶石聖甲蟲閃著誘人的光。它看起來很神聖，但這座天秤要衡量的恐怕不是寶石。」'
    }
  };

  let selectedScaleItem = null;
  let transitionTimer = null;

  const judgementHallImage = new Image();
  judgementHallImage.src = 'assets/道具/最新的牆壁.png';

  const defaultJudgementBackgroundSettings = {
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    rotation: 0
  };
  let judgementBackgroundSettings = { ...defaultJudgementBackgroundSettings };
  try {
    const savedBackground = localStorage.getItem('judgementBackgroundSettings');
    if (savedBackground) {
      judgementBackgroundSettings = {
        ...defaultJudgementBackgroundSettings,
        ...JSON.parse(savedBackground)
      };
    }
  } catch (error) {}

  const judgementFloorImage = new Image();
  judgementFloorImage.src = 'assets/backgrounds/floor.png';

  const judgementScaleImage = new Image();
  judgementScaleImage.src = 'assets/道具/天秤.png';

  const judgementOpenedScaleImage = new Image();
  judgementOpenedScaleImage.src = 'assets/道具/暗格打開的天秤.png';

  const defaultJudgementScaleSettings = {
    x: 1008,
    y: 340,
    width: 390,
    height: 260
  };
  let judgementScaleSettings = { ...defaultJudgementScaleSettings };
  try {
    const savedScale = localStorage.getItem('judgementScaleSettings');
    if (savedScale) {
      const parsed = JSON.parse(savedScale);
      if (
        Number.isFinite(parsed.x) && Number.isFinite(parsed.y)
        && Number.isFinite(parsed.width) && Number.isFinite(parsed.height)
      ) {
        judgementScaleSettings = { ...defaultJudgementScaleSettings, ...parsed };
      }
    }
  } catch (error) {}

  const scaleInnerAltarOffset = judgementScaleSettings.width / 2 + 105;
  const scaleOuterAltarOffset = scaleInnerAltarOffset + 190;
  const defaultJudgementAltarSettings = {
    gold_mask: { x: judgementScaleSettings.x - scaleOuterAltarOffset, y: 420, width: 170, height: 113 },
    stone_heart: { x: judgementScaleSettings.x - scaleInnerAltarOffset, y: 420, width: 170, height: 113 },
    truth_feather: { x: judgementScaleSettings.x + scaleInnerAltarOffset, y: 420, width: 170, height: 113 },
    jewel_scarab: { x: judgementScaleSettings.x + scaleOuterAltarOffset, y: 420, width: 170, height: 113 }
  };
  let judgementAltarSettings = Object.fromEntries(
    Object.entries(defaultJudgementAltarSettings).map(([itemId, settings]) => [itemId, { ...settings }])
  );
  try {
    const savedAltars = localStorage.getItem('judgementAltarSettings');
    if (savedAltars) {
      const parsed = JSON.parse(savedAltars);
      Object.keys(judgementAltarSettings).forEach(itemId => {
        if (parsed[itemId]) {
          judgementAltarSettings[itemId] = { ...judgementAltarSettings[itemId], ...parsed[itemId] };
        }
      });
    }
  } catch (error) {}

  const judgementAltarImages = {
    gold_mask: new Image(),
    truth_feather: new Image(),
    stone_heart: new Image(),
    jewel_scarab: new Image()
  };
  judgementAltarImages.gold_mask.src = 'assets/道具/放面具的.png';
  judgementAltarImages.truth_feather.src = 'assets/道具/放羽毛的祭壇.png';
  judgementAltarImages.stone_heart.src = 'assets/道具/放心臟.png';
  judgementAltarImages.jewel_scarab.src = 'assets/道具/放聖甲蟲.png';

  const judgementTrialItemImages = {
    gold_mask: new Image(),
    truth_feather: new Image(),
    stone_heart: new Image(),
    jewel_scarab: new Image()
  };
  judgementTrialItemImages.gold_mask.src = 'assets/道具/面具.png';
  judgementTrialItemImages.truth_feather.src = 'assets/道具/羽毛.png';
  judgementTrialItemImages.stone_heart.src = 'assets/道具/石頭心臟.png';
  judgementTrialItemImages.jewel_scarab.src = 'assets/道具/聖甲蟲.png';

  // 各物品依造型調整相對祭壇寬度，繪製時仍維持原圖比例。
  const judgementTrialItemWidthRatios = {
    gold_mask: 0.42,
    truth_feather: 0.86,
    stone_heart: 0.52,
    jewel_scarab: 0.72
  };

  const judgementDoorClosedImage = new Image();
  judgementDoorClosedImage.src = 'assets/道具/關上的石門.png';

  const judgementDoorOpenedImage = new Image();
  judgementDoorOpenedImage.src = 'assets/道具/開啟的石門.png';

  const judgementPharaohDoorImage = new Image();
  judgementPharaohDoorImage.src = 'assets/道具/往法老大廳的門.png';

  const judgementOpenedPharaohDoorImage = new Image();
  judgementOpenedPharaohDoorImage.src = 'assets/道具/打開的門.png';

  const defaultJudgementExitDoorSettings = {
    x: 2315,
    y: 345,
    width: 340,
    height: 227
  };
  let judgementExitDoorSettings = { ...defaultJudgementExitDoorSettings };
  try {
    const savedExitDoor = localStorage.getItem('judgementExitDoorSettings');
    if (savedExitDoor) {
      const parsed = JSON.parse(savedExitDoor);
      if (
        Number.isFinite(parsed.x) && Number.isFinite(parsed.y)
        && Number.isFinite(parsed.width) && Number.isFinite(parsed.height)
      ) {
        judgementExitDoorSettings = { ...defaultJudgementExitDoorSettings, ...parsed };
      }
    }
  } catch (error) {}

  const judgementTorchImage = new Image();
  judgementTorchImage.src = 'assets/items/torch.png';

  const defaultJudgementTorchPositions = [
    { x: 45, y: 235, width: 24, height: 72 },
    { x: 350, y: 235, width: 24, height: 72 }
  ];
  let judgementTorchPositions = defaultJudgementTorchPositions.map(position => ({ ...position }));
  try {
    const savedTorches = localStorage.getItem('judgementTorchPositions');
    if (savedTorches) {
      const parsed = JSON.parse(savedTorches);
      if (Array.isArray(parsed)) {
        judgementTorchPositions = parsed.map((position, index) => ({
          ...(defaultJudgementTorchPositions[index] || { width: 24, height: 72 }),
          ...position
        }));
      }
    }
  } catch (error) {}

  const defaultJudgementDoorSettings = { x: 190, y: 365, width: 360, height: 203 };
  let judgementDoorSettings = { ...defaultJudgementDoorSettings };
  try {
    const savedDoor = localStorage.getItem('judgementDoorSettings')
      || localStorage.getItem('judgementDoorPosition');
    if (savedDoor) {
      const parsed = JSON.parse(savedDoor);
      if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
        judgementDoorSettings = { ...defaultJudgementDoorSettings, ...parsed };
      }
    }
  } catch (error) {}

  function ensureJudgementState() {
    Game.progress.scene2Entered ??= false;
    Game.progress.judgementMuralRead ??= false;
    Game.progress.scaleCompartmentOpened ??= false;
    Game.progress.scaleCompartmentSealed ??= false;
    Game.progress.scalePuzzleIntroduced ??= false;
    Game.progress.priestAmuletFound ??= false;
    Game.progress.scaleCleared ??= false;
    Game.progress.scaleMistakes ??= 0;
    Game.progress.collectedTrialItems ??= {};
    Game.scaleState ??= { left: null, right: null };
  }

  function collectTrialItem(itemId) {
    if ((!Game.progress.scalePuzzleIntroduced && !Game.progress.scaleCompartmentOpened) || Game.progress.scaleCleared) return;
    const item = trialItems[itemId];
    if (!item) return;

    if (Game.progress.collectedTrialItems[itemId] || Game.inventory.includes(itemId)) {
      window.triggerDialogue('亞倫・卡特', [
        `「${item.shortName}的展示台已經空了。」`
      ]);
      return;
    }

    Game.progress.collectedTrialItems[itemId] = true;
    Game.inventory.push(itemId);
    audio.play('item');
    window.triggerDialogue('亞倫・卡特', [
      item.pickup,
      `「取得【${item.shortName}】。也許能用在中央的天秤上。」`
    ]);
  }

  function inspectFeatherScaleRelief() {
    const alreadyRead = Game.progress.judgementMuralRead;
    Game.progress.judgementMuralRead = true;

    window.triggerDialogue('死者接受審判的壁畫', alreadyRead
      ? [
          '「壁畫中的心臟與羽毛仍分列天秤兩側。」',
          '「它不只警告審判衡量的不是財富，底部還刻著：『審判既定，秤座永閉。』」'
        ]
      : [
          '「壁畫描繪著死者接受審判：心臟與羽毛被放在天秤兩側。」',
          '『心若重於真理，靈魂將被黑暗吞噬。』',
          '「羽毛代表真理，心臟代表靈魂。這座天秤要判斷的不是金子的重量。」',
          '『審判既定，秤座永閉。守墓者的印記，藏於真理之下。』'
        ]);
  }

  const judgementSceneObjects = [
    {
      id: 'judgement_entrance',
      x: judgementDoorSettings.x,
      y: judgementDoorSettings.y,
      width: judgementDoorSettings.width,
      height: judgementDoorSettings.height,
      label: '來時石門',
      onInteract: () => window.triggerDialogue('亞倫・卡特', [
        '「身後的石門已經閉合。第二道試煉完成前，沒有退路。」'
      ])
    },
    {
      id: 'feather_scale_relief',
      x: 1008,
      interactionX: 900,
      interactionRadius: 55,
      y: 250,
      width: 260,
      height: 200,
      label: '【死者接受審判的壁畫】',
      onInteract: inspectFeatherScaleRelief
    },
    {
      id: 'judgement_scale',
      x: judgementScaleSettings.x,
      y: judgementScaleSettings.y,
      width: judgementScaleSettings.width,
      height: judgementScaleSettings.height,
      label: '審判天秤',
      onInteract: openScalePuzzle
    },
    ...Object.entries(trialItems).map(([itemId, item]) => {
      const placement = judgementAltarSettings[itemId];
      return {
        id: `display_${itemId}`,
        itemId,
        x: placement.x,
        y: placement.y,
        width: placement.width,
        height: placement.height,
        label: item.label,
        isAvailable: () => Boolean(
          (Game.progress.scalePuzzleIntroduced || Game.progress.scaleCompartmentOpened)
          && !Game.progress.scaleCleared
        ),
        onInteract: () => collectTrialItem(itemId)
      };
    }),
    {
      id: 'judgement_exit',
      x: judgementExitDoorSettings.x,
      y: judgementExitDoorSettings.y,
      width: judgementExitDoorSettings.width,
      height: judgementExitDoorSettings.height,
      label: '法老石門',
      onInteract: () => {
        if (!Game.progress.scaleCleared) {
          window.triggerDialogue('亞倫・卡特', [
            '「門上沒有鎖孔，只有一幅保持平衡的天秤圖案。」',
            '「中央的審判完成後，這扇門才會開啟。」'
          ]);
          return;
        }
        window.triggerDialogue('亞倫・卡特', [
          '「通往法老王墓室的道路已經打開。」',
          Game.progress.priestAmuletFound
            ? '「第三道試煉就在門後。祭司護符也已經收好了。」'
            : '「天秤底座已經完全鎖死……現在只能繼續前進。」'
        ], () => {
          if (window.enterPharaohTomb) window.enterPharaohTomb();
        });
      }
    }
  ];
  window.judgementSceneObjects = judgementSceneObjects;
  window.judgementWorldWidth = WORLD_WIDTH;

  async function enterJudgementChamber() {
    if (Game.currentScene === SCENE_ID) return;
    if (Game.inCutscene && window.skipOpeningCutscene) window.skipOpeningCutscene();
    ensureJudgementState();

    Game.state = 'CUTSCENE';
    Game.currentInteractiveTarget = null;
    if (window.preloadSceneAssets) {
      await window.preloadSceneAssets('judgement', '正在開啟天秤審判室……');
    }
    const fade = document.getElementById('screen-fade');
    if (fade) {
      fade.classList.remove('fade-out');
      fade.classList.add('fade-in');
    }

    if (transitionTimer) clearTimeout(transitionTimer);
    transitionTimer = setTimeout(() => {
      Game.currentScene = SCENE_ID;
      Game.progress.scene2Entered = true;
      Game.sceneObjects = judgementSceneObjects;
      Game.worldWidth = WORLD_WIDTH;
      Game.entranceBlocked = false;
      Game.fallingRocks = [];
      Game.dustParticles = [];
      Game.cameraX = 0;
      Game.cameraTargetX = null;

      if (window.player) {
        player.x = 230;
        player.y = 432;
        player.direction = 1;
        player.vx = 0;
        player.isWalking = false;
        player.autoWalkTarget = null;
        player.autoWalkCallback = null;
      }

      if (window.createGameCheckpoint) {
        window.createGameCheckpoint('天秤審判室入口');
      }

      if (fade) {
        fade.classList.remove('fade-in');
        fade.classList.add('fade-out');
      }

      transitionTimer = setTimeout(() => {
        window.triggerDialogue('亞倫・卡特', [
          '「這裡就是第二道試煉……天秤審判室。」',
          '「四件物品、一座天秤，還有牆上的羽毛審判圖案。」',
          '「先別急著把最珍貴的東西放上去。這裡考驗的應該不是財富。」'
        ]);
      }, 550);
    }, 850);
  }
  window.enterJudgementChamber = enterJudgementChamber;

  function openScalePuzzle() {
    ensureJudgementState();

    if (Game.progress.scaleCleared) {
      window.triggerDialogue('古墓的低語', Game.progress.priestAmuletFound
        ? ['「天秤保持著完美的平衡，第二道試煉已經完成。」']
        : [
            '「天秤保持著完美的平衡，底座的接縫也隨審判一同封閉。」',
            '「裡面似乎曾藏著某樣東西……但現在已經拿不出來了。」'
          ]);
      return;
    }

    if (
      Game.progress.judgementMuralRead
      && !Game.progress.scaleCompartmentOpened
      && !Game.progress.scaleCompartmentSealed
    ) {
      Game.progress.scaleCompartmentOpened = true;
      audio.play('rumble');
      if (window.triggerScreenShake) window.triggerScreenShake(3, 450);
      showPriestAmuletReveal();
      return;
    }

    if (!Game.progress.scalePuzzleIntroduced) {
      Game.progress.scalePuzzleIntroduced = true;
      window.triggerDialogue('亞倫・卡特', [
        Game.progress.scaleCompartmentOpened
          ? '「暗格已經空了……不過，天秤兩側的秤盤仍然可以活動。」'
          : '「天秤兩側的秤盤仍然可以活動，四周的祭壇也有了反應。」',
        Game.progress.judgementMuralRead
          ? '「先確認底座的暗格，再完成這場審判。」'
          : '「我還不知道完整的審判規則，也許牆上的壁畫留有線索。」'
      ], showScalePuzzleOverlay);
      return;
    }

    showScalePuzzleOverlay();
  }
  window.openScalePuzzle = openScalePuzzle;

  function showPriestAmuletReveal() {
    const overlay = document.getElementById('relic-reveal-overlay');
    const collectButton = document.getElementById('collect-relic-btn');
    if (!overlay || !collectButton) {
      Game.progress.priestAmuletFound = true;
      if (!Game.inventory.includes('priest_amulet')) Game.inventory.push('priest_amulet');
      Game.state = 'PLAYING';
      window.triggerDialogue('亞倫・卡特', [
        '「天秤底座有一道不自然的接縫……暗格竟然沒有上鎖。」',
        '「裡面放著一枚【祭司護符】。我先收起來。」'
      ]);
      return;
    }

    Game.state = 'ITEM_REVEAL';
    overlay.classList.remove('hidden');
    collectButton.onclick = () => {
      Game.progress.priestAmuletFound = true;
      if (!Game.inventory.includes('priest_amulet')) Game.inventory.push('priest_amulet');
      audio.play('item');
      overlay.classList.add('hidden');
      Game.state = 'PLAYING';
      window.triggerDialogue('亞倫・卡特', [
        '「天秤底座有一道不自然的接縫……暗格竟然沒有上鎖。」',
        '「我拿到了【祭司護符】。暗格裡已經沒有其他東西了。」',
        '「周圍那四座祭壇似乎也有了反應。」'
      ]);
    };
  }

  function showScalePuzzleOverlay() {
    selectedScaleItem = null;
    Game.state = 'SCALE';
    document.getElementById('scale-overlay')?.classList.remove('hidden');
    if (window.updateTimerDisplay) window.updateTimerDisplay();
    renderScalePuzzle('選擇一件物品，再決定放上左盤或右盤。');
  }

  function getScaleItem(itemId) {
    return trialItems[itemId] || null;
  }

  function renderScalePuzzle(message = '') {
    ensureJudgementState();
    const pool = document.getElementById('scale-item-pool');
    const feedback = document.getElementById('scale-feedback');
    const mistakes = document.getElementById('scale-mistakes');
    const pillar = document.querySelector('.scale-pillar');
    if (!pool) return;

    pool.innerHTML = '';
    const available = Object.keys(trialItems).filter(itemId => Game.inventory.includes(itemId));
    available.forEach(itemId => {
      const item = getScaleItem(itemId);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'scale-item-choice';
      if (selectedScaleItem === itemId) button.classList.add('selected');
      button.textContent = item.shortName;
      button.addEventListener('click', () => {
        selectedScaleItem = selectedScaleItem === itemId ? null : itemId;
        renderScalePuzzle(selectedScaleItem ? `已選擇「${item.shortName}」，請點擊其中一個秤盤。` : '已取消選取。');
      });
      pool.appendChild(button);
    });

    if (available.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'scale-empty-hint';
      empty.textContent = '目前沒有可放置的審判物品，先調查右側展示台。';
      pool.appendChild(empty);
    }

    renderScalePan('left');
    renderScalePan('right');
    if (feedback) feedback.textContent = message;
    if (mistakes) mistakes.textContent = `陷阱觸發：${Game.progress.scaleMistakes} / 2`;
    if (pillar) {
      const occupiedCount = Number(Boolean(Game.scaleState.left)) + Number(Boolean(Game.scaleState.right));
      pillar.classList.toggle('unbalanced', occupiedCount === 1);
    }
  }

  function renderScalePan(side) {
    const pan = document.getElementById(`scale-${side}-pan`);
    if (!pan) return;
    const content = pan.querySelector('.pan-content');
    const itemId = Game.scaleState[side];
    const item = getScaleItem(itemId);
    pan.classList.toggle('has-item', Boolean(item));
    if (content) content.textContent = item ? item.shortName : '點擊放置';
  }

  function placeSelectedItem(side) {
    if (Game.progress.scaleCleared) return;
    const feedback = document.getElementById('scale-feedback');

    if (!selectedScaleItem) {
      const placedItem = Game.scaleState[side];
      if (placedItem) {
        Game.scaleState[side] = null;
        if (!Game.inventory.includes(placedItem)) Game.inventory.push(placedItem);
        const item = getScaleItem(placedItem);
        renderScalePuzzle(`已從${side === 'left' ? '左' : '右'}盤取回「${item.shortName}」。`);
      } else if (feedback) {
        feedback.textContent = '請先從下方選擇要放置的物品。';
      }
      return;
    }

    if (selectedScaleItem === 'gold_mask' || selectedScaleItem === 'jewel_scarab') {
      const trapItem = getScaleItem(selectedScaleItem);
      selectedScaleItem = null;
      triggerScaleMistake(`「${trapItem.shortName}」觸發了牆內的飛箭機關！`);
      return;
    }

    const previousItem = Game.scaleState[side];
    if (previousItem && !Game.inventory.includes(previousItem)) Game.inventory.push(previousItem);

    Game.scaleState[side] = selectedScaleItem;
    Game.inventory = Game.inventory.filter(itemId => itemId !== selectedScaleItem);
    const placed = getScaleItem(selectedScaleItem);
    selectedScaleItem = null;
    renderScalePuzzle(`已將「${placed.shortName}」放上${side === 'left' ? '左' : '右'}盤。`);
  }

  function triggerScaleMistake(message) {
    if (!Game.progress.judgementMuralRead) {
      ['left', 'right'].forEach(side => {
        const itemId = Game.scaleState[side];
        if (itemId && !Game.inventory.includes(itemId)) Game.inventory.push(itemId);
      });
      Game.scaleState = { left: null, right: null };
      selectedScaleItem = null;
      document.getElementById('scale-overlay')?.classList.add('hidden');
      Game.state = 'PLAYING';
      window.triggerDialogue('亞倫・卡特', [
        '「等等……我還不知道這道謎題真正的答案是什麼。」',
        '「盲目嘗試太危險了。先去調查四周的壁畫，應該能找到線索。」'
      ]);
      return;
    }

    Game.progress.scaleMistakes += 1;
    Game.timer.remainingSeconds = Math.max(0, Game.timer.remainingSeconds - 20);
    Game.timer.lastTick = performance.now();
    if (window.updateTimerDisplay) window.updateTimerDisplay();
    audio.play('incorrect');
    if (window.triggerScreenShake) window.triggerScreenShake(8, 700);

    const modal = document.querySelector('.scale-modal');
    if (modal) {
      modal.classList.remove('penalty-shake');
      void modal.offsetWidth;
      modal.classList.add('penalty-shake');
      setTimeout(() => modal.classList.remove('penalty-shake'), 650);
    }

    renderScalePuzzle(`⚠️ ${message} 封印倒數減少 20 秒。`);

    if (Game.progress.scaleMistakes >= 2) {
      setTimeout(() => {
        document.getElementById('scale-overlay')?.classList.add('hidden');
        window.triggerDialogue('審判之聲', [
          '『你以財富衡量靈魂，也讓貪婪蒙蔽真理。』',
          '『審判失敗。黑暗將吞噬迷失之人。』'
        ], () => {
          if (window.showDeathScreen) {
            window.showDeathScreen({
              title: 'BAD END：未通過的審判',
              reason: '天秤錯誤操作累積兩次，出口已被巨石封鎖。'
            });
          } else if (window.restartGame) {
            window.restartGame();
          }
        });
      }, 650);
    }
  }

  function submitScalePuzzle() {
    const { left, right } = Game.scaleState;
    if (!left || !right) {
      renderScalePuzzle('兩側秤盤都必須放上物品，審判才能開始。');
      return;
    }

    if (left !== 'stone_heart' || right !== 'truth_feather') {
      triggerScaleMistake('天秤猛烈傾斜，配置不符合壁畫上的審判秩序！');
      return;
    }

    Game.progress.scaleCleared = true;
    if (!Game.progress.priestAmuletFound) {
      Game.progress.scaleCompartmentSealed = true;
    }
    const trialItemIds = Object.keys(trialItems);
    Game.inventory = Game.inventory.filter(itemId => !trialItemIds.includes(itemId));
    Game.scaleState = { left: 'stone_heart', right: 'truth_feather' };
    trialItemIds.forEach(itemId => {
      Game.progress.collectedTrialItems[itemId] = true;
    });
    audio.play('correct');
    audio.play('rumble');
    if (window.triggerScreenShake) window.triggerScreenShake(4, 900);
    document.getElementById('scale-overlay')?.classList.add('hidden');

    window.triggerDialogue('古墓的聲音', [
      '『第二試煉完成。你沒有用黃金衡量靈魂。』',
      '「真正的重量，從來不在物品本身，而在我們賦予它的價值。」',
      '「右側石門的封印鬆開了。下一道試煉就在法老王的墓室。」'
    ]);
  }

  function drawJudgementBackground(ctx) {
    Game.worldWidth = WORLD_WIDTH;

    ctx.fillStyle = '#100b08';
    ctx.fillRect(0, 0, WORLD_WIDTH, Game.height);

    if (judgementHallImage.complete && judgementHallImage.naturalWidth) {
      // 整張大廳圖維持原始比例，並允許用臨時工具拖曳、縮放與微調角度。
      const wallHeight = 420;
      const baseScale = WORLD_WIDTH / judgementHallImage.naturalWidth;
      const imageScale = baseScale * judgementBackgroundSettings.scale;
      const drawWidth = judgementHallImage.naturalWidth * imageScale;
      const drawHeight = judgementHallImage.naturalHeight * imageScale;
      const focusY = judgementHallImage.naturalHeight * 0.51 * imageScale;

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, WORLD_WIDTH, wallHeight);
      ctx.clip();
      ctx.translate(
        WORLD_WIDTH / 2 + judgementBackgroundSettings.offsetX,
        wallHeight / 2 + judgementBackgroundSettings.offsetY
      );
      ctx.rotate(judgementBackgroundSettings.rotation * Math.PI / 180);
      ctx.drawImage(
        judgementHallImage,
        -drawWidth / 2,
        -focusY,
        drawWidth,
        drawHeight
      );
      ctx.restore();
    } else {
      const fallback = ctx.createLinearGradient(0, 0, 0, Game.height);
      fallback.addColorStop(0, '#21140f');
      fallback.addColorStop(0.72, '#5a321d');
      fallback.addColorStop(1, '#2b1b15');
      ctx.fillStyle = fallback;
      ctx.fillRect(0, 0, WORLD_WIDTH, Game.height);
    }

    // 地板沿用原本素材與高度，不受新牆面背景影響。
    const floorY = 420;
    if (judgementFloorImage.complete && judgementFloorImage.naturalWidth) {
      // floor.png 頂端有 42px 的純黑留白；裁掉後讓石地板直接銜接牆面。
      const sourceTop = 42;
      const sourceHeight = judgementFloorImage.naturalHeight - sourceTop;
      const ratio = judgementFloorImage.naturalWidth / sourceHeight;
      const floorHeight = Game.height - floorY;
      const tileWidth = floorHeight * ratio;
      for (let x = 0; x < WORLD_WIDTH; x += tileWidth) {
        ctx.drawImage(
          judgementFloorImage,
          0, sourceTop, judgementFloorImage.naturalWidth, sourceHeight,
          x, floorY, tileWidth, floorHeight
        );
      }
    } else {
      ctx.fillStyle = '#4a3224';
      ctx.fillRect(0, floorY, WORLD_WIDTH, Game.height - floorY);
    }

    if (window.player) player.y = 450;

  }
  window.drawJudgementBackground = drawJudgementBackground;

  function drawWallTorch(ctx, x, y) {
    const flicker = Math.sin(performance.now() * 0.012 + x) * 3;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#56351f';
    ctx.fillRect(-5, 8, 10, 54);
    ctx.fillStyle = '#b88745';
    ctx.fillRect(-10, 2, 20, 12);
    const flame = ctx.createRadialGradient(0, -8, 2, 0, -8, 28 + flicker);
    flame.addColorStop(0, '#fff5b8');
    flame.addColorStop(0.38, '#ffb12f');
    flame.addColorStop(1, 'rgba(194, 56, 12, 0)');
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.arc(0, -8, 28 + flicker, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawJudgementSceneObjects(ctx) {
    judgementSceneObjects.forEach(obj => {
      if (obj.id.startsWith('display_')) {
        if ((!Game.progress.scalePuzzleIntroduced && !Game.progress.scaleCompartmentOpened) || Game.progress.scaleCleared) return;
        drawItemDisplay(ctx, obj);
      } else if (obj.id === 'feather_scale_relief') {
        drawJudgementMuralGlow(ctx, obj);
      } else if (obj.id === 'judgement_scale') {
        drawScale(ctx, obj);
      } else if (obj.id === 'judgement_entrance' || obj.id === 'judgement_exit') {
        drawJudgementDoor(ctx, obj);
      }
    });
  }
  window.drawJudgementSceneObjects = drawJudgementSceneObjects;

  function drawJudgementMuralGlow(ctx, obj) {
    const inspected = Game.progress.judgementMuralRead;
    const pulse = (Math.sin(performance.now() * 0.0035) + 1) / 2;
    const alpha = inspected ? 0.055 : 0.13 + pulse * 0.09;
    ctx.save();
    ctx.translate(obj.x, obj.y);
    ctx.globalCompositeOperation = 'screen';

    const glow = ctx.createRadialGradient(0, 0, 20, 0, 0, obj.width * 0.62);
    glow.addColorStop(0, `rgba(255, 220, 115, ${alpha})`);
    glow.addColorStop(0.65, `rgba(238, 168, 55, ${alpha * 0.55})`);
    glow.addColorStop(1, 'rgba(238, 145, 35, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-obj.width / 2 - 28, -obj.height / 2 - 24, obj.width + 56, obj.height + 48);

    ctx.restore();
  }

  function drawScale(ctx, obj) {
    ctx.save();
    ctx.translate(obj.x, obj.y);
    const balanced = Game.progress.scaleCleared;
    const scaleAsset = Game.progress.scaleCompartmentOpened
      && judgementOpenedScaleImage.complete
      && judgementOpenedScaleImage.naturalWidth
      ? judgementOpenedScaleImage
      : judgementScaleImage;

    if (scaleAsset.complete && scaleAsset.naturalWidth) {
      if (balanced) {
        ctx.shadowColor = '#ffd966';
        ctx.shadowBlur = 24;
      }
      ctx.drawImage(
        scaleAsset,
        -obj.width / 2,
        -obj.height / 2,
        obj.width,
        obj.height
      );
      const leftItem = balanced ? 'stone_heart' : Game.scaleState.left;
      const rightItem = balanced ? 'truth_feather' : Game.scaleState.right;
      drawScaleItemOnRenderedPan(ctx, obj, leftItem, 'left');
      drawScaleItemOnRenderedPan(ctx, obj, rightItem, 'right');
      ctx.restore();
      return;
    }

    const sway = balanced ? 0 : Math.sin(performance.now() * 0.0012) * 0.015;

    ctx.fillStyle = '#6a451e';
    ctx.fillRect(-18, -42, 36, 190);
    ctx.fillStyle = '#b98b3d';
    ctx.beginPath();
    ctx.moveTo(-72, 148); ctx.lineTo(72, 148); ctx.lineTo(94, 178); ctx.lineTo(-94, 178); ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.rotate(sway);
    ctx.fillStyle = balanced ? '#f3d87c' : '#c2923f';
    ctx.fillRect(-185, -65, 370, 12);
    drawCanvasPan(ctx, -155, 42, balanced ? 'stone_heart' : Game.scaleState.left);
    drawCanvasPan(ctx, 155, 42, balanced ? 'truth_feather' : Game.scaleState.right);
    ctx.restore();

    ctx.fillStyle = '#241813';
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -60, 35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f0cb65';
    ctx.font = '32px serif';
    ctx.textAlign = 'center';
    ctx.fillText('𓂀', 0, -49);

    if (balanced) {
      ctx.shadowColor = '#ffd966';
      ctx.shadowBlur = 24;
      ctx.strokeStyle = '#fff0a4';
      ctx.strokeRect(-202, -82, 404, 16);
    }
    ctx.restore();
  }

  function drawScaleItemOnRenderedPan(ctx, obj, itemId, side) {
    if (!itemId) return;
    const panX = obj.width * (side === 'left' ? -0.263 : 0.263);
    const panBottomY = obj.height * 0.125;
    const isFeather = itemId === 'truth_feather';
    drawScaleItemGraphic(
      ctx,
      itemId,
      panX,
      panBottomY,
      obj.width * (isFeather ? 0.25 : 0.15),
      obj.height * (isFeather ? 0.16 : 0.24)
    );
  }

  function drawScaleItemGraphic(ctx, itemId, centerX, bottomY, maxWidth, maxHeight) {
    const itemImage = judgementTrialItemImages[itemId];
    if (!itemImage?.complete || !itemImage.naturalWidth) return;
    const scale = Math.min(
      maxWidth / itemImage.naturalWidth,
      maxHeight / itemImage.naturalHeight
    );
    const width = itemImage.naturalWidth * scale;
    const height = itemImage.naturalHeight * scale;

    ctx.save();
    ctx.shadowColor = itemId === 'truth_feather' ? '#fff0b2' : '#66e0bf';
    ctx.shadowBlur = Game.progress.scaleCleared ? 14 : 7;
    ctx.drawImage(itemImage, centerX - width / 2, bottomY - height, width, height);
    ctx.restore();
  }

  function drawCanvasPan(ctx, x, y, itemId) {
    ctx.strokeStyle = '#b98b3d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 42, -53); ctx.lineTo(x - 58, y);
    ctx.moveTo(x + 42, -53); ctx.lineTo(x + 58, y);
    ctx.stroke();
    ctx.fillStyle = '#735027';
    ctx.beginPath();
    ctx.ellipse(x, y, 72, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    if (itemId) {
      const isFeather = itemId === 'truth_feather';
      drawScaleItemGraphic(ctx, itemId, x, y + 4, isFeather ? 92 : 54, isFeather ? 38 : 58);
    }
  }

  function drawItemDisplay(ctx, obj) {
    const item = trialItems[obj.itemId];
    const collected = Game.progress.collectedTrialItems[obj.itemId];
    const altarImage = judgementAltarImages[obj.itemId];
    ctx.save();
    ctx.translate(obj.x, obj.y);

    if (altarImage?.complete && altarImage.naturalWidth) {
      ctx.globalAlpha = collected ? 0.58 : 1;
      ctx.drawImage(altarImage, -obj.width / 2, -obj.height / 2, obj.width, obj.height);
      ctx.globalAlpha = 1;
      if (!collected) {
        drawTrialItemOnAltar(ctx, obj);
      }
      ctx.restore();
      return;
    }

    ctx.fillStyle = '#4e3428';
    ctx.strokeStyle = '#a8793b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-55, 70); ctx.lineTo(-43, -15); ctx.lineTo(43, -15); ctx.lineTo(55, 70); ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#a8793b';
    ctx.fillRect(-60, 66, 120, 13);
    if (!collected) {
      ctx.shadowColor = item.color;
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#ead49a';
      ctx.font = 'bold 14px serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.shortName, 0, -36);
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = '#d8b46a';
    ctx.font = 'bold 13px serif';
    ctx.textAlign = 'center';
    ctx.fillText(item.shortName, 0, 52);
    ctx.restore();
  }

  function drawTrialItemOnAltar(ctx, obj) {
    const itemImage = judgementTrialItemImages[obj.itemId];
    if (!itemImage?.complete || !itemImage.naturalWidth) return;

    const itemWidth = obj.width * judgementTrialItemWidthRatios[obj.itemId];
    const itemHeight = itemWidth * itemImage.naturalHeight / itemImage.naturalWidth;
    const platformY = -obj.height * 0.27;

    ctx.save();
    ctx.shadowColor = trialItems[obj.itemId].color;
    ctx.shadowBlur = 12;
    ctx.drawImage(
      itemImage,
      -itemWidth / 2,
      platformY - itemHeight,
      itemWidth,
      itemHeight
    );
    ctx.restore();
  }

  function drawJudgementDoor(ctx, obj) {
    const isExit = obj.id === 'judgement_exit';
    const open = isExit && Game.progress.scaleCleared;
    ctx.save();
    ctx.translate(obj.x, obj.y);

    const exitDoorAsset = open ? judgementOpenedPharaohDoorImage : judgementPharaohDoorImage;
    if (isExit && exitDoorAsset.complete && exitDoorAsset.naturalWidth) {
      if (open) {
        ctx.shadowColor = '#ffd66d';
        ctx.shadowBlur = 22;
      }
      ctx.drawImage(
        exitDoorAsset,
        -obj.width / 2,
        -obj.height / 2,
        obj.width,
        obj.height
      );
      ctx.restore();
      return;
    }

    if (!isExit) {
      const doorAsset = judgementDoorClosedImage;
      if (doorAsset.complete && doorAsset.naturalWidth) {
        ctx.drawImage(doorAsset, -obj.width / 2, -obj.height / 2, obj.width, obj.height);
        drawJudgementDoorTorches(ctx);
        ctx.restore();
        return;
      }
    }

    ctx.fillStyle = open ? '#0b0908' : '#3c2a22';
    ctx.strokeStyle = open ? '#f1cf69' : '#9a713a';
    ctx.lineWidth = 8;
    ctx.fillRect(-obj.width / 2, -obj.height / 2, obj.width, obj.height);
    ctx.strokeRect(-obj.width / 2, -obj.height / 2, obj.width, obj.height);
    if (!open) {
      ctx.fillStyle = '#c99a4a';
      ctx.font = '42px serif';
      ctx.textAlign = 'center';
      ctx.fillText(isExit ? '⚖' : '☀', 0, 5);
      ctx.font = '22px serif';
      ctx.fillText('𓂀 𓋹 𓆣', 0, 56);
    } else {
      const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 120);
      glow.addColorStop(0, 'rgba(255, 225, 120, 0.82)');
      glow.addColorStop(1, 'rgba(255, 190, 50, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(-90, -150, 180, 300);
    }
    ctx.restore();
  }

  function drawJudgementDoorTorches(ctx) {
    if (!judgementTorchImage.complete || !judgementTorchImage.naturalWidth) return;

    const entrance = judgementSceneObjects.find(obj => obj.id === 'judgement_entrance');
    judgementTorchPositions.forEach((position, index) => {
      const torchX = position.x - entrance.x;
      const torchY = position.y - entrance.y;
      const torchWidth = position.width;
      const torchHeight = position.height;
      const flicker = Math.sin(performance.now() * 0.012 + index * 1.7) * 3;
      const glowRadius = torchHeight * 0.8 + flicker;
      const flameY = torchY - torchHeight * 0.34;
      const glow = ctx.createRadialGradient(torchX, flameY, 3, torchX, flameY, glowRadius);
      glow.addColorStop(0, 'rgba(255, 220, 125, 0.72)');
      glow.addColorStop(0.45, 'rgba(255, 139, 30, 0.27)');
      glow.addColorStop(1, 'rgba(255, 92, 0, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(torchX, flameY, glowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(
        judgementTorchImage,
        torchX - torchWidth / 2,
        torchY - torchHeight / 2,
        torchWidth,
        torchHeight
      );

    });
  }

  function setupJudgementEvents() {
    document.getElementById('scale-left-pan')?.addEventListener('click', () => placeSelectedItem('left'));
    document.getElementById('scale-right-pan')?.addEventListener('click', () => placeSelectedItem('right'));
    document.getElementById('submit-scale-btn')?.addEventListener('click', submitScalePuzzle);
  }

  window.addEventListener('DOMContentLoaded', setupJudgementEvents);
})();
