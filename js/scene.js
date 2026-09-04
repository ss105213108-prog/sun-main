/**
 * 《太陽之心：法老的試煉》
 * 模組：js/scene.js
 * 負責：遊戲核心狀態管理、背景及場景物件渲染、提燈黑暗遮罩
 */

// 載入實體火把與地板圖片 (assets/items/torch.png & assets/backgrounds/地板.png)
const torchImage = new Image();
torchImage.src = 'assets/items/torch.png';

const rubbleImage = new Image();
rubbleImage.src = 'assets/道具/石堆.png';

const floorImage = new Image();
floorImage.src = 'assets/backgrounds/floor.png';

// 載入實體彩繪壁畫圖片 (assets/items/mural.png)
const muralImage = new Image();
muralImage.src = 'assets/items/mural.png';

// 火把預設位置與自訂儲存讀取 (預設適中高度 y = 145px，均勻分佈於 3600px 長廊)
const defaultTorchPositions = [
  { x: 320, y: 145 },
  { x: 1200, y: 145 },
  { x: 2000, y: 145 },
  { x: 2750, y: 145 },
  { x: 3350, y: 145 }
];

let torchPositions = defaultTorchPositions;

// 從 localStorage 載入使用者親手擺放與儲存的火把格式 (鎖定不可再調整)
try {
  const saved = localStorage.getItem('customTorchPositions');
  if (saved) {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.length > 0) {
      torchPositions = parsed.map(t => typeof t === 'number' ? { x: t, y: 145 } : t);
    }
  }
} catch (e) {}

window.torchPositions = torchPositions;

// 地板預設設定與自訂儲存讀取 (預設套用 3張對分無變形模式，專為 48:9 打造)
const defaultFloorSettings = {
  tileMode: 'THREE', // 'THREE' (3張對分, 與 48:9 長寬比近乎 100% 吻合), 'TWO' 或 'ONE'
  height: 140,      // 顯示高度 140px
  offsetY: 0        // 上下微調偏移
};

let floorSettings = defaultFloorSettings;

// 壁畫預設設定與自訂儲存讀取 (預設 3600px 長廊前段 X: 650)
const defaultMuralSettings = {
  x: 650,
  y: 240,
  width: 280,
  height: 156
};

let muralSettings = defaultMuralSettings;

try {
  const savedMural = localStorage.getItem('customMuralSettings');
  if (savedMural) {
    muralSettings = Object.assign({}, defaultMuralSettings, JSON.parse(savedMural));
  }
} catch (e) {}

window.muralSettings = muralSettings;
let isEditingMural = false;
let isDraggingMural = false;

window.floorSettings = floorSettings;
let isEditingFloor = false;

// 牆面背景預設設定與自訂儲存讀取
const defaultWallSettings = {
  offsetY: 0, // 上下垂直偏移
  scale: 1.0  // 背景圖顯示縮放比例
};

let wallSettings = defaultWallSettings;

try {
  const savedWall = localStorage.getItem('customWallSettings');
  if (savedWall) {
    wallSettings = Object.assign({}, defaultWallSettings, JSON.parse(savedWall));
  }
} catch (e) {}

window.wallSettings = wallSettings;
let isEditingWall = false;

// 太陽石門預設設定與自訂儲存讀取 (原圖 1672x941，長寬比 1.777 : 1，預設長廊終點 X: 3500)
const defaultDoorSettings = {
  x: 3500,
  y: 350,
  width: 320,
  height: 180
};

let doorSettings = defaultDoorSettings;

try {
  const savedDoor = localStorage.getItem('customDoorSettings');
  if (savedDoor) {
    doorSettings = Object.assign({}, defaultDoorSettings, JSON.parse(savedDoor));
    doorSettings.height = Math.round(doorSettings.width / 1.777);
  }
} catch (e) {}

// 石門專屬左右壁掛火把：儲存相對石門中心的偏移，石門移動後仍會跟隨。
const defaultDoorTorchSettings = {
  width: 22,
  height: 66,
  offsets: [
    { x: -90, y: -138 },
    { x: 90, y: -138 }
  ]
};

let doorTorchSettings = JSON.parse(JSON.stringify(defaultDoorTorchSettings));
try {
  const savedDoorTorches = localStorage.getItem('customDoorTorchSettings');
  if (savedDoorTorches) {
    const parsed = JSON.parse(savedDoorTorches);
    if (Array.isArray(parsed.offsets) && parsed.offsets.length === 2) {
      doorTorchSettings = Object.assign(doorTorchSettings, parsed);
    }
  }
} catch (e) {}

function getDoorTorchPositions() {
  return doorTorchSettings.offsets.map((offset, index) => ({
    x: doorSettings.x + offset.x,
    y: doorSettings.y + offset.y,
    index,
    isDoorTorch: true
  }));
}

function isTorchNearDoor(torchX) {
  return Math.abs(torchX - doorSettings.x) < doorSettings.width * 0.58;
}

window.doorSettings = doorSettings;
let isEditingDoor = false;
let isDraggingDoor = false;

// 拉神石像預設設定與自訂儲存讀取 (原圖 1024x1536，長寬比 0.667 : 1，預設祭壇守護位 X: 2450)
const defaultStatueSettings = {
  x: 2450,
  y: 340,
  width: 160,
  height: 240
};

let statueSettings = defaultStatueSettings;

try {
  const savedStatue = localStorage.getItem('customStatueSettings');
  if (savedStatue) {
    statueSettings = Object.assign({}, defaultStatueSettings, JSON.parse(savedStatue));
    statueSettings.height = Math.round(statueSettings.width / 0.667);
  }
} catch (e) {}

window.statueSettings = statueSettings;
let isEditingStatue = false;
let isDraggingStatue = false;

// 石碑預設設定與自訂儲存讀取 (原圖 2400x1340，長寬比 1.791 : 1，預設中庭核心 X: 1800)
const defaultTabletSettings = {
  x: 1800,
  y: 280,
  width: 250,
  height: 140
};

let tabletSettings = defaultTabletSettings;

try {
  const savedTablet = localStorage.getItem('customTabletSettings');
  if (savedTablet) {
    tabletSettings = Object.assign({}, defaultTabletSettings, JSON.parse(savedTablet));
    // 自動按原始圖像比例 (1.791) 修正高度，防止舊快取壓縮圖片
    tabletSettings.height = Math.round(tabletSettings.width / 1.791);
  }
} catch (e) {}

window.tabletSettings = tabletSettings;
let isEditingTablet = false;
let isDraggingTablet = false;

// 四個祭壇設定 (原圖 2135x736，黃金比例 2.901 : 1，預設解謎神壇 X: 3000)
const defaultAltarsSettings = {
  x: 3000,
  y: 400,
  width: 450,
  height: 155
};

let altarsSettings = defaultAltarsSettings;

try {
  const savedAltars = localStorage.getItem('customAltarsSettings');
  if (savedAltars) {
    altarsSettings = Object.assign({}, defaultAltarsSettings, JSON.parse(savedAltars));
    altarsSettings.height = Math.round(altarsSettings.width / 2.901);
  }
} catch (e) {}

window.altarsSettings = altarsSettings;
let isEditingAltars = false;
let isDraggingAltars = false;

// 祭壇石板預設設定與自訂儲存讀取 (原圖 2172x724，長寬比 3 : 1)
const defaultSlatesSettings = {
  x: 1000,
  y: 380,
  width: 240,
  height: 80
};

let slatesSettings = defaultSlatesSettings;

try {
  const savedSlates = localStorage.getItem('customSlatesSettings');
  if (savedSlates) {
    slatesSettings = Object.assign({}, defaultSlatesSettings, JSON.parse(savedSlates));
    slatesSettings.height = Math.round(slatesSettings.width / 3);
  }
} catch (e) {}

window.slatesSettings = slatesSettings;
let isEditingSlates = false;
let isDraggingSlates = false;

let isEditingTorches = false;
let isDraggingTorch = false;
let selectedTorchIndex = -1;
let lockY = true;

// 火把調查熱點設定 (預設 X: 1200，可由玩家自由調整擺放)
const defaultTorchHotspot = { x: 1200, y: 350, width: 80, height: 160 };
let torchHotspotSettings = Object.assign({}, defaultTorchHotspot);
try {
  const savedHotspot = localStorage.getItem('customTorchHotspot');
  if (savedHotspot) {
    torchHotspotSettings = Object.assign({}, defaultTorchHotspot, JSON.parse(savedHotspot));
  }
} catch (e) {}

let isEditingTorchHotspot = false;

// 建立全域 Game 命名空間
window.Game = {
  state: 'PLAYING', // PLAYING, DIALOGUE, PUZZLE, BAG, CUTSCENE
  canvas: null,
  ctx: null,
  cameraX: 0,
  cameraTargetX: null,
  width: 960,
  height: 540,
  worldWidth: 3600,
  currentScene: 'sun_temple',

  // 過場動畫與環境演出狀態
  inCutscene: false,
  cutsceneStep: 0,
  screenShake: { duration: 0, magnitude: 0, elapsed: 0, offsetX: 0, offsetY: 0 },
  fallingRocks: [],
  dustParticles: [],
  entranceBlocked: false,
  rockslideStartedAt: 0,
  rockslideSettledAt: 0,
  rubbleBoundaryX: 215,

  // 網址加上 ?test=1 時啟用快速計時測試，不影響正式版 15 分鐘設定。
  testMode: new URLSearchParams(window.location.search).get('test') === '1',

  // 網站入口身分；正式帳號資料由後端登入成功後填入。
  isGuest: null,
  authUser: null,

  // 完整流程測試：從第一場景正常開始。
  startInScene2ForDevelopment: false,

  // 完整流程測試：從第一場景依序進入審判室與法老王墓室。
  startInScene3ForDevelopment: false,

  // 15 分鐘封印倒數計時器
  timer: {
    remainingSeconds: 15 * 60,
    isRunning: false,
    lastTick: 0,
    // 正式測試已啟用：封印觸發後正常進行 15 分鐘倒數。
    pausedForDevelopment: false
  },

  // 遊戲進度
  progress: {
    investigatedMural: false,
    investigatedTablet: false,
    puzzleCleared: false,
    torchTaken: false,
    doorOpened: false,
    awakeningStartedAt: 0,
    sunBadgeRevealed: false,
    sunBadgeTaken: false,
    sunBadgePlaced: false,
    scene2Entered: false,
    judgementMuralRead: false,
    scaleCompartmentOpened: false,
    scaleCompartmentSealed: false,
    scalePuzzleIntroduced: false,
    priestAmuletFound: false,
    scaleCleared: false,
    scaleMistakes: 0,
    collectedTrialItems: {},
    scene3Entered: false,
    tombMechanismActivated: false,
    mirrorPuzzleSolved: false,
    sealedHeartAltarViewed: false,
    sunHeartAltarRevealed: false,
    tombEscapeActive: false,
    sunHeartTaken: null,
    endingId: null
  },

  scaleState: {
    left: null,
    right: null
  },

  mirrorState: [0, 0, 0],

  // 背包與機關
  inventory: [],
  selectedItem: null,

  // 對話系統
  dialogue: {
    speaker: '',
    text: '',
    callback: null,
    charIndex: 0,
    typingTimer: null,
    fullText: '',
    isTyping: false
  },

  currentInteractiveTarget: null,
  particles: []
};

// 載入古埃及 48:9 超寬全景牆面場景背景圖
const bgImage = new Image();
bgImage.src = 'assets/backgrounds/wall_48_9.png';

// 載入古埃及太陽石門素材 (關上的石門.png)
const doorImage = new Image();
doorImage.src = 'assets/items/door_closed.png';

const doorOpenedImage = new Image();
doorOpenedImage.src = 'assets/道具/開啟的石門.png';

// 載入拉神守護雕像素材 (關閉的石像.png & 打開的石像.png)
const statueClosedImage = new Image();
statueClosedImage.src = 'assets/items/statue_closed.png';

const statueOpenedImage = new Image();
statueOpenedImage.src = 'assets/items/statue_opened.png';

// 第一試煉完成後，由拉神石像底部暗格出現的太陽徽章。
const sunBadgeImage = new Image();
sunBadgeImage.src = 'assets/道具/太陽徽章.png';

// 載入古埃及實體石碑道具素材 (assets/items/石碑.png)
const tabletImage = new Image();
tabletImage.src = 'assets/items/石碑.png';

