# PROJECT AUDIT — 《太陽之心：法老王的封印》

> Phase 0：Frontend Project Deep Audit  
> 稽核日期：2026-09-03（Asia/Taipei）  
> 專案根目錄：`C:\Users\user\Desktop\sun-main`  
> 稽核邊界：唯讀分析既有 Repository；本文件是本階段唯一新增檔案。未建立 Supabase、資料表、SQL、Auth、API、套件或部署設定。

## 稽核結論摘要

- 這是一個原生 HTML/CSS/JavaScript 的單頁 2D Canvas 劇情解謎遊戲，不是 React、Vue、Next.js 或 TypeScript 應用。
- 使用者流程已包含：探勘者入口、訪客模式、主選單、序章、三個可遊玩場景、背包、三道謎題、倒數、檢查點、死亡回檔與三種主要結局。
- 核心遊戲前端並非只有靜態 UI；遊戲狀態機、互動與分支確實存在並有 16 個 Node 回歸測試覆蓋。
- 真正的正式帳號功能仍是空殼：登入、建立帳號、忘記密碼只有 `window.*` 掛接點；沒有 Auth SDK、session restore、logout、protected route 或使用者隔離。
- 真正的玩家持久化只有單一 `localStorage` checkpoint；它未按使用者分區，同一瀏覽器上的不同登入者會看到同一份本機存檔。
- Repository 目前不是 Git working tree；無法查看分支、未提交變更、歷史或 remote，因此 Phase 1 前必須先釐清團隊的真正 Git 根目錄。
- 現有 build/dev/test 工具鏈不一致：`package.json` 為 ESM，但 `start.js` 與測試使用 CommonJS；`build` 又先執行 TypeScript，但 Repository 沒有 `tsconfig.json` 或 TypeScript 原始碼。
- 後端最小必要範圍是「Supabase Auth + 每位使用者一份雲端 checkpoint」。遊戲規則、道具定義、場景內容、對話與版面設定不應搬進資料庫。

## 1. Project Summary

《太陽之心：法老王的封印》是一款約 15 分鐘、單人、古埃及題材的 2D 橫向卷軸網頁解謎遊戲。玩家扮演考古學家亞倫・卡特，依序完成：

1. 太陽神殿的石板排序試煉。
2. 天秤審判室的心臟／羽毛配置試煉，並可選擇性取得祭司護符。
3. 法老王墓室的三面銅鏡光路試煉。
4. 決定帶走或留下太陽之心，依護符與選擇進入不同結局。

### 使用者類型

| 使用者 | 現況 | 能力 |
|---|---|---|
| 訪客玩家 | 已實作 | 不需帳號即可進入；使用同一瀏覽器的本機 checkpoint 與設定 |
| 登入玩家 | 僅 UI／掛接契約 | 表單與成功後的 `Game.authUser` 有實作，但沒有任何真正認證來源 |
| 開發／測試人員 | 已實作部分工具 | `?test=1` 顯示計時與場景快速跳轉控制；另有隱藏的場景校正程式碼 |
| Admin | 不存在 | 無後台、角色或管理流程 |

### 核心功能完成度

| 功能 | 判定 | 證據 |
|---|---|---|
| 單頁入口與主選單 | 已實作 | `index.html`、`js/login-gate.js`、`js/main-menu.js` |
| 訪客進入 | 已實作 | `enterMainMenu({ isGuest: true })` |
| 正式登入 | 只有掛接點 | 依賴不存在的 `window.authenticateExplorer()` |
| 註冊／忘記密碼 | 只有掛接點 | `window.openExplorerRegistration()`、`window.openExplorerPasswordReset()` 不存在時只顯示提示 |
| 三場景遊戲流程 | 已實作 | `scene.js`、`judgement.js`、`tomb.js` |
| 背包、三道謎題、倒數、結局 | 已實作 | `puzzle.js`、`judgement.js`、`tomb.js` |
| 本機 checkpoint | 已實作 | `localStorage['sunHeartCheckpointV1']` |
| 雲端存檔／跨裝置繼續 | 未實作 | 無 client、service、API、資料庫或環境變數 |
| 使用者資料隔離 | 未實作 | checkpoint key 為全瀏覽器共用，不含 user id |
| Production build／deployment | 尚不可驗證 | 本機無 dependencies；build script 與專案形態不一致 |

## 2. Tech Stack

| 類別 | 實際技術 | 補充 |
|---|---|---|
| Frontend framework | 無 | 原生 DOM 與 classic `<script>`；無 React/Vue/Next |
| Language | JavaScript + HTML + CSS | 無 `.ts`/`.tsx`、interface、type、enum；`typescript` 只出現在 devDependency |
| Rendering | HTML5 Canvas 2D + DOM overlays | Canvas 負責場景、角色與粒子；DOM 負責入口、選單、HUD、對話、背包與 modal |
| Styling | 單一原生 CSS | `css/style.css`，無 Tailwind/SCSS/Bootstrap/component library |
| State | 全域 mutable `window.Game` + module-local variables | 無 Redux/Zustand/Context |
| Routing | 無 router | 唯一文件路徑 `/`；畫面由 `Game.state` 與 overlay class 切換 |
| Persistence | `localStorage` | checkpoint、音量／文字速度、場景校正設定 |
| Networking | 無 | 無 `fetch`、Axios、XHR、WebSocket、Supabase client |
| Audio | Web Audio API | 程式合成 click/correct/incorrect/item/rumble 音效 |
| Animation | `requestAnimationFrame`、CSS animation/transition、GIF/PNG sprites | 無動畫 library |
| Icons/visuals | emoji、Unicode 象形文字、大量 PNG/JPG/GIF | 無 icon library、chart library |
| Build | Vite 5（manifest/lockfile） | `vite.config.*` 不存在；目前 build 未成功執行 |
| Package manager | pnpm lockfile | `pnpm-lock.yaml` lockfile v9；未宣告 `packageManager` |
| Local server | Node `http` script | `start.js` 是 CommonJS，但被 package ESM 設定破壞 |
| Tests | Node `assert` + `vm` | 16 個 `.test.js`，也是 CommonJS |
| External runtime dependency | Google Fonts CSS | `Cinzel`、`Playfair Display`、`Special Elite`；離線時會 fallback |
| Declared package | `jimp@1.6.1` | 原始碼沒有 import/require Jimp，現況屬未使用 dependency |

Lockfile 實際解析版本包含 Vite `5.4.21`、TypeScript `5.9.3`、Jimp `1.6.1`；這只表示 lockfile 狀態，不表示 `node_modules` 已安裝。

## 3. Folder Structure