// 載入古埃及四個祭壇實體道具素材 (assets/items/altars4.png / assets/道具/四個祭壇.png)
const altarsImage = new Image();
altarsImage.src = 'assets/items/altars4.png';

// 載入古埃及祭壇石板實體道具素材 (assets/items/slates4.png / assets/道具/祭壇石板.png)
const slatesImage = new Image();
slatesImage.src = 'assets/items/slates4.png';

// 定義場景中的固定可互動物件 (3 個探索點 ＋ 四大祭壇)
const sceneObjects = [
  {
    id: 'mural',
    x: 700,
    y: 310,
    width: 140,
    height: 180,
    label: '📜 古代壁畫',
    description: '刻在粗糙石壁上的大面積彩繪壁畫，斑駁的線條描繪著法老統治下的日常繁榮。',
    onInteract: () => {
      Game.progress.investigatedMural = true;
      if (!Game.inventory.includes('slate_bird')) {
        Game.inventory.push('slate_bird');
        audio.play('item');
        window.triggerDialogue('古老銘文', [
          '『拉神的榮耀散落於聖殿四方——』',
          '『聖鷹棲於繁華壁畫之隙，太陽藏於長明烈火之畔，生命埋於黑色石碑之底，川流已歸於第四祭壇之位。』'
        ], () => {
          window.triggerDialogue('亞倫・卡特', [
            '「等等，壁畫下方果然有個凹槽暗格！」',
            '「太好了！我在裡面找到了【聖鷹石板】！」',
            '「這段銘文指引了其餘石板的位置，長明火把與黑色石碑……去那邊找找看吧！」'
          ]);
        });
      } else {
        window.triggerDialogue('古老銘文', [
          '『拉神的榮耀散落於聖殿四方——』',
          '『聖鷹棲於繁華壁畫之隙，太陽藏於長明烈火之畔，生命埋於黑色石碑之底，川流已歸於第四祭壇之位。』'
        ], () => {
          window.triggerDialogue('亞倫・卡特', [
            '「壁畫暗格裡的聖鷹石板已經被取出了。」',
            '「銘文提示著長明火把與黑色石碑。」'
          ]);
        });
      }
    }
  },
  {
    id: 'torch_stand',
    x: torchHotspotSettings.x,
    y: 350,
    width: 80,
    height: 160,
    label: '🔥 長明火把',
    description: '一座青銅雕花的神聖長明壁燈，下方隱約透出神秘的金光。',
    onInteract: () => {
      // 必須先調查過壁畫得知銘文線索，才能發現火把暗格
      if (!Game.progress.investigatedMural) {
        window.triggerDialogue('亞倫・卡特', [
          '「這是一座青銅雕花的長明火把，古老的火焰靜靜燃燒著。」',
          '「先去神殿長廊四處看看有沒有其他線索吧。」'
        ]);
        return;
      }

      if (!Game.progress.torchTaken) {
        Game.progress.torchTaken = true;
        if (!Game.inventory.includes('torch')) Game.inventory.push('torch');
        if (!Game.inventory.includes('slate_sun')) Game.inventory.push('slate_sun');
        audio.play('item');
        window.triggerDialogue('亞倫・卡特', [
          '「如壁畫銘文所言：『太陽藏於長明烈火之畔』！」',
          '「我把長明火把從壁座上取下來了。接下來的路很暗，正好派得上用場。」',
          '「火把後方的石壁暗格裡，還藏著一塊散發微溫的【太陽石板】！」'
        ]);
      } else {
        window.triggerDialogue('亞倫・卡特', [
          '「牆上的壁座已經空了，火把現在在我手上。」'
        ]);
      }
    }
  },
  {
    id: 'tablet',
    x: 1400,
    y: 340,
    width: 80,
    height: 150,
    label: '🗿 審判石碑',
    description: '一塊巨大的黑色玄武岩石碑，直立在沙土中，上面布滿了深深的刻痕。',
    onInteract: () => {
      const hasMuralContext = Game.progress.investigatedMural;
      Game.progress.investigatedTablet = true;
      if (!Game.inventory.includes('slate_life')) {
        Game.inventory.push('slate_life');
        audio.play('item');
        const tabletDialogue = hasMuralContext
          ? [
              '「石碑上清晰刻著箴言：『太陽升起，聖鷹飛翔，生命甦醒，河流滋養大地。』」',
              '「『太陽 ➔ 鷹 ➔ 甲蟲/生命 ➔ 尼羅河』，這就是石板的排列順序！」',
              '「而且我在石碑底部的裂隙裡，找到了【生命石板】！」'
            ]
          : [
              '「石碑上清晰刻著箴言：『太陽升起，聖鷹飛翔，生命甦醒，河流滋養大地。』」',
              '「這些符號似乎有某種順序，但我還不知道它們和什麼有關。」',
              '「等等，石碑底座下方有一道不自然的裂隙……裡面卡著一塊【生命石板】。雖然還不知道用途，先收起來再說。」'
            ];
        window.triggerDialogue('亞倫・卡特', tabletDialogue);
      } else {
        window.triggerDialogue('亞倫・卡特', hasMuralContext
          ? [
              '「石碑上記錄著正確的排列順序：『太陽 ➔ 鷹 ➔ 甲蟲/生命 ➔ 尼羅河』。」',
              '「底座的生命石板已經被取出了。」'
            ]
          : [
              '「碑文上的符號應該藏著某種順序，只是我目前還無法判斷它和什麼有關。」',
              '「底座那道裂隙裡的石板已經被我取出來了。」'
            ]);
      }
    }
  },
  {
    id: 'altars',
    x: 2150,
    y: 290,
    width: 450,
    height: 155,
    label: '🏺 太陽神四大祭壇',
    description: '四座莊嚴佇立的古埃及雪花石膏祭壇，雕刻著聖鷹、太陽與神秘卡槽。',
    onInteract: () => {
      if (Game.progress.puzzleCleared) {
        window.triggerDialogue('亞倫・卡特', [
          '「四大祭壇的太陽印記已經全部亮起。」',
          '「暗道入口的封印成功解開了！」'
        ]);
        return;
      }

      const placedSlates = Object.values(window.slatesOrder || {});
      const slatesFound = [
        Game.inventory.includes('slate_sun') || placedSlates.includes('太陽'),
        Game.inventory.includes('slate_bird') || placedSlates.includes('鷹'),
        Game.inventory.includes('slate_life') || placedSlates.includes('生命') || placedSlates.includes('甲蟲')
      ].filter(Boolean).length;
      if (slatesFound === 0) {
        window.triggerDialogue('亞倫・卡特', [
          '「第四座祭壇已經安放了河川石板。」',
          '「但前三座祭壇還空著，目前沒有東西可以放上去，先去長廊找找吧！」'
        ]);
      } else {
        window.openPuzzle();
      }
    }
  },
  {
    id: 'door',
    x: doorSettings.x,
    y: doorSettings.y,
    width: doorSettings.width,
    height: doorSettings.height,
    label: '🚪 太陽石門',
    description: '刻著雙翼太陽與古老銘文的神聖石門。',
    onInteract: () => {
      if (Game.progress.doorOpened) {
        window.triggerDialogue('亞倫・卡特', [
          '「太陽石門已經開啟，後方就是通往下一道試煉的暗道。」',
          '「這枚徽章不是獎賞，而是下一道門的鑰匙。走吧。」'
        ], () => {
          if (window.enterJudgementChamber) window.enterJudgementChamber();
        });
      } else if (Game.progress.sunBadgeTaken && Game.inventory.includes('sun_badge')) {
        Game.progress.sunBadgePlaced = true;
        Game.inventory = Game.inventory.filter(itemId => itemId !== 'sun_badge');
        audio.play('correct');
        window.triggerDialogue('亞倫・卡特', [
          '「形狀完全吻合……我把太陽徽章嵌進了石門中央的凹槽。」',
          '「徽章亮起來了，金色光芒正沿著門上的刻紋向外延伸！」'
        ], () => {
          Game.progress.doorOpened = true;
          Game.progress.awakeningStartedAt = performance.now();
          audio.play('rumble');
          if (window.triggerScreenShake) window.triggerScreenShake(6, 1200);
          window.triggerDialogue('古墓的低語', [
            '『太陽之印已歸位，前路為理解王之意志者敞開。』',
            '「石門正在開啟，後面就是第二道試煉。」'
          ]);
        });
      } else if (Game.progress.puzzleCleared && !Game.progress.sunBadgeTaken) {
        window.triggerDialogue('亞倫・卡特', [
          '「石門中央留下了一個太陽形狀的凹槽。」',
          '「拉神石像底部的暗格剛才打開了，裡面的徽章或許就是鑰匙。」'
        ]);
      } else {
        window.triggerDialogue('亞倫・卡特', [
          '「石門上的太陽像是被某種力量鎖住了。」',
          '「這不是普通的墓室入口。」'
        ]);
      }
    }
  },
  {
    id: 'statue',
    x: statueSettings.x,
    y: statueSettings.y,
    width: statueSettings.width,
    height: statueSettings.height,
    label: '🗿 拉神石像',
    description: '威嚴佇立的拉神鷹頭雕像，頭頂頂著神聖金光圓盤。',
    onInteract: () => {
      if (Game.progress.puzzleCleared && !Game.progress.sunBadgeTaken) {
        Game.progress.sunBadgeRevealed = true;
        Game.progress.sunBadgeTaken = true;
        if (!Game.inventory.includes('sun_badge')) Game.inventory.push('sun_badge');
        audio.play('item');
        window.triggerDialogue('亞倫・卡特', [
          '「暗格裡靜靜躺著一枚刻有拉神之眼的徽章。」',
          '「我拿到了【太陽徽章】！」',
          '「它的形狀和右側石門中央的凹槽一模一樣，應該要把它放上去。」'
        ]);
      } else if (Game.progress.puzzleCleared) {
        window.triggerDialogue('拉神像的低語', [
          '「試煉已解，智慧的光芒照亮了幽暗密道。」',
          '「石像底部的暗格已經空了。」'
        ]);
      } else {
        window.triggerDialogue('亞倫・卡特', [
          '「這座拉神像雙手合十祈禱著，似乎在守護著神殿的秩序。」',
          '「底部的卡槽或許與長廊上的試煉有關。」'
        ]);
      }
    }
  }
];

// 暴露給外部使用的場景物件
Game.sceneObjects = sceneObjects;
window.sunTempleSceneObjects = sceneObjects;

// 1. 繪製 48:9 正確場景背景層與底部地板層 (3600px 黃金長廊)
function drawBackground(ctx) {
  if (Game.currentScene === 'pharaoh_tomb' && window.drawPharaohTombBackground) {
    window.drawPharaohTombBackground(ctx);
    return;
  }

  if (Game.currentScene === 'judgement_chamber' && window.drawJudgementBackground) {
    window.drawJudgementBackground(ctx);
    return;
  }

  Game.worldWidth = 3600; // 3600px 黃金平衡長廊世界寬度

  if (bgImage.complete && bgImage.naturalWidth !== 0) {
    const bgRatio = bgImage.naturalWidth / bgImage.naturalHeight;
    const scaledHeight = Math.round(Game.height * wallSettings.scale);
    const tileWidth = Math.round(scaledHeight * bgRatio);
    const wallY = wallSettings.offsetY;

    // 1. 平鋪繪製 48:9 古埃及神殿牆面全景背景圖直至填滿 3600px 世界寬度
    for (let x = 0; x < Game.worldWidth; x += tileWidth) {
      const drawW = Math.min(tileWidth, Game.worldWidth - x);
      ctx.drawImage(bgImage, 0, 0, (drawW / tileWidth) * bgImage.naturalWidth, bgImage.naturalHeight, x, wallY, drawW, scaledHeight);
    }

    // 2. 繪製專屬石磚寶石地板 (assets/backgrounds/地板.png)，以原始比例平鋪至 3600px
    if (floorImage.complete && floorImage.naturalWidth !== 0) {
      const floorH = floorSettings.height;
      const floorY = Game.height - floorH + floorSettings.offsetY;
      const floorRatio = floorImage.naturalWidth / floorImage.naturalHeight;
      const floorTileW = Math.round(floorH * floorRatio); // ~880px

      for (let fx = 0; fx < Game.worldWidth; fx += floorTileW) {
        const drawW = Math.min(floorTileW, Game.worldWidth - fx);
        ctx.drawImage(floorImage, 0, 0, (drawW / floorTileW) * floorImage.naturalWidth, floorImage.naturalHeight, fx, floorY, drawW, floorH);
      }

      // 同步自動更新主角站立對齊地面高度 (扎實踩在石磚地板面上)
      if (window.player) {
        window.player.y = floorY + 30;
      }
    }
    return;
  }

  // 向量 Fallback
  ctx.fillStyle = '#1c1512';
  ctx.fillRect(0, 0, Game.worldWidth, Game.height);
  ctx.strokeStyle = '#2b211c';
  ctx.lineWidth = 2;
  for (let x = 0; x < Game.worldWidth; x += 160) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 460); ctx.stroke();
  }
  for (let y = 0; y < 460; y += 80) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(Game.worldWidth, y); ctx.stroke();
  }
}
window.drawBackground = drawBackground;

// 2. 繪製中景可互動物件 (壁畫、石碑、祭壇與老鷹雕像)
function drawSceneObjects(ctx) {
  if (Game.currentScene === 'pharaoh_tomb' && window.drawPharaohTombSceneObjects) {
    window.drawPharaohTombSceneObjects(ctx);
    return;
  }

  if (Game.currentScene === 'judgement_chamber' && window.drawJudgementSceneObjects) {
    window.drawJudgementSceneObjects(ctx);
    return;
  }

  sceneObjects.forEach((obj) => {
    if (obj.id === 'mural') {
      obj.x = muralSettings.x;
      obj.y = muralSettings.y;
      obj.width = muralSettings.width;
      obj.height = muralSettings.height;
    }

    ctx.save();
    ctx.translate(obj.x, obj.y);

    if (obj.id === 'mural') {
      if (muralImage.complete && muralImage.naturalWidth !== 0) {
        ctx.drawImage(muralImage, -obj.width/2, -obj.height/2, obj.width, obj.height);
      }

      if (isEditingMural) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(-obj.width/2, -obj.height/2, obj.width, obj.height);

        const labelText = `🖼️ 壁畫 [X:${muralSettings.x}, Y:${muralSettings.y}, ${muralSettings.width}x${muralSettings.height}]`;
        ctx.font = 'bold 12px monospace';
        const tw = ctx.measureText(labelText).width + 12;
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(-tw/2, -obj.height/2 - 26, tw, 20);
        ctx.fillStyle = '#ffe066';
        ctx.textAlign = 'center';
        ctx.fillText(labelText, 0, -obj.height/2 - 12);
        ctx.textAlign = 'left';
      }
    } else if (obj.id === 'tablet') {
      obj.x = tabletSettings.x;
      obj.y = tabletSettings.y;
      obj.width = tabletSettings.width;
      obj.height = tabletSettings.height;

      if (tabletImage.complete && tabletImage.naturalWidth !== 0) {
        ctx.drawImage(tabletImage, -obj.width/2, -obj.height/2, obj.width, obj.height);
      } else {
        ctx.fillStyle = '#282321';
        ctx.beginPath();
        ctx.moveTo(-obj.width/2, obj.height/2);
        ctx.lineTo(-obj.width/2, -obj.height/2 + 20);
        ctx.lineTo(0, -obj.height/2);
        ctx.lineTo(obj.width/2, -obj.height/2 + 20);
        ctx.lineTo(obj.width/2, obj.height/2);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#423b38';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#5a504c';
        ctx.font = '10px serif';
        ctx.fillText('𓀀 𓀁 𓀂 𓀃', -20, -10);
        ctx.fillText('𓀄 𓀅 𓀆 𓀇', -20, 10);
      }

      if (isEditingTablet) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(-obj.width/2, -obj.height/2, obj.width, obj.height);

        const labelText = `🗿 石碑 [X:${tabletSettings.x}, Y:${tabletSettings.y}, ${tabletSettings.width}x${tabletSettings.height}]`;
        ctx.font = 'bold 12px monospace';
        const tw = ctx.measureText(labelText).width + 12;
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(-tw/2, -obj.height/2 - 26, tw, 20);
        ctx.fillStyle = '#ffe066';
        ctx.textAlign = 'center';
        ctx.fillText(labelText, 0, -obj.height/2 - 12);
        ctx.textAlign = 'left';
      }
    } else if (obj.id === 'slates') {
      obj.x = slatesSettings.x;
      obj.y = slatesSettings.y;
      obj.width = slatesSettings.width;
      obj.height = slatesSettings.height;

      if (slatesImage.complete && slatesImage.naturalWidth !== 0) {
        ctx.drawImage(slatesImage, -obj.width/2, -obj.height/2, obj.width, obj.height);
      }

      if (isEditingSlates) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(-obj.width/2, -obj.height/2, obj.width, obj.height);

        const labelText = `📜 祭壇石板 [X:${slatesSettings.x}, Y:${slatesSettings.y}, ${slatesSettings.width}x${slatesSettings.height}]`;
        ctx.font = 'bold 12px monospace';
        const tw = ctx.measureText(labelText).width + 12;
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(-tw/2, -obj.height/2 - 26, tw, 20);
        ctx.fillStyle = '#ffe066';
        ctx.textAlign = 'center';
        ctx.fillText(labelText, 0, -obj.height/2 - 12);
        ctx.textAlign = 'left';
      }
    } else if (obj.id === 'torch_stand') {
      obj.x = torchHotspotSettings.x;
      obj.y = torchHotspotSettings.y;

      // 僅在「調查過壁畫」且「尚未拾取太陽石板」時，火把下方石壁才散發神聖金光微塵
      if (Game.progress.investigatedMural && !Game.inventory.includes('slate_sun')) {
        const time = Date.now() * 0.003;
        ctx.fillStyle = 'rgba(255, 215, 0, 0.85)';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 12;
        for (let i = 0; i < 5; i++) {
          const px = Math.sin(time + i * 1.5) * 16;
          const py = Math.cos(time * 1.2 + i * 1.5) * 14 + 10;
          ctx.beginPath();
          ctx.arc(px, py, 2.5 + Math.sin(time + i) * 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      }

      if (isEditingTorchHotspot) {
        ctx.strokeStyle = '#ff9900';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(-obj.width/2, -obj.height/2, obj.width, obj.height);

        const labelText = `🔥 火把調查點 [X:${torchHotspotSettings.x}]`;
        ctx.font = 'bold 12px monospace';
        const tw = ctx.measureText(labelText).width + 12;
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(-tw/2, -obj.height/2 - 26, tw, 20);
        ctx.fillStyle = '#ffb84d';
        ctx.textAlign = 'center';
        ctx.fillText(labelText, 0, -obj.height/2 - 12);
        ctx.textAlign = 'left';
      }
    } else if (obj.id === 'altars') {
      obj.x = altarsSettings.x;
      obj.y = altarsSettings.y;
      obj.width = altarsSettings.width;
      obj.height = altarsSettings.height;

      if (altarsImage.complete && altarsImage.naturalWidth !== 0) {
        ctx.drawImage(altarsImage, -obj.width/2, -obj.height/2, obj.width, obj.height);
      }

      if (isEditingAltars) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(-obj.width/2, -obj.height/2, obj.width, obj.height);

        const labelText = `🏺 四個祭壇 [X:${altarsSettings.x}, Y:${altarsSettings.y}, ${altarsSettings.width}x${altarsSettings.height}]`;
        ctx.font = 'bold 12px monospace';
        const tw = ctx.measureText(labelText).width + 12;
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(-tw/2, -obj.height/2 - 26, tw, 20);
        ctx.fillStyle = '#ffe066';
        ctx.textAlign = 'center';
        ctx.fillText(labelText, 0, -obj.height/2 - 12);
        ctx.textAlign = 'left';
      }
    } else if (obj.id === 'door') {
      obj.x = doorSettings.x;
      obj.y = doorSettings.y;
      obj.width = doorSettings.width;
      obj.height = doorSettings.height;

      const openElapsed = Game.progress.awakeningStartedAt
        ? performance.now() - Game.progress.awakeningStartedAt
        : 0;
      const doorOpenProgress = Game.progress.doorOpened
        ? Math.min(1, openElapsed / 1100)
        : 0;

      if (doorImage.complete && doorImage.naturalWidth !== 0 && doorOpenProgress < 1) {
        ctx.globalAlpha = 1 - doorOpenProgress;
        ctx.drawImage(doorImage, -obj.width/2, -obj.height/2, obj.width, obj.height);
        ctx.globalAlpha = 1;
      }
      if (doorOpenProgress > 0 && doorOpenedImage.complete && doorOpenedImage.naturalWidth !== 0) {
        ctx.globalAlpha = doorOpenProgress;
        ctx.drawImage(doorOpenedImage, -obj.width/2, -obj.height/2, obj.width, obj.height);
        ctx.globalAlpha = 1;
      }

      // 徽章嵌入門上後，在石門完全開啟前持續顯示於中央凹槽。
      if (Game.progress.sunBadgePlaced && doorOpenProgress < 1 && sunBadgeImage.complete && sunBadgeImage.naturalWidth !== 0) {
        const badgeSize = Math.max(38, Math.min(62, obj.width * 0.18));
        ctx.save();
        ctx.globalAlpha = 1 - doorOpenProgress * 0.75;
        ctx.shadowColor = '#ffd85c';
        ctx.shadowBlur = 24;
        ctx.drawImage(sunBadgeImage, -badgeSize / 2, -badgeSize / 2, badgeSize, badgeSize);
        ctx.restore();
      }

      // 石門左右上方固定壁掛火把，石門移動或縮放時會自動保持對稱。
      if (torchImage.complete && torchImage.naturalWidth !== 0) {
        getDoorTorchPositions().forEach(torch => {
          const localX = torch.x - obj.x;
          const localY = torch.y - obj.y;
          const torchWidth = doorTorchSettings.width;
          const torchHeight = doorTorchSettings.height;
          ctx.drawImage(torchImage, localX - torchWidth / 2, localY - torchHeight * 0.2, torchWidth, torchHeight);

        });
      }

      if (isEditingDoor) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(-obj.width/2, -obj.height/2, obj.width, obj.height);

        const labelText = `🚪 太陽石門 [X:${doorSettings.x}, Y:${doorSettings.y}, ${doorSettings.width}x${doorSettings.height}]`;
        ctx.font = 'bold 12px monospace';
        const tw = ctx.measureText(labelText).width + 12;
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(-tw/2, -obj.height/2 - 26, tw, 20);
        ctx.fillStyle = '#ffe066';
        ctx.textAlign = 'center';
        ctx.fillText(labelText, 0, -obj.height/2 - 12);
        ctx.textAlign = 'left';
      }
    } else if (obj.id === 'statue') {
      obj.x = statueSettings.x;
      obj.y = statueSettings.y;
      obj.width = statueSettings.width;
      obj.height = statueSettings.height;

      if (Game.progress.puzzleCleared) {
        const pulse = 0.94 + Math.sin(performance.now() * 0.004) * 0.06;
        const glow = ctx.createRadialGradient(0, -obj.height * 0.12, 8, 0, -obj.height * 0.12, obj.width * 1.22);
        glow.addColorStop(0, `rgba(255, 245, 170, ${pulse})`);
        glow.addColorStop(0.32, 'rgba(255, 220, 90, 0.78)');
        glow.addColorStop(0.68, 'rgba(255, 185, 35, 0.34)');
        glow.addColorStop(1, 'rgba(255, 180, 20, 0)');
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, -obj.height * 0.12, obj.width * 1.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      const currentStatueImg = Game.progress.puzzleCleared ? statueOpenedImage : statueClosedImage;
      if (currentStatueImg.complete && currentStatueImg.naturalWidth !== 0) {
        if (Game.progress.puzzleCleared) {
          ctx.shadowColor = '#ffd85c';
          ctx.shadowBlur = 42 + Math.sin(performance.now() * 0.005) * 12;
        }
        ctx.drawImage(currentStatueImg, -obj.width/2, -obj.height/2, obj.width, obj.height);
        ctx.shadowBlur = 0;
        if (Game.progress.puzzleCleared) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = 0.28;
          ctx.drawImage(currentStatueImg, -obj.width/2, -obj.height/2, obj.width, obj.height);
          ctx.restore();
        }
      }

      // 解謎後在石像底部顯示可拾取的太陽徽章，取得後暗格保持空置。
      if (Game.progress.sunBadgeRevealed && !Game.progress.sunBadgeTaken) {
        const compartmentY = obj.height / 2 - 32;
        const floatY = Math.sin(performance.now() * 0.004) * 3;
        ctx.save();

        // 不繪製額外暗格框，只用柔和金光提示此處有可拾取物品。
        const badgeGlow = ctx.createRadialGradient(0, compartmentY, 4, 0, compartmentY, 52);
        badgeGlow.addColorStop(0, 'rgba(255, 250, 190, 0.92)');
        badgeGlow.addColorStop(0.42, 'rgba(255, 210, 75, 0.55)');
        badgeGlow.addColorStop(1, 'rgba(255, 180, 30, 0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = badgeGlow;
        ctx.beginPath();
        ctx.arc(0, compartmentY, 52, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowColor = '#ffd85c';
        ctx.shadowBlur = 22 + Math.sin(performance.now() * 0.006) * 5;
        if (sunBadgeImage.complete && sunBadgeImage.naturalWidth !== 0) {
          ctx.drawImage(sunBadgeImage, -27, compartmentY - 27 + floatY, 54, 54);
        }
        ctx.restore();
      }

      if (isEditingStatue) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(-obj.width/2, -obj.height/2, obj.width, obj.height);

        const labelText = `🗿 拉神石像 [X:${statueSettings.x}, Y:${statueSettings.y}, ${statueSettings.width}x${statueSettings.height}]`;
        ctx.font = 'bold 12px monospace';
        const tw = ctx.measureText(labelText).width + 12;
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(-tw/2, -obj.height/2 - 26, tw, 20);
        ctx.fillStyle = '#ffe066';
        ctx.textAlign = 'center';
        ctx.fillText(labelText, 0, -obj.height/2 - 12);
        ctx.textAlign = 'left';
      }
    }

    ctx.restore();
  });

  // 繪製左側被封死入口的巨石崩塌殘骸 (當 Game.entranceBlocked 為 true)
  if (Game.entranceBlocked) {
    ctx.save();
    const rubbleReveal = Game.rockslideStartedAt
      ? Math.min(1, (performance.now() - Game.rockslideStartedAt) / 1250)
      : 1;

    // 使用組員新放入的完整石堆 PNG；單張等比例呈現，避免重複疊圖破壞形狀。
    if (rubbleImage.complete && rubbleImage.naturalWidth !== 0) {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 1;
      drawRubbleLayer(ctx, 105, 300, 240, 360, 0);
      ctx.globalCompositeOperation = 'source-over';
    }

    // 瀰漫在碎石堆間的古老黃沙塵微粒
    ctx.globalAlpha = rubbleReveal;
    ctx.fillStyle = 'rgba(180, 145, 100, 0.4)';
    ctx.beginPath();
    ctx.arc(125, 465, 58, 0, Math.PI * 2);
    ctx.arc(90, 350, 42, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
window.drawSceneObjects = drawSceneObjects;

function drawRubbleLayer(ctx, centerX, centerY, width, height, rotation) {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(rotation);
  ctx.drawImage(rubbleImage, -width / 2, -height / 2, width, height);
  ctx.restore();
}

// 3. 繪製成功粒子效果與落石煙塵
function drawParticles(ctx) {
  // 繪製牆面實體火把圖案 (assets/items/torch.png)
  if (Game.currentScene === 'sun_temple' && torchImage.complete && torchImage.naturalWidth !== 0) {
    torchPositions.forEach((t, idx) => {
      const tx = typeof t === 'number' ? t : t.x;
      const ty = typeof t === 'number' ? 145 : t.y;

      // 石門附近改由專屬的對稱火把呈現，避免舊配置疊出第三支火把。
      if (isTorchNearDoor(tx) && !isEditingTorches) return;

      // 玩家取走互動點最近的火把後，牆面留下空壁座。
      if (Game.progress.torchTaken && Math.abs(tx - torchHotspotSettings.x) < 90) return;

      ctx.save();
      // 繪製微縮優雅的實體火把圖案 (寬 26px, 高 80px)
      ctx.drawImage(torchImage, tx - 13, ty - 15, 26, 80);

      // 火把擺放編輯模式下的選取標籤
      if (isEditingTorches) {
        const isSelected = (idx === selectedTorchIndex);
        ctx.strokeStyle = isSelected ? '#ffd700' : 'rgba(255, 215, 0, 0.4)';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(tx - 20, ty - 20, 40, 90);

        ctx.setLineDash([]);
        ctx.fillStyle = isSelected ? '#ffd700' : 'rgba(0,0,0,0.7)';
        ctx.fillRect(tx - 25, ty - 38, 50, 16);
        ctx.fillStyle = isSelected ? '#000' : '#fff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`🔥 #${idx+1}`, tx, ty - 26);
        ctx.textAlign = 'left';
      }
      ctx.restore();
    });
  }

  // 繪製開場落石崩塌動畫 (動態物理模擬)
  if (Game.fallingRocks && Game.fallingRocks.length > 0) {
    const settledElapsed = Game.rockslideSettledAt
      ? performance.now() - Game.rockslideSettledAt
      : 0;
    const fallingRockAlpha = Game.rockslideSettledAt
      ? Math.max(0, 1 - settledElapsed / 650)
      : 1;
    Game.fallingRocks.forEach(rock => {
      ctx.save();
      ctx.globalAlpha = fallingRockAlpha;
      ctx.translate(rock.x, rock.y);
      ctx.rotate(rock.rot);
      drawRockShape(ctx, rock.size, rock.size * 0.8, rock.color, rock.seed);
      ctx.restore();
    });
  }

  // 玩家取得火把後，持續把火把畫在人物手邊，走路與待機時都看得見。
  if (Game.progress.torchTaken && window.player && torchImage.complete && torchImage.naturalWidth !== 0) {
    const handX = player.x + (player.direction === 1 ? 23 : -23);
    const handY = player.y - 61;
    const flicker = 14 + Math.sin(performance.now() * 0.012) * 2;
    ctx.save();
    const heldGlow = ctx.createRadialGradient(handX, handY - 12, 2, handX, handY - 12, 72 + flicker);
    heldGlow.addColorStop(0, 'rgba(255, 225, 135, 0.8)');
    heldGlow.addColorStop(0.45, 'rgba(255, 145, 30, 0.3)');
    heldGlow.addColorStop(1, 'rgba(255, 100, 0, 0)');
    ctx.fillStyle = heldGlow;
    ctx.beginPath();
    ctx.arc(handX, handY - 12, 72 + flicker, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(handX, handY);
    if (player.direction === -1) ctx.scale(-1, 1);
    ctx.drawImage(torchImage, -7, -31, 14, 43);
    ctx.restore();
  }

  // 繪製崩塌煙塵煙霧粒子
  if (Game.dustParticles && Game.dustParticles.length > 0) {
    Game.dustParticles.forEach(dust => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, dust.alpha);
      ctx.fillStyle = dust.color || 'rgba(160, 130, 95, 0.6)';
      ctx.beginPath();
      ctx.arc(dust.x, dust.y, dust.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  Game.particles.forEach((p) => {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}
window.drawParticles = drawParticles;

function drawRockShape(ctx, width, height, color, seed = 0) {
  const points = 7;
  ctx.beginPath();
  for (let i = 0; i < points; i++) {
    const angle = (Math.PI * 2 * i) / points;
    const variation = 0.8 + ((Math.sin(seed * 13.7 + i * 4.1) + 1) * 0.1);
    const x = Math.cos(angle) * width * 0.5 * variation;
    const y = Math.sin(angle) * height * 0.5 * variation;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const rockFaceLight = ctx.createLinearGradient(-width * 0.42, -height * 0.42, width * 0.38, height * 0.4);
  rockFaceLight.addColorStop(0, 'rgba(246, 211, 165, 0.96)');
  rockFaceLight.addColorStop(0.32, color);
  rockFaceLight.addColorStop(1, '#49352a');
  ctx.fillStyle = rockFaceLight;
  ctx.strokeStyle = '#34251e';
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-width * 0.18, -height * 0.08);
  ctx.lineTo(width * 0.06, -height * 0.2);
  ctx.lineTo(width * 0.21, height * 0.05);
  ctx.strokeStyle = 'rgba(255, 226, 182, 0.68)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

// 觸發鏡頭劇烈震動
function triggerScreenShake(magnitude = 10, durationMs = 1500) {
  Game.screenShake.magnitude = magnitude;
  Game.screenShake.duration = durationMs;
  Game.screenShake.elapsed = 0;
}
window.triggerScreenShake = triggerScreenShake;

// 觸發入口巨石崩塌粒子物理模擬
function triggerRockslide(onComplete = null) {
  Game.fallingRocks = [];
  Game.dustParticles = [];
  Game.rockslideStartedAt = performance.now();
  Game.rockslideSettledAt = 0;
  Game.entranceBlocked = true;

  const rockColors = ['#b18666', '#c09270', '#9d765b', '#c79a76', '#8f6b52', '#d0a17b', '#a77d60'];

  // 生成 32 塊傾瀉而下的巨石
  for (let i = 0; i < 32; i++) {
    Game.fallingRocks.push({
      x: 10 + Math.random() * 160,
      y: -20 - Math.random() * 300,
      vx: (Math.random() - 0.3) * 2.5,
      vy: 4 + Math.random() * 8,
      gravity: 0.45,
      size: 20 + Math.random() * 32,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.2,
      targetGroundY: 420 + Math.random() * 70,
      color: rockColors[Math.floor(Math.random() * rockColors.length)],
      seed: i + Math.random(),
      bounced: false
    });
  }

  // 生成 50 個漫天飛舞的沙塵粒子
  for (let i = 0; i < 50; i++) {
    Game.dustParticles.push({
      x: Math.random() * 220,
      y: 420 + Math.random() * 80,
      vx: (Math.random() - 0.2) * 3,
      vy: -1 - Math.random() * 3.5,
      size: 15 + Math.random() * 30,
      alpha: 0.6 + Math.random() * 0.4,
      decay: 0.005 + Math.random() * 0.008,
      color: `rgba(${160 + Math.random()*40}, ${130 + Math.random()*30}, ${90 + Math.random()*20}, `
    });
  }

  // 石堆與落石同步演出；完成後讓程序落石淡出，避免壓在寫實石堆上形成異物。
  setTimeout(() => {
    const currentRockslide = Game.rockslideStartedAt;
    Game.rockslideSettledAt = performance.now();
    setTimeout(() => {
      if (Game.rockslideStartedAt === currentRockslide) Game.fallingRocks = [];
    }, 680);
    if (onComplete) onComplete();
  }, 1600);
}
window.triggerRockslide = triggerRockslide;

// 更新落石與煙塵粒子運動
function updateFallingRocksAndDust() {
  if (Game.fallingRocks && Game.fallingRocks.length > 0) {
    Game.fallingRocks.forEach(rock => {
      rock.vy += rock.gravity;
      rock.x += rock.vx;
      rock.y += rock.vy;
      rock.rot += rock.vRot;

      // 觸地反彈與堆積
      if (rock.y >= rock.targetGroundY) {
        rock.y = rock.targetGroundY;
        if (!rock.bounced) {
          rock.vy = -rock.vy * 0.3;
          rock.vx *= 0.5;
          rock.bounced = true;
        } else {
          rock.vy = 0;
          rock.vx = 0;
          rock.vRot = 0;
        }
      }
    });
  }

  if (Game.dustParticles && Game.dustParticles.length > 0) {
    for (let i = Game.dustParticles.length - 1; i >= 0; i--) {
      const d = Game.dustParticles[i];
      d.x += d.vx;
      d.y += d.vy;
      d.size += 0.3;
      d.alpha -= d.decay;
      if (d.alpha <= 0) {
        Game.dustParticles.splice(i, 1);
      }
    }
  }
}
window.updateFallingRocksAndDust = updateFallingRocksAndDust;

// 4. 火把光源與古墓環境遮罩 (Wall Torch Lighting Filter)
function applyLightingFilter(ctx) {
  if (Game.currentScene === 'pharaoh_tomb' && window.applyPharaohTombLighting) {
    window.applyPharaohTombLighting(ctx);
    return;
  }
  ctx.save();

  const offscreen = document.createElement('canvas');
  offscreen.width = Game.width;
  offscreen.height = Game.height;
  const octx = offscreen.getContext('2d');

  // 疊加 55% 不透明度的神秘古墓陰影遮罩
  octx.fillStyle = 'rgba(5, 4, 4, 0.55)';
  octx.fillRect(0, 0, Game.width, Game.height);

  octx.globalCompositeOperation = 'destination-out';

  // 針對一般火把與石門專屬火把投射動態金黃光暈。
  const lightingTorchPositions = torchPositions
    .filter(t => !isTorchNearDoor(typeof t === 'number' ? t : t.x))
    .concat(getDoorTorchPositions());

  lightingTorchPositions.forEach((t) => {
    const tx = typeof t === 'number' ? t : t.x;
    const ty = typeof t === 'number' ? 120 : t.y;

    if (Game.progress.torchTaken && Math.abs(tx - torchHotspotSettings.x) < 90) return;

    const screenTorchX = tx - Game.cameraX;
    const screenTorchY = ty - 10;

    // 只渲染可視範圍內的火把光源
    if (screenTorchX >= -350 && screenTorchX <= Game.width + 350) {
      const flicker = Math.sin(performance.now() * 0.008 + tx) * 10 + (Math.random() - 0.5) * 6;
      const baseRadius = t.isDoorTorch ? Math.max(150, doorTorchSettings.height * 3) : 260;
      const torchRadius = baseRadius + flicker;

      // 溫暖大氣的橘黃色火把漸層光暈 (Orange-Yellow Glow)
      const radGlow = octx.createRadialGradient(
        screenTorchX, screenTorchY, 10,
        screenTorchX, screenTorchY, torchRadius
      );
      radGlow.addColorStop(0, 'rgba(255, 210, 120, 1.0)');
      radGlow.addColorStop(0.35, 'rgba(255, 155, 45, 0.95)');
      radGlow.addColorStop(0.75, 'rgba(215, 100, 15, 0.45)');
      radGlow.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

      octx.fillStyle = radGlow;
      octx.beginPath();
      octx.arc(screenTorchX, screenTorchY, torchRadius, 0, Math.PI * 2);
      octx.fill();
    }
  });

  // 取下的火把成為玩家的移動光源。
  if (Game.progress.torchTaken && window.player) {
    const screenPlayerX = player.x - Game.cameraX + (player.direction === 1 ? 20 : -20);
    const playerLight = octx.createRadialGradient(screenPlayerX, player.y - 62, 8, screenPlayerX, player.y - 62, 205);
    playerLight.addColorStop(0, 'rgba(255, 220, 145, 0.96)');
    playerLight.addColorStop(0.5, 'rgba(255, 155, 45, 0.62)');
    playerLight.addColorStop(1, 'rgba(0, 0, 0, 0)');
    octx.fillStyle = playerLight;
    octx.beginPath();
    octx.arc(screenPlayerX, player.y - 62, 205, 0, Math.PI * 2);
    octx.fill();
  }

  // 解謎成功後，甦醒的拉神像本身成為金色光源，不再被全場陰影壓暗。
  if (Game.progress.puzzleCleared) {
    const statueScreenX = statueSettings.x - Game.cameraX;
    const statueScreenY = statueSettings.y - statueSettings.height * 0.12;
    const statueLightRadius = Math.max(210, statueSettings.width * 1.45);
    if (statueScreenX >= -statueLightRadius && statueScreenX <= Game.width + statueLightRadius) {
      const statueLight = octx.createRadialGradient(
        statueScreenX, statueScreenY, 12,
        statueScreenX, statueScreenY, statueLightRadius
      );
      statueLight.addColorStop(0, 'rgba(255, 255, 225, 0.98)');
      statueLight.addColorStop(0.46, 'rgba(255, 225, 130, 0.8)');
      statueLight.addColorStop(1, 'rgba(0, 0, 0, 0)');
      octx.fillStyle = statueLight;
      octx.beginPath();
      octx.arc(statueScreenX, statueScreenY, statueLightRadius, 0, Math.PI * 2);
      octx.fill();
    }
  }

  ctx.drawImage(offscreen, 0, 0);
  ctx.restore();
}
window.applyLightingFilter = applyLightingFilter;

function syncMuralObject() {
  const muralObj = sceneObjects.find(o => o.id === 'mural');
  if (muralObj) {
    muralObj.x = muralSettings.x;
    muralObj.y = muralSettings.y;
    muralObj.width = muralSettings.width;
    muralObj.height = muralSettings.height;
  }
}

// --- 壁畫視覺化手動擺放與微調編輯器互動事件處理 ---
function setupMuralEditorEvents() {
  const toggleBtn = document.getElementById('mural-editor-toggle-btn');
  const toolbar = document.getElementById('mural-editor-toolbar');
  const bringBtn = document.getElementById('mural-bring-btn');
  const leftBtn = document.getElementById('mural-left-btn');
  const rightBtn = document.getElementById('mural-right-btn');
  const upBtn = document.getElementById('mural-up-btn');
  const downBtn = document.getElementById('mural-down-btn');
  const expandBtn = document.getElementById('mural-expand-btn');
  const shrinkBtn = document.getElementById('mural-shrink-btn');
  const saveBtn = document.getElementById('mural-save-btn');
  const resetBtn = document.getElementById('mural-reset-btn');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isEditingMural = !isEditingMural;
      if (isEditingMural) {
        toolbar.classList.remove('hidden');
        toggleBtn.style.background = '#8c2a1b';

        // 關閉其他編輯器，避免互相干擾
        isEditingTorches = false;
        isEditingWall = false;
        isEditingFloor = false;
        const torchTb = document.getElementById('torch-editor-toolbar');
        const wallTb = document.getElementById('wall-editor-toolbar');
        const floorTb = document.getElementById('floor-editor-toolbar');
        if (torchTb) torchTb.classList.add('hidden');
        if (wallTb) wallTb.classList.add('hidden');
        if (floorTb) floorTb.classList.add('hidden');
      } else {
        toolbar.classList.add('hidden');
        toggleBtn.style.background = '';
      }
    });
  }

  if (bringBtn) {
    bringBtn.addEventListener('click', () => {
      if (window.player) {
        muralSettings.x = Math.round(player.x / 10) * 10;
        muralSettings.y = 260;
        alert(`🎯 已成功將彩繪壁畫快速移動至亞倫面前 (X: ${muralSettings.x}, Y: ${muralSettings.y})！`);
      }
    });
  }

  if (leftBtn) leftBtn.addEventListener('click', () => { muralSettings.x -= 10; });
  if (rightBtn) rightBtn.addEventListener('click', () => { muralSettings.x += 10; });
  if (upBtn) upBtn.addEventListener('click', () => { muralSettings.y -= 10; });
  if (downBtn) downBtn.addEventListener('click', () => { muralSettings.y += 10; });

  if (expandBtn) {
    expandBtn.addEventListener('click', () => {
      muralSettings.width += 20;
      muralSettings.height = Math.round(muralSettings.width / 1.791);
    });
  }

  if (shrinkBtn) {
    shrinkBtn.addEventListener('click', () => {
      muralSettings.width = Math.max(60, muralSettings.width - 20);
      muralSettings.height = Math.round(muralSettings.width / 1.791);
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const formatted = JSON.stringify(muralSettings);
      localStorage.setItem('customMuralSettings', formatted);
      alert('✅ 彩繪壁畫位置與尺寸已成功儲存！重新整理或重啟遊戲均會自動讀取：\n\n' + formatted);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      muralSettings = Object.assign({}, defaultMuralSettings);
      localStorage.removeItem('customMuralSettings');
      alert('🔄 已將彩繪壁畫位置與尺寸還原為預設設定！');
    });
  }

  // Canvas 滑鼠拖曳壁畫位置處理
  const canvas = document.getElementById('gameCanvas');
  if (canvas) {
    canvas.addEventListener('mousedown', (e) => {
      if (!isEditingMural) return;
      const rect = canvas.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) * (Game.width / rect.width);
      const clickY = (e.clientY - rect.top) * (Game.height / rect.height);
      const worldX = clickX + Game.cameraX;

      if (Math.abs(worldX - muralSettings.x) < muralSettings.width/2 + 60 &&
          Math.abs(clickY - muralSettings.y) < muralSettings.height/2 + 60) {
        isDraggingMural = true;
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!isEditingMural || !isDraggingMural) return;
      const rect = canvas.getBoundingClientRect();
      const moveX = (e.clientX - rect.left) * (Game.width / rect.width);
      const moveY = (e.clientY - rect.top) * (Game.height / rect.height);

      muralSettings.x = Math.round((moveX + Game.cameraX) / 10) * 10;
      muralSettings.y = Math.round(moveY / 10) * 10;
    });

    canvas.addEventListener('mouseup', () => {
      isDraggingMural = false;
    });
  }
}

// 在 DOM 載入完畢後綁定壁畫編輯器
window.addEventListener('DOMContentLoaded', () => {
  setupMuralEditorEvents();
});

// --- 全螢幕無邊框切換互動處理 ---
function setupFullscreenEvent() {
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.log(`Fullscreen error: ${err.message}`);
        });
        fullscreenBtn.textContent = 'exit 全螢幕';
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
          fullscreenBtn.textContent = '⛶ 全螢幕';
        }
      }
    });
  }
}