```text
sun-main/
├── .gitignore
├── index.html                 # 唯一 HTML 入口與所有 DOM overlay
├── package.json
├── pnpm-lock.yaml
├── README.md
├── start.js                   # 本地靜態伺服器（目前因 ESM/CJS 衝突不能啟動）
├── css/
│   └── style.css              # 2,594 行；全站與遊戲 UI 樣式
├── js/
│   ├── preload.js
│   ├── scene.js
│   ├── player.js
│   ├── interaction.js
│   ├── judgement.js
│   ├── tomb.js
│   ├── checkpoint.js
│   ├── objective.js
│   ├── main-menu.js
│   ├── prologue.js
│   ├── login-gate.js
│   └── puzzle.js
├── tests/                     # 16 個 Node regression tests
├── docs/
│   ├── 企劃-法老王的封印-單人版.md
│   ├── PRD 產品需求文件.md
│   └── MVP 規格書.md
└── assets/                    # 128 檔，約 174 MB
    ├── backgrounds/
    ├── characters/
    ├── items/
    ├── raw_references/
    └── 道具/
```

Repository 不存在 `src/`、`public/`、`routes/`、`services/`、`api/`、`hooks/`、`store/`、`types/`、`vite.config.*`、`tsconfig.json`、`.env.example`、Supabase 或 migrations 目錄。

資產目錄同時包含 runtime 圖檔與製作來源檔（AEP、PSD、MOV、ZIP、raw references）。後續部署不能假設整個 `assets/` 都應公開或上傳。

## 4. Important Files

| 檔案 | 規模 | 實際責任 |
|---|---:|---|
| `index.html` | 28 KB / 533 行 | 唯一頁面；宣告所有 overlays、控制項、Canvas 與 12 支 script 的載入順序 |
| `css/style.css` | 57 KB / 2,594 行 | 古埃及金色／羊皮紙／石材視覺、overlay z-index、動畫與有限 responsive rules |
| `js/scene.js` | 96 KB / 2,645 行 | `window.Game`、第一場景、渲染、落石／光照、場景校正工具 |
| `js/puzzle.js` | 33 KB / 952 行 | 背包、第一謎題、timer/update/render/game loop、整體初始化 |
| `js/interaction.js` | 19 KB / 572 行 | 互動目標、對話系統、Web Audio、開場 cutscene、`startGame()` |
| `js/judgement.js` | 38 KB / 1,051 行 | 第二場景、四個審判道具、可選護符、天秤謎題與第二場景繪製 |
| `js/tomb.js` | 59 KB / 1,420 行 | 第三場景、護符分支、鏡面光路、最終選擇、結局與場景繪製 |
| `js/checkpoint.js` | 6.8 KB / 198 行 | checkpoint serialize/read/write/restore/delete、死亡畫面 |
| `js/login-gate.js` | 4.7 KB / 133 行 | 訪客／登入入口與三個未實作的後端 hook 契約 |
| `js/main-menu.js` | 6.4 KB / 184 行 | 新遊戲／繼續／說明／設定／返回主頁 |
| `js/preload.js` | 6.1 KB / 164 行 | 三組關鍵圖片預載與 progress overlay |
| `js/player.js` | 9.5 KB / 273 行 | 移動、鍵盤、相機、角色 GIF/idle sprite |
| `js/objective.js` | 3.0 KB / 75 行 | 依場景與 `Game.progress` 計算目前目標 |
| `js/prologue.js` | 3.2 KB / 105 行 | 序章 reveal/skip/enter 與背景預載協調 |
| `start.js` | 2.4 KB | Node 靜態伺服器；非 production server |
| `docs/*` | 3 份 | 企劃與期望規格；與程式碼有差異時以程式碼為現況證據 |

### Script 載入依賴順序

```text
preload → scene(Game) → player → interaction(audio/dialogue)
→ judgement → tomb → checkpoint → objective
→ main-menu → prologue → login-gate → puzzle(init + game loop)
```

這些不是 ES modules；它們透過 `window.*` 與隱含全域名稱互相依賴，因此重排 script 可能直接破壞應用。

## 5. Application Architecture

```text
index.html + style.css
        │
        ├── DOM UI layers
        │   ├── Explorer Gate
        │   ├── Main Menu / Prologue
        │   ├── HUD / Dialogue / Inventory
        │   ├── Puzzle / Scale / Final Choice
        │   └── Ending / Death
        │
        └── Classic scripts sharing window globals
            ├── window.Game (single mutable state object)
            ├── scene/player/interaction render-update systems
            ├── per-scene object arrays and event handlers
            ├── checkpoint serializer → localStorage
            └── puzzle.js initApp() → one requestAnimationFrame loop
```

`puzzle.js:initApp()` 是 composition root：取得 Canvas context、綁定鍵盤／按鈕、初始化謎題、主選單、序章、登入門禁，最後啟動唯一 game loop。畫面切換不是 route navigation，而是更新 `Game.state`、`Game.currentScene`、`Game.sceneObjects` 與 DOM 的 `.hidden` class。

架構優點是無 framework、部署簡單、核心 loop 集中；主要接手風險是全域耦合、沒有型別與 service boundary，後端串接若直接散落在元件事件中會很難測試。

## 6. Pages & Routes

### 實際 Route

| Route | Page | 用途 | State / Data | 操作 | Backend |
|---|---|---|---|---|---|
| `/` | 唯一 SPA 文件 | 承載所有入口、選單與遊戲畫面 | `window.Game`、DOM overlays、localStorage | 完整遊戲流程 | 需要 Auth 與 cloud save |

沒有 router library、route table、history navigation 或 protected route。`?test=1` 是測試模式 query flag，不是 page route；它會顯示快速計時、直接進場與直接逾時工具。

### 同一路徑內的「虛擬頁面／狀態」

| 畫面 | 主要檔案 | Game state | 資料來源 | 可進行操作 | Backend need |
|---|---|---|---|---|---|
| Explorer Gate | `index.html` + `login-gate.js` | `AUTH_GATE` | input + 不存在的 auth hooks | 登入、訪客、註冊 hook、重設密碼 hook | 高 |
| Main Menu | `main-menu.js` | `MENU` | 本機 checkpoint summary、settings | 新遊戲、繼續、說明、設定 | 會員的「繼續」要改讀 cloud save |
| Prologue | `prologue.js` | `PROLOGUE` | 靜態 HTML 文案 | 跳過、進入古墓 | 無 |
| Opening Cutscene | `interaction.js` | `CUTSCENE`/`DIALOGUE` | hardcoded dialogue + timers | ESC 跳過、推進對話 | 無 |
| 太陽神殿 | `scene.js` + `puzzle.js` | `PLAYING`/`PUZZLE`/`BAG` | `Game.progress`、inventory、static configs | 探索、取物、排序、開門 | 僅 checkpoint |
| 天秤審判室 | `judgement.js` | `PLAYING`/`SCALE`/`ITEM_REVEAL` | `Game.progress`、trial items | 找護符、收集物品、審判 | 僅 checkpoint |
| 法老王墓室 | `tomb.js` | `PLAYING`/`FINAL_CHOICE` | `Game.progress`、mirror state | 旋鏡、選擇、逃離 | 僅 checkpoint |
| Ending / Death | `tomb.js` + `checkpoint.js` | `ENDING`/`GAME_OVER` | ending flags + checkpoint | 回主頁、回檔、重新開始 | 會員回檔要讀 cloud save |