// --- 高對齊度火把擺放編輯器互動事件處理 ---
function setupTorchEditorEvents() {
  const toggleBtn = document.getElementById('torch-editor-toggle-btn');
  const toolbar = document.getElementById('torch-editor-toolbar');
  const bringBtn = document.getElementById('bring-torch-btn');
  const centerBtn = document.getElementById('center-torch-btn');
  const lockYBtn = document.getElementById('lock-y-btn');
  const nudgeLeftBtn = document.getElementById('nudge-left-btn');
  const nudgeRightBtn = document.getElementById('nudge-right-btn');
  const nudgeUpBtn = document.getElementById('nudge-up-btn');
  const nudgeDownBtn = document.getElementById('nudge-down-btn');
  const addBtn = document.getElementById('add-torch-btn');
  const delBtn = document.getElementById('del-torch-btn');
  const saveBtn = document.getElementById('save-torch-btn');
  const resetBtn = document.getElementById('reset-torch-btn');

  if (bringBtn) {
    bringBtn.addEventListener('click', () => {
      if (window.player) {
        const newX = Math.round(player.x / 10) * 10;
        if (selectedTorchIndex >= 0 && selectedTorchIndex < torchPositions.length) {
          torchPositions[selectedTorchIndex].x = newX;
        } else {
          torchPositions.push({ x: newX, y: 145 });
          selectedTorchIndex = torchPositions.length - 1;
        }
      }
    });
  }

  if (centerBtn) {
    centerBtn.addEventListener('click', () => {
      const count = torchPositions.length;
      if (count > 0) {
        const step = Game.worldWidth / (count + 1);
        torchPositions.forEach((t, idx) => {
          t.x = Math.round((step * (idx + 1)) / 10) * 10;
          t.y = 145;
        });
        alert(`🎯 已將 ${count} 支火把依全景畫布總寬度 (${Game.worldWidth}px) 100% 均勻置中整齊對齊！`);
      }
    });
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isEditingTorches = !isEditingTorches;
      if (isEditingTorches) {
        toolbar.classList.remove('hidden');
        toggleBtn.style.background = '#8c2a1b';
      } else {
        toolbar.classList.add('hidden');
        toggleBtn.style.background = '';
        selectedTorchIndex = -1;
      }
    });
  }

  if (lockYBtn) {
    lockYBtn.addEventListener('click', () => {
      lockY = !lockY;
      if (lockY) {
        lockYBtn.classList.add('active');
        // 自動將所有火把高度對齊為 Y = 145
        torchPositions.forEach(t => { t.y = 145; });
      } else {
        lockYBtn.classList.remove('active');
      }
    });
  }

  // 像素級微調按鈕
  if (nudgeLeftBtn) {
    nudgeLeftBtn.addEventListener('click', () => {
      if (selectedTorchIndex >= 0 && selectedTorchIndex < torchPositions.length) {
        torchPositions[selectedTorchIndex].x = Math.max(50, torchPositions[selectedTorchIndex].x - 10);
      }
    });
  }
  if (nudgeRightBtn) {
    nudgeRightBtn.addEventListener('click', () => {
      if (selectedTorchIndex >= 0 && selectedTorchIndex < torchPositions.length) {
        torchPositions[selectedTorchIndex].x = Math.min(Game.worldWidth - 50, torchPositions[selectedTorchIndex].x + 10);
      }
    });
  }
  if (nudgeUpBtn) {
    nudgeUpBtn.addEventListener('click', () => {
      if (selectedTorchIndex >= 0 && selectedTorchIndex < torchPositions.length) {
        torchPositions[selectedTorchIndex].y = Math.max(40, torchPositions[selectedTorchIndex].y - 5);
      }
    });
  }
  if (nudgeDownBtn) {
    nudgeDownBtn.addEventListener('click', () => {
      if (selectedTorchIndex >= 0 && selectedTorchIndex < torchPositions.length) {
        torchPositions[selectedTorchIndex].y = Math.min(350, torchPositions[selectedTorchIndex].y + 5);
      }
    });
  }

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const newX = Math.round((Game.cameraX + Game.width / 2) / 10) * 10;
      const targetY = lockY ? 145 : 145;
      torchPositions.push({ x: newX, y: targetY });
      selectedTorchIndex = torchPositions.length - 1;
    });
  }

  if (delBtn) {
    delBtn.addEventListener('click', () => {
      if (selectedTorchIndex >= 0 && selectedTorchIndex < torchPositions.length) {
        torchPositions.splice(selectedTorchIndex, 1);
        selectedTorchIndex = -1;
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const formatted = JSON.stringify(torchPositions);
      localStorage.setItem('customTorchPositions', formatted);
      alert('✅ 火把擺放與對齊格式已成功儲存！\n\n' + formatted);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      torchPositions = JSON.parse(JSON.stringify(defaultTorchPositions));
      localStorage.removeItem('customTorchPositions');
      selectedTorchIndex = -1;
      alert('🔄 已將火把擺放還原為預設對齊格式！');
    });
  }

  // Canvas 滑鼠拖曳點選處理 (支援同高度對齊鎖定與 10px 自動網格吸附)
  const canvas = document.getElementById('gameCanvas');
  if (canvas) {
    canvas.addEventListener('mousedown', (e) => {
      if (!isEditingTorches) return;
      const rect = canvas.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) * (Game.width / rect.width);
      const clickY = (e.clientY - rect.top) * (Game.height / rect.height);
      const worldX = clickX + Game.cameraX;

      let found = -1;
      torchPositions.forEach((t, idx) => {
        const tx = typeof t === 'number' ? t : t.x;
        const ty = typeof t === 'number' ? 145 : t.y;
        if (Math.abs(worldX - tx) < 40 && Math.abs(clickY - ty) < 60) {
          found = idx;
        }
      });

      if (found !== -1) {
        selectedTorchIndex = found;
        isDraggingTorch = true;
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!isEditingTorches || !isDraggingTorch || selectedTorchIndex === -1) return;
      const rect = canvas.getBoundingClientRect();
      const moveX = (e.clientX - rect.left) * (Game.width / rect.width);
      const moveY = (e.clientY - rect.top) * (Game.height / rect.height);

      // 自動網格吸附 10px，若開啟同高度對齊則 Y 固定為 145
      const snappedX = Math.round((moveX + Game.cameraX) / 10) * 10;
      const targetY = lockY ? 145 : Math.round(moveY);

      torchPositions[selectedTorchIndex] = {
        x: snappedX,
        y: targetY
      };
    });

    canvas.addEventListener('mouseup', () => {
      isDraggingTorch = false;
    });
  }
}

// --- 地板手動擺放與比例微調編輯器互動事件處理 ---
function setupFloorEditorEvents() {
  const toggleBtn = document.getElementById('floor-editor-toggle-btn');
  const toolbar = document.getElementById('floor-editor-toolbar');
  const modeBtn = document.getElementById('floor-mode-btn');
  const upBtn = document.getElementById('floor-up-btn');
  const downBtn = document.getElementById('floor-down-btn');
  const expandBtn = document.getElementById('floor-expand-btn');
  const shrinkBtn = document.getElementById('floor-shrink-btn');
  const saveBtn = document.getElementById('floor-save-btn');
  const resetBtn = document.getElementById('floor-reset-btn');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isEditingFloor = !isEditingFloor;
      if (isEditingFloor) {
        toolbar.classList.remove('hidden');
        toggleBtn.style.background = '#8c2a1b';
      } else {
        toolbar.classList.add('hidden');
        toggleBtn.style.background = '';
      }
    });
  }

  if (modeBtn) {
    modeBtn.addEventListener('click', () => {
      floorSettings.tileMode = (floorSettings.tileMode === 'TWO') ? 'ONE' : 'TWO';
      modeBtn.textContent = (floorSettings.tileMode === 'TWO') ? '↔️ 2張對半 (無變形)' : '↔️ 1張滿版';
      if (floorSettings.tileMode === 'TWO') modeBtn.classList.add('active');
      else modeBtn.classList.remove('active');
    });
  }

  if (upBtn) {
    upBtn.addEventListener('click', () => {
      floorSettings.offsetY -= 5;
    });
  }

  if (downBtn) {
    downBtn.addEventListener('click', () => {
      floorSettings.offsetY += 5;
    });
  }

  if (expandBtn) {
    expandBtn.addEventListener('click', () => {
      floorSettings.height += 10;
    });
  }

  if (shrinkBtn) {
    shrinkBtn.addEventListener('click', () => {
      floorSettings.height = Math.max(40, floorSettings.height - 10);
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const formatted = JSON.stringify(floorSettings);
      localStorage.setItem('customFloorSettings', formatted);
      alert('✅ 地板擺放與比例設定已成功儲存！重新整理或重啟遊戲均會自動讀取：\n\n' + formatted);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      floorSettings = Object.assign({}, defaultFloorSettings);
      localStorage.removeItem('customFloorSettings');
      if (modeBtn) {
        modeBtn.textContent = '↔️ 2張對半 (無變形)';
        modeBtn.classList.add('active');
      }
      alert('🔄 已將地板擺放與比例還原為預設 2 張對半無變形模式！');
    });
  }
}