## 7. Component Map

本專案沒有 framework component；以下的「Component」指具有獨立 DOM、state 與事件責任的 UI/feature module。

| Component / Module | 檔案 | 被誰使用 | Inputs / Props equivalent | 管理的 State / Functions | CRUD / Form / Backend |
|---|---|---|---|---|---|
| ExplorerGate | `login-gate.js` | `puzzle.js:initApp` | DOM inputs；`window.authenticateExplorer` 等 hooks | `Game.isGuest`、`Game.authUser`、gate transition | Login form；Auth 高需求 |
| MainMenu | `main-menu.js` | `puzzle.js:initApp`、ending return | callbacks `startNewGame`/`continueGame` | menu panels、settings、continue availability | Read checkpoint；settings C/R/U |
| Prologue | `prologue.js` | MainMenu new game | `prepareGame`/`enterGame` callbacks | reveal timers、enter lock | 無 backend |
| AssetPreloader | `preload.js` | init / scene transitions | groupName、message、showOverlay | promises、group progress | 無 backend |
| Game Runtime | `scene.js` + `puzzle.js` | 全部 gameplay modules | Canvas/context/timestamp | `window.Game`、update/render loop | checkpoint integration point |
| Player Controller | `player.js` | game loop | keyboard state、timestamp、scene | player position/velocity/direction | checkpoint payload only |
| Interaction / Dialogue | `interaction.js` | player + every scene object | speaker/lines/callback | current target、dialogue queue、cutscene | 無 backend |
| Objective HUD | `objective.js` | game loop | current scene/progress | derived objective text | 無 backend |
| Inventory | `puzzle.js` | B key / puzzle systems | `Game.inventory`、`itemDatabase` | selected UI slot | runtime only; included in save |
| Slate Puzzle | `puzzle.js` | scene 1 altar | `slatesOrder`、inventory | drag/drop、slot state、success | runtime only; checkpoint at scene boundary |
| Judgement Scene | `judgement.js` | scene 1 door | Game + static trialItems | collection, scale, amulet, mistakes | runtime only; checkpoint entry |
| Tomb Scene | `tomb.js` | judgement exit | Game + static mirror/ending config | mirror, final choice, ending | runtime only; checkpoint entry |
| Checkpoint System | `checkpoint.js` | scene transitions/menu/death | snapshot of Game/player | create/read/restore/delete | 目前 localStorage；最重要 backend integration point |
| Death/Ending UI | `checkpoint.js` + `tomb.js` | timer/scale/final branches | reason/title/story/allowCheckpoint | overlay and timers | 讀 checkpoint |
| Settings Panel | `main-menu.js` | MainMenu | range/select | volume/textSpeed | local-only C/R/U，無 backend 必要 |
| Scene Editors | `scene.js` + `tomb.js` | 隱藏 DOM controls | slider/pointer events | visual layout localStorage | 開發工具；不應進 production backend |

## 8. User Flow

```text
開啟 /
  ↓
Explorer Gate
  ├── 訪客 → Main Menu
  └── 正式登入 → 目前因無 authenticateExplorer 而停留
                    ↓（未來 Auth 成功）
                  Main Menu
  ├── 說明
  ├── 設定（localStorage）
  ├── 繼續（讀取單一 localStorage checkpoint）
  └── 新遊戲 → 序章 → 開場 cutscene → 建立「太陽神殿入口」checkpoint
                                           ↓
太陽神殿：壁畫／火把／石碑 → 三塊石板 + 固定河川石板
  → 正確排序 → 拉神像取得徽章 → 石門 → 審判室入口 checkpoint
                                           ↓
審判室：可先讀壁畫並開暗格取得護符
  → 收集四物 → 心臟左盤／羽毛右盤 → 法老石門 → 墓室入口 checkpoint
                                           ↓
墓室：王座（有／無護符分支）→ 三面鏡升起
  → [向左, 直行, 向右] → 右側祭壇 → 最終選擇
  ├── 留下 → TRUE END → 主選單
  ├── 帶走 + 護符 → 逃回左門 → NORMAL END → 主選單
  └── 帶走 + 無護符 → BAD END → 可回 checkpoint → 主選單

任何場景 timer 歸零，或天秤錯誤累積 2 次
  → GAME OVER → 回最近 checkpoint 或重新開始
```

## 9. State Management

### 全域 runtime state

`window.Game` 是唯一主要 store，包含：

- UI/state machine：`state`、`inCutscene`、`currentInteractiveTarget`。
- Scene/camera：`currentScene`、`sceneObjects`、`worldWidth`、`cameraX`、`cameraTargetX`。
- Auth placeholder：`isGuest`、`authUser`。
- Timer：`remainingSeconds`、`isRunning`、`lastTick`、`pausedForDevelopment`。
- Game progress：第一／二／三場景 flags、mistakes、ending id。
- Puzzle state：`inventory`、`selectedItem`、`scaleState`、`mirrorState`。
- Dialogue、particles、screen shake、rocks/dust。

其他 mutable state 分散在各檔案 scope：`slatesOrder`、選中的天秤物品、scene transition timers、prologue/ending timers、layout editor state。沒有 reducer、event bus、schema validator 或 immutable boundary。

### UI state enum（由程式碼實際使用）

`AUTH_GATE`、`MENU`、`PROLOGUE`、`PLAYING`、`DIALOGUE`、`CUTSCENE`、`PUZZLE`、`BAG`、`SCALE`、`ITEM_REVEAL`、`FINAL_CHOICE`、`ENDING`、`GAME_OVER`。

## 10. Data Flow

### 現況總圖

```text
DOM / Canvas event
  ↓
file-level handler or window.* function
  ↓
window.Game / player / module-local state
  ├── render loop → Canvas + DOM
  └── createGameCheckpoint() → JSON.stringify → localStorage
```

### 重要 Mapping