// --- 牆面背景手動擺放與微調編輯器互動事件處理 ---
function setupWallEditorEvents() {
  const toggleBtn = document.getElementById('wall-editor-toggle-btn');
  const toolbar = document.getElementById('wall-editor-toolbar');
  const upBtn = document.getElementById('wall-up-btn');
  const downBtn = document.getElementById('wall-down-btn');
  const expandBtn = document.getElementById('wall-expand-btn');
  const shrinkBtn = document.getElementById('wall-shrink-btn');
  const saveBtn = document.getElementById('wall-save-btn');
  const resetBtn = document.getElementById('wall-reset-btn');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isEditingWall = !isEditingWall;
      if (isEditingWall) {
        toolbar.classList.remove('hidden');
        toggleBtn.style.background = '#8c2a1b';
      } else {
        toolbar.classList.add('hidden');
        toggleBtn.style.background = '';
      }
    });
  }

  if (upBtn) upBtn.addEventListener('click', () => { wallSettings.offsetY -= 5; });
  if (downBtn) downBtn.addEventListener('click', () => { wallSettings.offsetY += 5; });
  if (expandBtn) expandBtn.addEventListener('click', () => { wallSettings.scale += 0.05; });
  if (shrinkBtn) shrinkBtn.addEventListener('click', () => { wallSettings.scale = Math.max(0.5, wallSettings.scale - 0.05); });

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const formatted = JSON.stringify(wallSettings);
      localStorage.setItem('customWallSettings', formatted);
      alert('✅ 牆面背景位置與比例設定已成功儲存！重新整理或重啟遊戲均會自動讀取：\n\n' + formatted);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      wallSettings = Object.assign({}, defaultWallSettings);
      localStorage.removeItem('customWallSettings');
      alert('🔄 已將牆面背景還原為預設設定！');
    });
  }
}

function syncDoorObject() {
  const doorObj = sceneObjects.find(o => o.id === 'door');
  if (doorObj) {
    doorObj.x = doorSettings.x;
    doorObj.y = doorSettings.y;
    doorObj.width = doorSettings.width;
    doorObj.height = doorSettings.height;
  }
}

function updateDoorPosText() {
  const posText = document.getElementById('door-pos-text');
  if (posText) posText.textContent = `X:${doorSettings.x} Y:${doorSettings.y} [${doorSettings.width}x${doorSettings.height}]`;
}

// --- 太陽石門手動擺放與微調編輯器互動事件處理 ---
function setupDoorEditorEvents() {
  const toggleBtn = document.getElementById('door-editor-toggle-btn');
  const toolbar = document.getElementById('door-editor-toolbar');
  const bringBtn = document.getElementById('door-bring-btn');
  const leftBtn = document.getElementById('door-left-btn');
  const rightBtn = document.getElementById('door-right-btn');
  const upBtn = document.getElementById('door-up-btn');
  const downBtn = document.getElementById('door-down-btn');
  const expandBtn = document.getElementById('door-expand-btn');
  const shrinkBtn = document.getElementById('door-shrink-btn');
  const saveBtn = document.getElementById('door-save-btn');
  const resetBtn = document.getElementById('door-reset-btn');

  updateDoorPosText();

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isEditingDoor = !isEditingDoor;
      if (isEditingDoor) {
        if (toolbar) toolbar.classList.remove('hidden');
        toggleBtn.style.background = '#8c2a1b';

        // 關閉其他編輯器
        isEditingStatue = false;
        isEditingTorches = false;
        isEditingWall = false;
        isEditingFloor = false;
        const statueTb = document.getElementById('statue-editor-toolbar');
        if (statueTb) statueTb.classList.add('hidden');
      } else {
        if (toolbar) toolbar.classList.add('hidden');
        toggleBtn.style.background = '';
      }
    });
  }

  if (bringBtn) {
    bringBtn.addEventListener('click', () => {
      if (window.player) {
        doorSettings.x = Math.round(player.x / 10) * 10;
        doorSettings.y = 350;
        syncDoorObject();
        updateDoorPosText();
        alert(`🎯 已成功將太陽石門快速移動至亞倫面前 (X: ${doorSettings.x}, Y: ${doorSettings.y})！`);
      }
    });
  }

  if (leftBtn) leftBtn.addEventListener('click', () => { doorSettings.x -= 10; syncDoorObject(); updateDoorPosText(); });
  if (rightBtn) rightBtn.addEventListener('click', () => { doorSettings.x += 10; syncDoorObject(); updateDoorPosText(); });
  if (upBtn) upBtn.addEventListener('click', () => { doorSettings.y -= 5; syncDoorObject(); updateDoorPosText(); });
  if (downBtn) downBtn.addEventListener('click', () => { doorSettings.y += 5; syncDoorObject(); updateDoorPosText(); });

  if (expandBtn) {
    expandBtn.addEventListener('click', () => {
      doorSettings.width += 20;
      doorSettings.height = Math.round(doorSettings.width / 1.777);
      syncDoorObject();
      updateDoorPosText();
    });
  }

  if (shrinkBtn) {
    shrinkBtn.addEventListener('click', () => {
      doorSettings.width = Math.max(100, doorSettings.width - 20);
      doorSettings.height = Math.round(doorSettings.width / 1.777);
      syncDoorObject();
      updateDoorPosText();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const formatted = JSON.stringify(doorSettings);
      localStorage.setItem('customDoorSettings', formatted);
      alert('✅ 太陽石門位置與尺寸已成功儲存！重新整理或重啟遊戲均會自動讀取：\n\n' + formatted);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      doorSettings = Object.assign({}, defaultDoorSettings);
      localStorage.removeItem('customDoorSettings');
      syncDoorObject();
      updateDoorPosText();
      alert('🔄 已將太陽石門位置與尺寸還原為預設設定！');
    });
  }
}

function syncStatueObject() {
  const statueObj = sceneObjects.find(o => o.id === 'statue');
  if (statueObj) {
    statueObj.x = statueSettings.x;
    statueObj.y = statueSettings.y;
    statueObj.width = statueSettings.width;
    statueObj.height = statueSettings.height;
  }
}

function updateStatuePosText() {
  const posText = document.getElementById('statue-pos-text');
  if (posText) posText.textContent = `X:${statueSettings.x} Y:${statueSettings.y} [${statueSettings.width}x${statueSettings.height}]`;
}