| UI | Component / Function | State | 現有資料來源 |
|---|---|---|---|
| 登入表單 | `login-gate.js` submit handler | account/password → `Game.authUser` | 使用者 input；Auth hook 不存在 |
| 訪客按鈕 | `enterMainMenu()` | `Game.isGuest=true` | 本機事件 |
| 繼續遊戲 | `main-menu.js:continueGame` | checkpoint hydrate | `localStorage['sunHeartCheckpointV1']` |
| 場景入口 | `createGameCheckpoint(label)` | Game/progress/inventory/player/timer | runtime snapshot → localStorage |
| 主選單設定 | `readSettings/saveSettings` | volume/textSpeed | `localStorage['sunHeartSettingsV1']` |
| 第一場景列表 | `sceneObjects` | progress + inventory | hardcoded objects/dialogue |
| 背包 | `renderInventory()` | inventory ids | hardcoded `itemDatabase` + Game.inventory |
| 石板 puzzle | `placeSlate/submitPuzzle` | `slatesOrder` | hardcoded answer + user drag/click |
| 第二場景 | `collectTrialItem/openScalePuzzle` | collected items/amulet/scale | hardcoded `trialItems` + user events |
| 第三場景 | `rotateTombMirror/chooseSunHeart` | mirror/ending flags | hardcoded solution/endings + user events |
| Objective HUD | `getCurrentObjectiveText` | derived only | hardcoded objective resolver + progress |
| 圖片 loading | `preloadAssetGroup` | promise cache/progress | hardcoded asset URL groups |

Repository 全域搜尋確認：沒有 `sessionStorage`、IndexedDB、`fetch()`、Axios、XHR、WebSocket、Supabase SDK、REST/GraphQL client 或外部 JSON data file。

## 11. Data Models / TypeScript Types

這不是 TypeScript 專案，因此不存在 frontend `interface`、`type`、`enum` 或 model class。不能聲稱目前有編譯期 data model。可由實際 JavaScript 物件整理出以下 runtime shapes，後續應以它們為相容基礎，而不是重新發明完全不同的格式。

### Auth hook contract

```js
authenticateExplorer({ account, password })
  -> { ok: true, user }
  -> { ok: false, message }
```

`user` 目前只在測試中以 `{ id: 'explorer-1' }` 驗證，production code 沒有讀取固定欄位。

### Checkpoint V1

```js
{
  version: 1,
  label,
  sceneId,
  createdAt,
  progress: { ...Game.progress },
  inventory: string[],
  selectedItem: string | null,
  scaleState: { left: string | null, right: string | null },
  mirrorState: number[3],
  timer: { remainingSeconds: number, isRunning: boolean },
  player: { x, y, direction } | null
}
```

### Progress model

主要欄位：

- Scene 1：`investigatedMural`、`investigatedTablet`、`torchTaken`、`puzzleCleared`、`sunBadgeRevealed`、`sunBadgeTaken`、`sunBadgePlaced`、`doorOpened`。
- Scene 2：`scene2Entered`、`judgementMuralRead`、`scaleCompartmentOpened`、`scaleCompartmentSealed`、`scalePuzzleIntroduced`、`priestAmuletFound`、`scaleCleared`、`scaleMistakes`、`collectedTrialItems`。
- Scene 3：`scene3Entered`、`tombMechanismActivated`、`priestAmuletActivated`、`priestWarningRead`、`mirrorsRevealed`、`mirrorRiseStartedAt`、`mirrorMistakes`、`mirrorPuzzleSolved`、`sealedHeartAltarViewed`、`sunHeartAltarRevealed`、`tombEscapeActive`、`sunHeartTaken`、`endingId`。

### 其他 runtime shapes

| Shape | Fields | 使用位置 | 要存 DB？ |
|---|---|---|---|
| Settings | `volume`, `textSpeed` | main menu/audio/dialogue | 目前不需要，local-only 足夠 |
| Scene object | `id,x,y,width,height,label,onInteract,isAvailable?,interactionX?,interactionRadius?,promptVerb?` | interaction/render | 否，遊戲內容設定 |
| Item definition | `name/image/description` 或 `label/shortName/x/color/pickup` | inventory/judgement | 否，靜態遊戲內容 |
| Player snapshot | `x,y,direction` | checkpoint restore | 是，放在 save payload 即可 |
| Scale state | `left,right` | second puzzle | 是，放在 save payload |
| Mirror state | fixed length 3 number array | third puzzle | 是，放在 save payload |

後續若引入 TypeScript，第一步應先為 checkpoint/auth result 建立 validator + JSDoc/TS types；不應一次重寫全部 Canvas 程式。

## 12. Mock / Hardcoded Data

沒有典型的 mock API response、dummy users、fake database rows 或 seed JSON。存在大量「遊戲設計常數」，它們不是等待換成後端的假資料。

| Hardcoded data | 檔案 | 代表 Domain | 未來 DB |
|---|---|---|---|
| `window.Game` defaults | `scene.js` | 單次遊戲狀態 | 僅 checkpoint payload |
| `sceneObjects` | `scene.js` | 第一場景互動物 | 不需要；保留 client code |
| `trialItems` / `judgementSceneObjects` | `judgement.js` | 第二場景物件與文案 | 不需要 |
| `pharaohTombSceneObjects` | `tomb.js` | 第三場景互動物 | 不需要 |
| `itemDatabase` | `puzzle.js` | 背包顯示 metadata | 不需要 |
| `slatesOrder` + correct order | `puzzle.js` | 第一謎題 | 不需要 |
| `TOMB_MIRROR_SOLUTION` | `tomb.js` | 第三謎題答案 | 不需要 |
| `OBJECTIVES` | `objective.js` | 任務提示 | 不需要 |
| `assetGroups` | `preload.js` | runtime asset manifest | 不需要 |
| dialogue/ending story arrays | scene modules | 劇情內容 | 不需要 |
| layout/torch/altar defaults | scene modules | 視覺校正 | 不需要；應建置時固定 |
| test fast-forward state | `puzzle.js`、`interaction.js` | 開發測試資料 | 絕不可當可信 server data |

若後端只為了「架構漂亮」而把上述內容正規化成 items/scenes/dialogues tables，會增加延遲、migration 與內容同步成本，且沒有現有 UI 需求支持。

## 13. Forms

### Explorer Login Form

| 項目 | 現況 |
|---|---|
| Fields | `account`：text/username autocomplete/inputmode email；`password`：password/current-password |
| Required | HTML 兩欄都有 `required`，但 form 有 `novalidate`；實際只做非空白檢查 |
| Optional | 無 |
| Validation | account trim 後不可空；password 不可空；未驗證 email 格式、長度或帳號規則 |
| Submit | `login-gate.js` async submit handler |
| Current result | 若 hook 不存在，顯示「登入服務尚未連線」；不偽造登入成功 |
| Error handling | hook 回傳 `{ok:false,message}` 或 catch network error；顯示 status，重新啟用 button |
| Success handling | `Game.isGuest=false`、`Game.authUser=result.user`、進入主選單 |
| Future destination | `authService.signIn` → Supabase Auth；之後載入該 user cloud save |