// --- 拉神守護石像手動擺放與微調編輯器互動事件處理 ---
function setupStatueEditorEvents() {
  const toggleBtn = document.getElementById('statue-editor-toggle-btn');
  const toolbar = document.getElementById('statue-editor-toolbar');
  const bringBtn = document.getElementById('statue-bring-btn');
  const leftBtn = document.getElementById('statue-left-btn');
  const rightBtn = document.getElementById('statue-right-btn');
  const upBtn = document.getElementById('statue-up-btn');
  const downBtn = document.getElementById('statue-down-btn');
  const expandBtn = document.getElementById('statue-expand-btn');
  const shrinkBtn = document.getElementById('statue-shrink-btn');
  const saveBtn = document.getElementById('statue-save-btn');
  const resetBtn = document.getElementById('statue-reset-btn');

  updateStatuePosText();

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isEditingStatue = !isEditingStatue;
      if (isEditingStatue) {
        if (toolbar) toolbar.classList.remove('hidden');
        toggleBtn.style.background = '#8c2a1b';

        // 關閉其他編輯器
        isEditingDoor = false;
        isEditingTorches = false;
        isEditingWall = false;
        isEditingFloor = false;
        const doorTb = document.getElementById('door-editor-toolbar');
        if (doorTb) doorTb.classList.add('hidden');
      } else {
        if (toolbar) toolbar.classList.add('hidden');
        toggleBtn.style.background = '';
      }
    });
  }

  if (bringBtn) {
    bringBtn.addEventListener('click', () => {
      if (window.player) {
        statueSettings.x = Math.round(player.x / 10) * 10;
        statueSettings.y = 340;
        syncStatueObject();
        updateStatuePosText();
        alert(`🎯 已成功將拉神守護石像快速移動至亞倫面前 (X: ${statueSettings.x}, Y: ${statueSettings.y})！`);
      }
    });
  }

  if (leftBtn) leftBtn.addEventListener('click', () => { statueSettings.x -= 10; syncStatueObject(); updateStatuePosText(); });
  if (rightBtn) rightBtn.addEventListener('click', () => { statueSettings.x += 10; syncStatueObject(); updateStatuePosText(); });
  if (upBtn) upBtn.addEventListener('click', () => { statueSettings.y -= 5; syncStatueObject(); updateStatuePosText(); });
  if (downBtn) downBtn.addEventListener('click', () => { statueSettings.y += 5; syncStatueObject(); updateStatuePosText(); });

  if (expandBtn) {
    expandBtn.addEventListener('click', () => {
      statueSettings.width += 20;
      statueSettings.height = Math.round(statueSettings.width / 0.667);
      syncStatueObject();
      updateStatuePosText();
    });
  }

  if (shrinkBtn) {
    shrinkBtn.addEventListener('click', () => {
      statueSettings.width = Math.max(80, statueSettings.width - 20);
      statueSettings.height = Math.round(statueSettings.width / 0.667);
      syncStatueObject();
      updateStatuePosText();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const formatted = JSON.stringify(statueSettings);
      localStorage.setItem('customStatueSettings', formatted);
      alert('✅ 拉神守護石像位置與尺寸已成功儲存！重新整理或重啟遊戲均會自動讀取：\n\n' + formatted);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      statueSettings = Object.assign({}, defaultStatueSettings);
      localStorage.removeItem('customStatueSettings');
      syncStatueObject();
      updateStatuePosText();
      alert('🔄 已將拉神守護石像位置與尺寸還原為預設設定！');
    });
  }
}

function syncTabletObject() {
  const tabletObj = sceneObjects.find(o => o.id === 'tablet');
  if (tabletObj) {
    tabletObj.x = tabletSettings.x;
    tabletObj.y = tabletSettings.y;
    tabletObj.width = tabletSettings.width;
    tabletObj.height = tabletSettings.height;
  }
}

// --- 石碑手動擺放與微調編輯器互動事件處理 ---
function setupTabletEditorEvents() {
  const toggleBtn = document.getElementById('tablet-editor-toggle-btn');
  const toolbar = document.getElementById('tablet-editor-toolbar');
  const bringBtn = document.getElementById('tablet-bring-btn');
  const leftBtn = document.getElementById('tablet-left-btn');
  const rightBtn = document.getElementById('tablet-right-btn');
  const upBtn = document.getElementById('tablet-up-btn');
  const downBtn = document.getElementById('tablet-down-btn');
  const expandBtn = document.getElementById('tablet-expand-btn');
  const shrinkBtn = document.getElementById('tablet-shrink-btn');
  const saveBtn = document.getElementById('tablet-save-btn');
  const resetBtn = document.getElementById('tablet-reset-btn');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isEditingTablet = !isEditingTablet;
      if (isEditingTablet) {
        if (toolbar) toolbar.classList.remove('hidden');
        toggleBtn.style.background = '#8c2a1b';

        // 關閉其他編輯器
        isEditingTorches = false;
        isEditingWall = false;
        isEditingFloor = false;
        isEditingDoor = false;
        isEditingMural = false;
      } else {
        if (toolbar) toolbar.classList.add('hidden');
        toggleBtn.style.background = '';
      }
    });
  }

  if (bringBtn) {
    bringBtn.addEventListener('click', () => {
      if (window.player) {
        tabletSettings.x = Math.round(player.x / 10) * 10;
        tabletSettings.y = 280;
        syncTabletObject();
        alert(`🎯 已成功將審判石碑快速移動至亞倫面前 (X: ${tabletSettings.x}, Y: ${tabletSettings.y})！`);
      }
    });
  }

  if (leftBtn) leftBtn.addEventListener('click', () => { tabletSettings.x -= 10; syncTabletObject(); });
  if (rightBtn) rightBtn.addEventListener('click', () => { tabletSettings.x += 10; syncTabletObject(); });
  if (upBtn) upBtn.addEventListener('click', () => { tabletSettings.y -= 10; syncTabletObject(); });
  if (downBtn) downBtn.addEventListener('click', () => { tabletSettings.y += 10; syncTabletObject(); });

  if (expandBtn) {
    expandBtn.addEventListener('click', () => {
      tabletSettings.width += 20;
      tabletSettings.height = Math.round(tabletSettings.width / 1.791);
      syncTabletObject();
    });
  }

  if (shrinkBtn) {
    shrinkBtn.addEventListener('click', () => {
      tabletSettings.width = Math.max(60, tabletSettings.width - 20);
      tabletSettings.height = Math.round(tabletSettings.width / 1.791);
      syncTabletObject();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const formatted = JSON.stringify(tabletSettings);
      localStorage.setItem('customTabletSettings', formatted);
      alert('✅ 審判石碑位置與尺寸已成功儲存！重新整理或重啟遊戲均會自動讀取：\n\n' + formatted);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      tabletSettings = Object.assign({}, defaultTabletSettings);
      localStorage.removeItem('customTabletSettings');
      syncTabletObject();
      alert('🔄 已將審判石碑位置與尺寸還原為預設設定！');
    });
  }
}

function syncAltarsObject() {
  const altarsObj = sceneObjects.find(o => o.id === 'altars');
  if (altarsObj) {
    altarsObj.x = altarsSettings.x;
    altarsObj.y = altarsSettings.y;
    altarsObj.width = altarsSettings.width;
    altarsObj.height = altarsSettings.height;
  }
}

// 更新祭壇 Y 軸 UI 控制項
function updateAltarsYInputs() {
  const yInput = document.getElementById('altars-y-input');
  const ySlider = document.getElementById('altars-y-slider');
  if (yInput) yInput.value = altarsSettings.y;
  if (ySlider) ySlider.value = altarsSettings.y;
}

// --- 四個祭壇手動擺放與微調編輯器互動事件處理 ---
function setupAltarsEditorEvents() {
  const toggleBtn = document.getElementById('altars-editor-toggle-btn');
  const toolbar = document.getElementById('altars-editor-toolbar');
  const bringBtn = document.getElementById('altars-bring-btn');
  const leftBtn = document.getElementById('altars-left-btn');
  const rightBtn = document.getElementById('altars-right-btn');
  const up10Btn = document.getElementById('altars-up10-btn');
  const up1Btn = document.getElementById('altars-up1-btn');
  const down1Btn = document.getElementById('altars-down1-btn');
  const down10Btn = document.getElementById('altars-down10-btn');
  const yInput = document.getElementById('altars-y-input');
  const ySlider = document.getElementById('altars-y-slider');
  const expandBtn = document.getElementById('altars-expand-btn');
  const shrinkBtn = document.getElementById('altars-shrink-btn');
  const saveBtn = document.getElementById('altars-save-btn');
  const resetBtn = document.getElementById('altars-reset-btn');

  updateAltarsYInputs();

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isEditingAltars = !isEditingAltars;
      if (isEditingAltars) {
        if (toolbar) toolbar.classList.remove('hidden');
        toggleBtn.style.background = '#8c2a1b';

        // 關閉其他編輯器
        isEditingTorches = false;
        isEditingWall = false;
        isEditingFloor = false;
        isEditingDoor = false;
        isEditingMural = false;
        isEditingTablet = false;
      } else {
        if (toolbar) toolbar.classList.add('hidden');
        toggleBtn.style.background = '';
      }
    });
  }

  if (bringBtn) {
    bringBtn.addEventListener('click', () => {
      if (window.player) {
        altarsSettings.x = Math.round(player.x / 10) * 10;
        altarsSettings.y = 400;
        syncAltarsObject();
        updateAltarsYInputs();
        alert(`🎯 已成功將太陽神四大祭壇快速移動至亞倫面前 (X: ${altarsSettings.x}, Y: ${altarsSettings.y})！`);
      }
    });
  }

  if (leftBtn) leftBtn.addEventListener('click', () => { altarsSettings.x -= 10; syncAltarsObject(); });
  if (rightBtn) rightBtn.addEventListener('click', () => { altarsSettings.x += 10; syncAltarsObject(); });

  // 10px / 1px 精密 Y 軸微調
  if (up10Btn) up10Btn.addEventListener('click', () => { altarsSettings.y -= 10; syncAltarsObject(); updateAltarsYInputs(); });
  if (up1Btn) up1Btn.addEventListener('click', () => { altarsSettings.y -= 1; syncAltarsObject(); updateAltarsYInputs(); });
  if (down1Btn) down1Btn.addEventListener('click', () => { altarsSettings.y += 1; syncAltarsObject(); updateAltarsYInputs(); });
  if (down10Btn) down10Btn.addEventListener('click', () => { altarsSettings.y += 10; syncAltarsObject(); updateAltarsYInputs(); });

  // 數字輸入框即時響應
  if (yInput) {
    yInput.addEventListener('input', () => {
      const val = parseInt(yInput.value, 10);
      if (!isNaN(val)) {
        altarsSettings.y = val;
        syncAltarsObject();
        if (ySlider) ySlider.value = val;
      }
    });
  }

  // 滑桿即時拖曳響應
  if (ySlider) {
    ySlider.addEventListener('input', () => {
      const val = parseInt(ySlider.value, 10);
      if (!isNaN(val)) {
        altarsSettings.y = val;
        syncAltarsObject();
        if (yInput) yInput.value = val;
      }
    });
  }

  if (expandBtn) {
    expandBtn.addEventListener('click', () => {
      altarsSettings.width += 20;
      altarsSettings.height = Math.round(altarsSettings.width / 2.901);
      syncAltarsObject();
    });
  }

  if (shrinkBtn) {
    shrinkBtn.addEventListener('click', () => {
      altarsSettings.width = Math.max(100, altarsSettings.width - 20);
      altarsSettings.height = Math.round(altarsSettings.width / 2.901);
      syncAltarsObject();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const formatted = JSON.stringify(altarsSettings);
      localStorage.setItem('customAltarsSettings', formatted);
      alert('✅ 太陽神四大祭壇位置與尺寸已成功儲存！重新整理或重啟遊戲均會自動讀取：\n\n' + formatted);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      altarsSettings = Object.assign({}, defaultAltarsSettings);
      localStorage.removeItem('customAltarsSettings');
      syncAltarsObject();
      updateAltarsYInputs();
      alert('🔄 已將太陽神四大祭壇位置與尺寸還原為預設設定！');
    });
  }
}

function syncSlatesObject() {
  const slatesObj = sceneObjects.find(o => o.id === 'slates');
  if (slatesObj) {
    slatesObj.x = slatesSettings.x;
    slatesObj.y = slatesSettings.y;
    slatesObj.width = slatesSettings.width;
    slatesObj.height = slatesSettings.height;
  }
}

// 更新石板 Y 軸 UI 控制項
function updateSlatesYInputs() {
  const yInput = document.getElementById('slates-y-input');
  const ySlider = document.getElementById('slates-y-slider');
  if (yInput) yInput.value = slatesSettings.y;
  if (ySlider) ySlider.value = slatesSettings.y;
}

// --- 祭壇石板手動擺放與微調編輯器互動事件處理 ---
function setupSlatesEditorEvents() {
  const toggleBtn = document.getElementById('slates-editor-toggle-btn');
  const toolbar = document.getElementById('slates-editor-toolbar');
  const bringBtn = document.getElementById('slates-bring-btn');
  const leftBtn = document.getElementById('slates-left-btn');
  const rightBtn = document.getElementById('slates-right-btn');
  const up10Btn = document.getElementById('slates-up10-btn');
  const up1Btn = document.getElementById('slates-up1-btn');
  const down1Btn = document.getElementById('slates-down1-btn');
  const down10Btn = document.getElementById('slates-down10-btn');
  const yInput = document.getElementById('slates-y-input');
  const ySlider = document.getElementById('slates-y-slider');
  const expandBtn = document.getElementById('slates-expand-btn');
  const shrinkBtn = document.getElementById('slates-shrink-btn');
  const saveBtn = document.getElementById('slates-save-btn');
  const resetBtn = document.getElementById('slates-reset-btn');

  updateSlatesYInputs();

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isEditingSlates = !isEditingSlates;
      if (isEditingSlates) {
        if (toolbar) toolbar.classList.remove('hidden');
        toggleBtn.style.background = '#8c2a1b';

        // 關閉其他編輯器
        isEditingTorches = false;
        isEditingWall = false;
        isEditingFloor = false;
        isEditingDoor = false;
        isEditingMural = false;
        isEditingTablet = false;
        isEditingAltars = false;
      } else {
        if (toolbar) toolbar.classList.add('hidden');
        toggleBtn.style.background = '';
      }
    });
  }

  if (bringBtn) {
    bringBtn.addEventListener('click', () => {
      if (window.player) {
        slatesSettings.x = Math.round(player.x / 10) * 10;
        slatesSettings.y = 380;
        syncSlatesObject();
        updateSlatesYInputs();
        alert(`🎯 已成功將祭壇石板快速移動至亞倫面前 (X: ${slatesSettings.x}, Y: ${slatesSettings.y})！`);
      }
    });
  }

  if (leftBtn) leftBtn.addEventListener('click', () => { slatesSettings.x -= 10; syncSlatesObject(); });
  if (rightBtn) rightBtn.addEventListener('click', () => { slatesSettings.x += 10; syncSlatesObject(); });

  if (up10Btn) up10Btn.addEventListener('click', () => { slatesSettings.y -= 10; syncSlatesObject(); updateSlatesYInputs(); });
  if (up1Btn) up1Btn.addEventListener('click', () => { slatesSettings.y -= 1; syncSlatesObject(); updateSlatesYInputs(); });
  if (down1Btn) down1Btn.addEventListener('click', () => { slatesSettings.y += 1; syncSlatesObject(); updateSlatesYInputs(); });
  if (down10Btn) down10Btn.addEventListener('click', () => { slatesSettings.y += 10; syncSlatesObject(); updateSlatesYInputs(); });

  if (yInput) {
    yInput.addEventListener('input', () => {
      const val = parseInt(yInput.value, 10);
      if (!isNaN(val)) {
        slatesSettings.y = val;
        syncSlatesObject();
        if (ySlider) ySlider.value = val;
      }
    });
  }

  if (ySlider) {
    ySlider.addEventListener('input', () => {
      const val = parseInt(ySlider.value, 10);
      if (!isNaN(val)) {
        slatesSettings.y = val;
        syncSlatesObject();
        if (yInput) yInput.value = val;
      }
    });
  }

  if (expandBtn) {
    expandBtn.addEventListener('click', () => {
      slatesSettings.width += 20;
      slatesSettings.height = Math.round(slatesSettings.width / 3);
      syncSlatesObject();
    });
  }

  if (shrinkBtn) {
    shrinkBtn.addEventListener('click', () => {
      slatesSettings.width = Math.max(60, slatesSettings.width - 20);
      slatesSettings.height = Math.round(slatesSettings.width / 3);
      syncSlatesObject();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const formatted = JSON.stringify(slatesSettings);
      localStorage.setItem('customSlatesSettings', formatted);
      alert('✅ 祭壇石板位置與尺寸已成功儲存！重新整理或重啟遊戲均會自動讀取：\n\n' + formatted);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      slatesSettings = Object.assign({}, defaultSlatesSettings);
      localStorage.removeItem('customSlatesSettings');
      syncSlatesObject();
      updateSlatesYInputs();
      alert('🔄 已將祭壇石板位置與尺寸還原為預設設定！');
    });
  }
}

// --- 全域統一 Canvas 畫布編輯滑鼠互動處理器 ---
function setupUnifiedCanvasEditorEvents() {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;

  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) * (Game.width / rect.width);
    const clickY = (e.clientY - rect.top) * (Game.height / rect.height);
    const worldX = clickX + Game.cameraX;

    if (isEditingSlates) {
      isDraggingSlates = true;
      slatesSettings.x = Math.round(worldX / 10) * 10;
      slatesSettings.y = Math.round(clickY);
      syncSlatesObject();
      updateSlatesYInputs();
      return;
    }

    if (isEditingAltars) {
      isDraggingAltars = true;
      altarsSettings.x = Math.round(worldX / 10) * 10;
      altarsSettings.y = Math.round(clickY); // 1px 精密拖曳
      syncAltarsObject();
      updateAltarsYInputs();
      return;
    }

    if (isEditingTablet) {
      isDraggingTablet = true;
      tabletSettings.x = Math.round(worldX / 10) * 10;
      tabletSettings.y = Math.round(clickY / 10) * 10;
      syncTabletObject();
      return;
    }

    if (isEditingDoor) {
      isDraggingDoor = true;
      doorSettings.x = Math.round(worldX / 10) * 10;
      doorSettings.y = Math.round(clickY / 10) * 10;
      syncDoorObject();
      updateDoorPosText();
      return;
    }

    if (isEditingStatue) {
      isDraggingStatue = true;
      statueSettings.x = Math.round(worldX / 10) * 10;
      statueSettings.y = Math.round(clickY / 10) * 10;
      syncStatueObject();
      updateStatuePosText();
      return;
    }

    if (isEditingMural) {
      isDraggingMural = true;
      muralSettings.x = Math.round(worldX / 10) * 10;
      muralSettings.y = Math.round(clickY / 10) * 10;
      syncMuralObject();
      return;
    }

    if (isEditingTorches) {
      let found = -1;
      torchPositions.forEach((t, idx) => {
        const tx = typeof t === 'number' ? t : t.x;
        const ty = typeof t === 'number' ? 145 : t.y;
        if (Math.abs(worldX - tx) < 50 && Math.abs(clickY - ty) < 70) {
          found = idx;
        }
      });

      if (found !== -1) {
        selectedTorchIndex = found;
        isDraggingTorch = true;
      } else {
        if (selectedTorchIndex >= 0 && selectedTorchIndex < torchPositions.length) {
          torchPositions[selectedTorchIndex].x = Math.round(worldX / 10) * 10;
          torchPositions[selectedTorchIndex].y = lockY ? 145 : Math.round(clickY / 10) * 10;
          isDraggingTorch = true;
        }
      }
      return;
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const moveX = (e.clientX - rect.left) * (Game.width / rect.width);
    const moveY = (e.clientY - rect.top) * (Game.height / rect.height);
    const worldX = moveX + Game.cameraX;

    if (isEditingSlates && isDraggingSlates) {
      slatesSettings.x = Math.round(worldX / 10) * 10;
      slatesSettings.y = Math.round(moveY); // 1px 精密拖曳
      syncSlatesObject();
      updateSlatesYInputs();
    }

    if (isEditingAltars && isDraggingAltars) {
      altarsSettings.x = Math.round(worldX / 10) * 10;
      altarsSettings.y = Math.round(moveY); // 1px 精密拖曳
      syncAltarsObject();
      updateAltarsYInputs();
    }

    if (isEditingTablet && isDraggingTablet) {
      tabletSettings.x = Math.round(worldX / 10) * 10;
      tabletSettings.y = Math.round(moveY / 10) * 10;
      syncTabletObject();
    }

    if (isEditingDoor && isDraggingDoor) {
      doorSettings.x = Math.round(worldX / 10) * 10;
      doorSettings.y = Math.round(moveY / 10) * 10;
      syncDoorObject();
      updateDoorPosText();
    }

    if (isEditingStatue && isDraggingStatue) {
      statueSettings.x = Math.round(worldX / 10) * 10;
      statueSettings.y = Math.round(moveY / 10) * 10;
      syncStatueObject();
      updateStatuePosText();
    }

    if (isEditingMural && isDraggingMural) {
      muralSettings.x = Math.round(worldX / 10) * 10;
      muralSettings.y = Math.round(moveY / 10) * 10;
      syncMuralObject();
    }

    if (isEditingTorches && isDraggingTorch && selectedTorchIndex >= 0) {
      const snappedX = Math.round(worldX / 10) * 10;
      const targetY = lockY ? 145 : Math.round(moveY / 10) * 10;
      torchPositions[selectedTorchIndex] = { x: snappedX, y: targetY };
    }
  });

  window.addEventListener('mouseup', () => {
    isDraggingSlates = false;
    isDraggingAltars = false;
    isDraggingTablet = false;
    isDraggingDoor = false;
    isDraggingStatue = false;
    isDraggingMural = false;
    isDraggingTorch = false;
  });
}

function setupTorchHotspotEditorEvents() {
  const toggleBtn = document.getElementById('edit-torch-hotspot-btn');
  const toolbar = document.getElementById('torch-hotspot-toolbar');
  const bringBtn = document.getElementById('torch-bring-btn');
  const leftBtn = document.getElementById('torch-left-btn');
  const rightBtn = document.getElementById('torch-right-btn');
  const posText = document.getElementById('torch-pos-text');
  const saveBtn = document.getElementById('torch-save-btn');

  function updateText() {
    if (posText) posText.textContent = `X: ${torchHotspotSettings.x}`;
  }
  updateText();

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isEditingTorchHotspot = !isEditingTorchHotspot;
      if (isEditingTorchHotspot) {
        if (toolbar) toolbar.classList.remove('hidden');
        toggleBtn.style.background = '#8c2a1b';
      } else {
        if (toolbar) toolbar.classList.add('hidden');
        toggleBtn.style.background = 'rgba(255,140,0,0.4)';
      }
    });
  }

  if (bringBtn) {
    bringBtn.addEventListener('click', () => {
      if (window.player) {
        torchHotspotSettings.x = Math.round(player.x / 10) * 10;
        updateText();
      }
    });
  }

  if (leftBtn) {
    leftBtn.addEventListener('click', () => {
      torchHotspotSettings.x -= 20;
      updateText();
    });
  }

  if (rightBtn) {
    rightBtn.addEventListener('click', () => {
      torchHotspotSettings.x += 20;
      updateText();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      localStorage.setItem('customTorchHotspot', JSON.stringify(torchHotspotSettings));
      alert(`✅ 長明火把調查熱點位置已成功儲存 (X: ${torchHotspotSettings.x})！重新整理都會自動讀取！`);
    });
  }
}

// 在 DOM 載入完畢後綁定壁畫、火把、牆面、石門、拉神石像、石碑、四個祭壇、祭壇石板與地板編輯器
window.addEventListener('DOMContentLoaded', () => {
  setupMuralEditorEvents();
  setupTorchEditorEvents();
  setupFloorEditorEvents();
  setupWallEditorEvents();
  setupDoorEditorEvents();
  setupStatueEditorEvents();
  setupTabletEditorEvents();
  setupAltarsEditorEvents();
  setupSlatesEditorEvents();
  setupTorchHotspotEditorEvents();
  setupUnifiedCanvasEditorEvents();
});