### Registration / Password Reset

- 沒有 form、modal 或 page。
- 「建立帳號」只呼叫可選 `window.openExplorerRegistration()`。
- 「忘記密碼」只呼叫可選 `window.openExplorerPasswordReset(account)`。
- 因此 Phase 5 Auth 不能只寫 service；仍需要以原 UI 風格新增最小 UI 或明確採外部 auth page。

### Settings controls（不是 `<form>`）

- 音量 range：0–100，step 5，轉成 0–1 後立即寫 localStorage。
- 文字速度 select：28/42/70 chars per second，change 後立即寫 localStorage。
- 沒有 submit、server error 或 success UI；目前沒有後端必要。

隱藏 tomb editor 有多個 range/button，但屬開發校正工具，不是產品資料表單。

## 14. CRUD

| Domain | Create | Read | Update | Delete | 現況 | Backend Needed |
|---|---|---|---|---|---|---|
| Auth account | 建立帳號按鈕只有 hook | 登入 hook | password reset hook | 無 | UI placeholder | 是，Supabase Auth lifecycle |
| Current checkpoint | 場景入口建立 | 主選單 summary/continue、death restore | 每次場景入口覆寫 | new game/restart 清除 | localStorage 完成 | 登入會員需要 cloud CRUD |
| Settings | 第一次調整建立 | app 啟動讀取 | input/change 覆寫 | 無 UI；fallback defaults | localStorage 完成 | 否 |
| Runtime progress | 新遊戲初始化 | render/objective | 每次互動變更 | restart reset | in-memory 完成 | 僅作 save payload，不建逐欄 CRUD API |
| Inventory | 探索取得 | 背包 render | 放置／取回 | 消耗／reset | in-memory 完成 | 僅作 save payload |
| Static game content | 原始碼常數 | render | 需改 code | 需改 code | 非使用者 CRUD | 否 |
| Ending history/leaderboard | 無 | 無 | 無 | 無 | 不存在且 MVP 明列 out-of-scope | 不建立 |

## 15. Authentication Status

### 現況判定：不是正式 Auth

- Login UI：有。
- Register UI：只有按鈕，沒有表單。
- Password reset UI：只有按鈕，沒有流程。
- Logout：完全不存在。
- Session：不存在；reload 永遠重新顯示 gate。
- Auth Context/store：不存在；只有 transient `Game.authUser`。
- Protected route：不存在；也沒有 router。
- Role/Admin：不存在。
- Token/JWT：不存在。
- Guest：已實作。

### 建議的未來 flow

```text
ExplorerGate
  ↓
auth controller / authService
  ↓
Supabase Auth
  ↓
onAuthStateChange + getSession
  ↓
Game.authUser（或小型 auth state module）
  ↓
gameSaveService 只以 session user id 讀寫 own row
```

Supabase email/password 很適合現有欄位，但 UI 標籤「帳號／電子信箱」是否真的要支援 username 仍未定；不可先假設 username login。

## 16. Current Backend Status

Backend 完成度為 0：

- 無 Supabase client package／client initialization。
- 無 backend server、API route、service layer、repository layer。
- 無 `.env.example`、public URL/key contract。
- 無 SQL、migration、schema、RLS policy。
- 無 cloud storage、Edge Function、server log。
- 無 session restore、logout、user-specific save。
- `start.js` 只是本地靜態檔案伺服器，不是業務 backend。

現有三個明示後端 hook：

1. `window.authenticateExplorer({ account, password })`
2. `window.openExplorerRegistration()`
3. `window.openExplorerPasswordReset(account)`

以及三個最自然的存檔 integration point：

1. `createGameCheckpoint()`
2. `restoreGameCheckpoint()` / `getGameCheckpointSummary()`
3. `clearGameCheckpoint()`

## 17. Backend Integration Points

| 前端位置 | 現在做什麼 | 未來接點 | 注意事項 |
|---|---|---|---|
| `login-gate.js` submit | 呼叫 optional global hook | `authService.signIn()` | 保留 status/button/loading 行為 |
| register button | optional hook | `authService.signUp()` + minimal UI | 不重做整個 gate |
| forgot button | optional hook | `authService.resetPassword()` | account 值預填 email |
| app init before gate | 不查 session | `getSession()`/auth state listener | 避免 reload 強制重登 |
| `checkpoint.js:createGameCheckpoint` | 同步寫 localStorage | local cache + async cloud upsert | 不能阻塞 scene transition/game loop |
| `getGameCheckpointSummary` | 同步讀 local | 會員登入後先取得 cloud summary | 主選單需要 loading/error/empty states |
| `restoreGameCheckpoint` | hydrate Game | 先 validate server payload，再沿用 hydrate | 不讓不合法 JSON 破壞 runtime |
| `clearGameCheckpoint` | delete local key | 明確決定是否也 delete cloud current save | 新遊戲語意需確認 |
| `main-menu.js` continue | 依 sync summary enable button | async refresh after auth | main menu 目前在 gate 前就初始化 |
| logout（不存在） | 無 | `authService.signOut()` + 清空 member cache + 回 gate | 必須避免下一個使用者看到前者 save |

## 18. Backend Requirement Matrix

| Frontend Function | Current State | Backend Required | Auth | Database | CRUD | Priority |
|---|---|---|---|---|---|---|
| Email/account login | Hook only | Supabase sign-in adapter | Yes | Supabase managed `auth.users` | Read/authenticate | P0 |
| Registration | Button/hook only | Sign-up + confirmation UX | Yes | `auth.users` | Create | P0 |
| Password reset | Button/hook only | Reset email + recovery completion | Yes | `auth.users` | Update credential | P0 |
| Session restore | Missing | getSession/onAuthStateChange | Yes | No app table | Read session | P0 |
| Logout | Missing | signOut + UI action | Yes | No app table | Delete session | P0 |
| Save at scene entry | localStorage | user-scoped upsert | Yes for cloud | `game_saves` | C/U | P0 |
| Continue game | localStorage | fetch own current save | Yes for cloud | `game_saves` | R | P0 |
| Restart/new game | delete local | agreed cloud reset/delete semantics | Yes for cloud | `game_saves` | D/U | P0 |
| Guest save | localStorage works | Keep local-only | No | None | local CRUD | P0 preserve |
| Save validation/versioning | Weak | schema validator + version migration | Indirect | JSON payload | R/U | P0 |
| Per-user isolation | Missing | RLS ownership policies | Yes | `game_saves` | all | P0 security |
| Offline/network failure | Only local | local fallback + explicit sync policy | Maybe | `game_saves` | R/U | P1 |
| Profile display | No consumer | None now | — | None | — | Deferred |
| Asset upload/storage | Static repo assets | None now | — | None/Storage not needed | — | Deferred |
| Admin/leaderboard/analytics | No UI or requirement | Do not build | — | Do not create | — | Out of scope |

## 19. Database Table Candidates

此階段只提出候選，不建立。

### Supabase managed `auth.users`（基礎能力，不是自建 public table）

- 理由：登入、註冊、password recovery、session 的唯一現有需求。
- 對應 frontend：ExplorerGate。
- 對應 type：Auth hook result 的 `user`。
- 關聯：`auth.users.id` 會成為 `game_saves.user_id` owner。
- 原則：frontend 只使用 publishable key；永不暴露 service role/secret key。

### `public.game_saves`（唯一目前有充分證據的 app table）

- 理由：登入文案承諾可保留探勘紀錄；目前 checkpoint 已定義完整 snapshot。
- 對應 frontend：MainMenu、CheckpointSystem、Death/Ending restore。
- 對應 model：Checkpoint V1。
- 使用 components：`checkpoint.js`、`main-menu.js`、`puzzle.js` scene transitions。
- 建議關係：每個 user 一個 current save，`user_id` 一對零或一 `game_saves`；第一版不做 save slots/history。
- Phase 2 候選欄位（非最終 SQL）：
  - `user_id uuid primary key references auth.users(id) on delete cascade`
  - `schema_version smallint not null`
  - `checkpoint_label text not null`
  - `scene_id text not null`（限制三個合法 scene id）
  - `payload jsonb not null`
  - `created_at timestamptz not null`
  - `updated_at timestamptz not null`
- RLS 方向：authenticated user 只能 select/insert/update/delete `user_id = auth.uid()` 的 row；UPDATE 同時需要 `USING` 與 `WITH CHECK`。

### 明確不建的 tables

- `profiles`：目前沒有 nickname/avatar/profile page 或 role consumer；若確認需要 username login/display 才重新評估。
- `items`、`scenes`、`dialogues`、`puzzles`：都是版本化遊戲內容，不是使用者資料。
- `settings`：現況 local preference 足夠。
- `endings`、`leaderboards`、`achievements`、`analytics_events`：Repository 無相關功能，MVP 亦將 leaderboard/achievement 排除。

## 20. Frontend → Backend Mapping

### Auth

```text
explorer-login-form
  ↓ submit handler (login-gate.js)
authService.signIn({ email/account, password })
  ↓
supabase.auth.signInWithPassword(...)
  ↓
Supabase Auth / auth.users
  ↓ success
auth controller updates Game.authUser
  ↓
gameSaveService.getCurrent()
  ↓
public.game_saves (RLS: own row only)
  ↓
refresh MainMenu continue state
```

```text
explorer-register button
  ↓ open minimal registration UI
authService.signUp()
  ↓ Supabase Auth
auth.users
```

```text
explorer-forgot-password
  ↓ authService.requestPasswordReset(email)
Supabase Auth recovery email
  ↓ recovery callback / updatePassword flow
```

### Save / Continue

```text
finishOpeningCutscene / enterJudgementChamber / enterPharaohTomb
  ↓ createGameCheckpoint(label)
checkpoint codec validates + serializes Checkpoint V1
  ├── guest → localCheckpointStore.set()
  └── member → local cache + gameSaveService.upsertCurrent()
                         ↓ Supabase Data API
                    public.game_saves
                         ↓ RLS user_id = auth.uid()
```

```text
MainMenu Continue
  ↓ gameSaveService.getCurrent() OR guest local store
  ↓ validate schema_version + payload
  ↓ existing restoreGameCheckpoint hydration path
  ↓ Game / player / sceneObjects / timer
```

```text
New Game / Restart
  ↓ clearGameCheckpoint()
  ├── guest → remove local key
  └── member → pending product decision:
               delete current cloud row OR overwrite with new entrance checkpoint
```

### 建議 future file boundaries（Phase 1 才定案／建立）

```text
UI/game modules
  ↓
small auth/save controllers
  ↓
auth-service.js / game-save-service.js
  ↓
supabase-client.js
  ↓
Supabase Auth + PostgreSQL/RLS
```

不建議讓 `scene.js`、`judgement.js`、`tomb.js` 直接 import/call Supabase；它們只應繼續呼叫 checkpoint abstraction。

## 21. Security Risks

| Risk | 現況與影響 | 建議方向 |
|---|---|---|
| 無真正 Auth | 任意人只能走 guest；登入承諾不成立 | Supabase Auth 完整 lifecycle |
| localStorage 不分 user | 共用裝置上不同使用者會看到同一 checkpoint | guest/member namespace + 登出清理 + cloud RLS |
| checkpoint 可任意竄改 | 可偽造場景、inventory、ending；目前沒有競技／經濟影響 | 所有 payload 都視為 untrusted；validate shape/version/ranges |
| Test mode 可改進度 | `?test=1` 能快速進場、改 timer；若直接同步到 server，會污染可信資料 | test-mode save 不上傳，或 production build disable test controls |
| RLS 尚不存在 | 未來若只靠 frontend user id，將形成 BOLA/IDOR | table 啟用 RLS；每個操作都以 `auth.uid()` ownership 限制 |
| Secret exposure risk | 尚無 env，但未來靜態前端最容易誤放 secret/service role | 只放 Supabase publishable key；secret 僅 server-side |
| `start.js` path handling | request path 未做 root containment/normalization、decode 例外處理或 security headers；不可當 production server | production 用正式 static host；若保留則另行 harden |
| Debug panel uses `innerHTML` | runtime error message/filename 直接拼 HTML，若錯誤字串可控可能造成 DOM injection | 改 `textContent`/DOM nodes；不在本 Phase 修改 |
| Remote Google Fonts | 第三方 request、離線失效、CSP/privacy dependency | 決定 self-host 或明確 CSP/connect policy |
| Dynamic `innerHTML` | inventory 現在只吃 static constants；未來若把 server text 直接塞入會有 XSS | server/user content 一律用 `textContent` 或 sanitize |
| No CSP/headers | 靜態頁無明示 CSP、frame/referrer headers | 在 deployment phase 設定 hosting headers |

Supabase 特別注意：暴露 schema 的 table 即使有 Data API grant 仍必須開 RLS；`TO authenticated` 本身不是 authorization，還必須加 ownership predicate。不得以 user-editable `user_metadata` 作 RLS 授權，也不得為解權限錯誤隨意使用 `SECURITY DEFINER`。

## 22. Integration Risks

1. **Global coupling / load order**：12 支 classic scripts 共用 `window.Game`、`audio`、`player` 等名稱；改為 module 前必須有回歸保護，不能在 backend integration 時順便全面重構。
2. **Main menu initializes before Auth gate**：continue availability 目前先讀 shared local save，再由 gate 覆蓋；會員登入成功後必須 async refresh，否則看到錯誤的 save 狀態。
3. **Checkpoint reader validation不足**：只檢查 `version/sceneId/progress`，後續直接展開 `inventory` 並讀 timer/player；損壞或舊版 payload 可造成 runtime exception。
4. **Save semantics是場景入口快照**：不是每個互動即時存檔。後端不得默默改成 live save，否則死亡回檔與解謎風險設計會改變。
5. **Guest/member conflict**：登入後是繼續本機 guest save、下載 cloud save、合併、還是詢問使用者，目前沒有規格。
6. **Async network不能卡住 game loop**：scene transition 與 checkpoint 現為同步；cloud failure 必須非阻塞且有可理解狀態。
7. **Schema version migration**：目前 checkpoint version 固定為 1；cloud save 需要明確 parser/migration，不能只相信 JSONB。
8. **Dev state typo**：`puzzle.js` 的 scene-3 fast-forward 使用 `golden_mask`，正式 item id 是 `gold_mask`。屬測試工具資料不一致，不應帶入 backend schema。
9. **Build/static assets**：大量資產 URL 寫在 classic JS string；Vite production 如何收集／複製它們尚未成功驗證。不可在部署前假設 dev 可見即 production 可見。
10. **Asset footprint**：128 檔約 174 MB，混有 raw JPG、MOV、AEP、PSD、ZIP；直接發布會增加部署、下載或意外公開風險。
11. **Responsive gap**：主容器固定 960×540；CSS 只對若干 modal/menu 做 media query，沒有整體 Canvas viewport scaling。小螢幕可能裁切，不可宣稱完整 mobile support。
12. **No browser E2E**：現有 tests 主要是 VM/unit/source regex；尚未驗證實際 browser session、refresh、network failure 或 cloud integration。
13. **Documentation drift**：企劃/PRD/MVP 部分描述（跳躍、失敗扣秒、結局命名、背包格數等）與現有 code 不完全一致；本稽核以 source behavior 為準。

## 23. Files Likely To Be Modified

### Backend Integration 高機率修改

| 檔案 | 原因 | 修改原則 |
|---|---|---|
| `js/login-gate.js` | 把三個 global hook 接到 auth controller；加入 session/loading/logout coordination | 保留既有 gate DOM、status copy 與 transition |
| `js/checkpoint.js` | 抽離 codec/store，支援 guest local + member cloud | 保留 checkpoint V1 與 restore semantics |
| `js/main-menu.js` | 登入後 async refresh cloud summary、loading/error/empty state | 不重做主選單 |
| `js/puzzle.js` | init 時協調 session/auth/save bootstrap | 只動 composition root；不改 game loop/puzzle rules |
| `index.html` | 載入新的 client/service scripts；最小新增 register/reset/logout UI | 維持單頁與原 overlay hierarchy |
| `css/style.css` | 僅為新增 auth/error/loading controls 延伸既有 design tokens | 不全面 restyle |
| `package.json` | Supabase dependency、修正 dev/build/test module convention | 小步修改並保持 lockfile |
| `pnpm-lock.yaml` | package 安裝後由 package manager 更新 | 不手改 lockfile |
| `.gitignore` / new `.env.example` | 清楚定義 public env names 並阻擋 secrets | 不提交真正 key/secret |

### 可能新增（僅規劃，尚未建立）

- `js/lib/supabase-client.js`
- `js/services/auth-service.js`
- `js/services/game-save-service.js`
- `js/state/auth-controller.js` 或更小的同等 boundary
- `js/storage/checkpoint-codec.js` / validator
- `supabase/migrations/*`（必須用 Supabase CLI 正式建立，Phase 4 才做）
- Auth/save/RLS/integration tests

### 非 backend 但 production 前可能要修

- `start.js` 與 tests 的 ESM/CJS convention。
- `package.json` 的 `tsc && vite build`。
- 資產打包與 raw source file deployment scope。
- debug panel `innerHTML` 與 test-mode production policy。

## 24. Files That Should Be Preserved

以下應視為隊友已完成的 gameplay/UI 核心，除非整合測試證明必要，否則不改或只做極小 adapter 修改：

- `js/scene.js` 的第一場景互動、渲染、落石、光照。
- `js/player.js` 的移動、相機、GIF/idle rendering。
- `js/interaction.js` 的對話、音效與 opening cutscene。
- `js/judgement.js` 的護符 optional branch、天秤規則與場景 render。
- `js/tomb.js` 的鏡面答案、祭壇互動、三種 ending flow。
- `js/objective.js` 的 derived objective rules。
- `js/preload.js` 的現有 asset groups（若資產 pipeline 調整，要先有 asset test）。
- `index.html` 的 Canvas/overlay hierarchy 與既有 accessible labels。
- `css/style.css` 的金色／石材／羊皮紙視覺、typography、spacing、z-index hierarchy、動畫。
- `assets/` 中被 runtime 引用的圖片與角色動畫。
- `tests/` 既有行為斷言；修正 runner 時不能刪除 assertions 來換取通過。
- `docs/` 作為產品意圖紀錄；若日後更新，應另列 source-vs-spec decision。

純為後端串接不應大量 rename、搬資料夾、改 routing、重寫 Canvas 或導入大型 state framework。

## 25. Recommended Backend Architecture

### 判斷：Supabase 適合，但只用需要的部分

理由：這是小型靜態 SPA，後端需求集中在 email/password Auth 與 user-scoped JSON checkpoint；沒有複雜 server computation、支付、多人同步、檔案上傳或 admin workflow。Supabase 可用最少自建 server 的方式提供 Auth、PostgreSQL、RLS 與 migration。

```text
Existing Vanilla JS UI/Game
  ↓
Auth controller / Checkpoint abstraction
  ↓
Auth service / Game save service
  ↓
Supabase JS client (publishable key only)
  ├── Auth
  └── PostgreSQL Data API
       └── game_saves + RLS
```

### Supabase capability decision

| Capability | 建議 | 理由 |
|---|---|---|
| Authentication | 使用 | 直接對應登入／註冊／重設／session |
| PostgreSQL | 使用 | 儲存每位會員 current checkpoint |
| RLS | 必須 | user isolation 不能只做在 frontend |
| Storage | 暫不使用 | 現有資產是版本化 static game files，不是 user uploads |
| Edge Functions | 暫不使用 | 沒有需要保密或 server-authoritative 的業務邏輯 |
| Realtime | 不使用 | 單人遊戲、無多人同步 |
| Migrations | 使用 | schema/RLS/constraints 必須版本化且可重建 |

若未來加入排名、獎勵、競賽或可交易資料，client-submitted checkpoint 就不能被視為可信，屆時才需要 server-side validation/RPC/Edge Function；目前不應預先過度工程化。

## 26. Recommended Database Direction

### 第一版方向

- 一名 authenticated user 最多一筆 current save。
- 保留 checkpoint payload 與 `version:1` 相容；DB 另外抽出 `scene_id`、label、timestamps 供主選單摘要與 constraints。
- guest 仍 local-only，不建立 anonymous DB rows。
- 不把 session token、password 或 service key放入 app table/localStorage。
- 使用 RLS ownership，不接受 frontend 傳來的其他 user id 作授權依據。
- payload 寫入前後都 validate；DB 加合理 JSON/object、scene id、version constraints。
- 明確定義 `updated_at` conflict policy；不能僅以 client clock 決定。
- 保存失敗時保留 local fallback 並告知「尚未同步」，不得讓遊戲 freeze。

### RLS 測試最低要求

1. User A 可 CRUD 自己的 save。
2. User B 無法 select/update/delete User A 的 row。
3. anon 無法讀寫 `game_saves`。
4. INSERT 不能指定其他 user id。
5. UPDATE 不能把 owner 改成其他 user；policy 同時含 `USING` 與 `WITH CHECK`。
6. 登出後既有 client session 不能繼續讀寫；UI 清除 member data。

## 27. Development Roadmap

Phase 0 完成後必須停止並等待確認。依這個 Repository 的真實範圍，建議後續 phases：

| Phase | 目標 | 主要產出 | Gate / 驗證 |
|---|---|---|---|
| 0 | Frontend Deep Audit | 本 `PROJECT_AUDIT.md` | 使用者確認理解正確 |
| 1 | Architecture & Product Decisions | Auth/save/offline/new-game contract、file plan | 逐項確認 Unknowns；不寫 backend |
| 2 | Save Contract & DB Schema | checkpoint schema/validator、ERD、RLS matrix | schema review；不連 remote |
| 3 | Supabase Environment | project/env/key strategy、CLI setup | 無 secrets committed；版本與 docs 驗證 |
| 4 | Migration + RLS | `game_saves` migration/policies/constraints | advisors + A/B/anon isolation tests |
| 5 | Auth Lifecycle | sign-up/sign-in/session/reset/logout | refresh/session/error tests |
| 6 | Save Service | guest local store、member cloud store、codec | C/R/U/D + corrupt/old payload tests |
| 7 | Frontend Integration | gate/menu/checkpoint adapters | 不改 gameplay visuals；full local user flow |
| 8 | Failure & Security Hardening | network/offline/conflict/test-mode/XSS/headers | negative tests + RLS retest |
| 9 | Toolchain & Production Build | ESM/CJS、test runner、Vite/static assets | TypeScript(if retained)、lint、all tests、build |
| 10 | Deployment | hosting/env/redirect/recovery callback | smoke test on deployed URL |
| 11 | Final Full-System Audit | fresh user A/B/guest end-to-end | register→login→play→save→refresh→logout→isolation→ending |

每一 Phase 開始前仍要列出：目標、功能、建立／修改檔案、前端影響、預期結果、驗證方法；完成後列出實改、測試、問題與能否進下一階段。重要 Phase 應在恢復真正 Git repo 後使用清楚且小範圍 commit。

### Phase 0 驗證結果

| Check | Result |
|---|---|
| Git | `git status --short --branch` 失敗：此目錄不是 Git repository |
| JS syntax | `node --check` 對 12 個 `js/*.js` 全部通過 |
| Native test command | 直接 `node tests/login-gate.test.js` 失敗：package ESM 與 CommonJS tests 衝突 |
| Test logic | 以不改檔案的 CommonJS eval compatibility wrapper 執行 16/16 全通過 |
| Local server | `node start.js` 失敗：同一 ESM/CommonJS 衝突 |
| Build | `npm run build` 失敗：未安裝 dependencies，`tsc` 不存在；依使用者限制未安裝 package |
| Browser E2E | 本 Phase 未執行；後續不能把 VM tests 當成 browser/network/deployment 證據 |
| Supabase | 未連線、未建立、未執行 SQL，符合 Phase 0 邊界 |

## 28. Unknowns

以下均是在完整搜尋 Repository 後仍無法從現有程式碼／文件判斷，必須在 Phase 1 由產品或團隊確認：

1. **真正 Git repository 在哪裡？** 目前根目錄無 `.git`；是否是匯出副本、漏抓 hidden folder，或真正 repo 在上層／另一位置。
2. **正式登入 identifier 是 email-only 還是另有 username？** UI 寫「帳號／電子信箱」，但無 profiles/username model。
3. **是否要求 email confirmation，以及確認後回到哪個 production URL？** Repository 無 auth redirect/deployment domain。
4. **註冊、重設密碼、登出要使用同頁 modal、獨立 auth page，還是外部 hosted flow？** 目前只有 hooks，無設計稿或完成 UI。
5. **登入時若同時存在 guest local save 與 cloud save，要下載、上傳、比較時間、詢問使用者，還是永遠以其中一方為準？**
6. **「開始新遊戲／重新開始」對會員 cloud save 的正確語意是刪除、立即覆寫入口 checkpoint，還是保留舊 run？**
7. **是否只要一個 current save，或需要多存檔槽／歷史 runs？** 現有 UI 只支持一個，文件沒有要求多槽。
8. **離線遊玩與重新連線衝突的產品規則是什麼？** 現有遊戲可純離線，但帳號／cloud save 目標未說明 offline policy。
9. **正式部署平台與 build entry 是 Vite 還是純 static hosting？** README 同時列 Node server/Vite，而兩條目前都因工具鏈問題不能直接使用。
10. **production 是否允許 `?test=1` 與隱藏場景校正程式碼存在？** 若 cloud save 有可信用途，答案會影響上傳 policy。
11. **資產製作來源檔（AEP/PSD/MOV/ZIP/raw references）是否應排除 production artifact？** 現有 repo 沒有 deploy allowlist。
12. **目標瀏覽器與手機支援標準為何？** 程式有部分 responsive/accessibility 處理，但 Canvas 容器固定 960×540，無明確 support matrix。
13. **登入會員的設定（音量、文字速度）是否要跨裝置同步？** 現有需求只證明 local setting；本建議預設不進 DB，待確認。
14. **遊戲完成結果是否需要保存？** 現有結局後仍保留入口 checkpoint，沒有 ending history/profile/analytics UI；預設不新增，待產品確認。

---

**Phase 0 結論：** 已找到清楚、狹窄的後端邊界：正式 Auth、session lifecycle、每位會員的 current checkpoint、RLS 與失敗／同步處理。核心三場景 gameplay、靜態內容與既有視覺不需要因後端而重寫。下一步應先確認第 28 節，才進入 Phase 1：Backend Architecture Planning。
