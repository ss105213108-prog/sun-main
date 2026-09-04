# Backend Architecture Planning

> 專案：Heart of the Sun／太陽之心  
> 階段：Phase 1 — Backend Architecture Planning  
> 狀態：規劃完成，尚未實作  
> 日期：2026-09-03  
> 依據：`PROJECT_AUDIT.md` 與 Repository 實際原始碼重新核對  
> 本文件不代表任何 Supabase Project、資料表、SQL、套件或前端程式已建立。

## 1. Executive Summary

本專案是以 Vanilla HTML、CSS、JavaScript 與 Canvas 組成的單頁敘事解謎遊戲，不需要傳統自建 REST Backend。第一版 Backend 應嚴格限縮為兩項能力：

1. Supabase Email/Password Authentication。
2. 每位會員一筆、受 Row Level Security（RLS）保護的雲端 checkpoint 存檔。

建議架構為：

```text
既有 UI / Canvas Game
        ↓
Save Coordinator / Auth Service
        ↓
Supabase JavaScript Client（publishable key）
        ↓
├── Supabase Auth
└── PostgreSQL public.game_saves + RLS
```

場景、對話、物品定義、謎題答案、地圖、素材與故事內容都是程式版本的一部分，應繼續留在前端 Repository。雲端只存玩家可變動的 checkpoint payload，不將整個 `window.Game`、DOM、Canvas、函式或動畫暫態狀態序列化。

第一版模式建議為「分離的權威來源 + 受控復原快取」：

- 訪客：`localStorage` 是權威來源。
- 會員：Supabase 是權威來源。
- 會員端本機只保留 user-scoped 的最後成功快取與待上傳副本，用於網路失敗復原；它不是第二個可自行決定覆蓋雲端的權威來源。
- 登入後若雲端沒有存檔但存在訪客存檔，明確詢問是否匯入；不自動覆蓋。

這個方案保留既有 UI 與 checkpoint 語意，同時避免第一版就建立容易出錯的完整離線雙向同步。

## 2. Backend Scope

### 第一版必做

| 能力 | 範圍 | 原因 |
|---|---|---|
| Authentication | Email/password 註冊、登入、登出、session restore、auth state listener | 現有 `login-gate.js` 已保留 hook，但尚無真實 Auth |
| Email confirmation | 正式環境啟用；註冊後正確處理「已有 user、尚無 session」狀態 | 避免未驗證信箱直接成為正式會員 |
| Password reset | 寄送 reset email、reset redirect、設定新密碼 | 現有 UI 已有忘記密碼入口 |
| Cloud checkpoint | 每位會員 0 或 1 筆 `game_saves` | 現有 UI 只有一個「繼續遊戲」，沒有 slot 選擇器 |
| RLS / grants | authenticated 僅能 CRUD 自己的列；anon 無權存取 | 權限必須在資料庫落實，不靠前端 |
| Save codec | serialize、validate、normalize、migrate、hydrate | 防止損毀或未來版本 payload 直接破壞遊戲狀態 |
| Guest/member coordinator | 根據身份選擇本機或雲端來源 | 避免把身份判斷散落在 UI component/function |
| Error / pending state | Loading、empty、network failure、conflict、retry | 雲端存檔不能以靜默失敗處理 |

### 必要但不屬於遊戲 Backend 功能

- 在導入 Supabase 前穩定目前 Build / ESM / CJS 邊界。
- 找回原始 Git Repository，或在確認這是唯一副本後建立可追蹤的 baseline。
- 以 migrations 管理 schema、RLS、grants、trigger 與測試。
- 以 Vite 環境變數提供 project URL 與 publishable key。

## 3. Non-Backend Scope

以下內容不應進資料庫，也不應在第一版建立對應 table：

| 資料類型 | 實際來源 | 決策 |
|---|---|---|
| Scene / map / world geometry | `scene.js`、`judgement.js`、`tomb.js` | 留在前端版本控制 |
| Dialogue / story / ending copy | 各遊戲模組 | 留在前端版本控制 |
| Item definitions / puzzle answers | `scene.js`、`judgement.js`、`tomb.js`、`puzzle.js` | 留在前端；save 只存 item ID 與完成狀態 |
| Images / audio / fonts / CSS | `images/`、`audio/`、`styles/` | 留在靜態部署；不使用 Supabase Storage |
| Editor/layout config | 各 module 的 layout keys | 保持本機開發用途，不同步玩家帳號 |
| Volume / text speed 等設定 | `sunHeartSettingsV1` | 第一版維持 local-only |
| Ranking / economy / rewards | Repository 不存在 | 不新增 |
| Admin / role / profile center | Repository 不存在 | 不新增 |
| Realtime multiplayer | Repository 不存在 | 不新增 |
| Edge Functions / custom REST API | 目前需求可由 Auth + RLS Data API 完成 | 不新增 |
| Analytics / ending history | Repository 不存在獨立產品需求 | 不新增；`endingId` 僅保留在 save model 相容欄位 |

## 4. Guest Architecture

訪客模式必須完整可玩，不需 Supabase anonymous sign-in。這裡的「Guest」是應用程式模式，不是 Supabase Auth anonymous user。

```text
AUTH_GATE → 選擇訪客
          ↓
Game.isGuest = true
          ↓
checkpoint event
          ↓
GameSave codec
          ↓
localStorage: sunHeartCheckpointV1
```

規則：

- 既有 `sunHeartCheckpointV1` 繼續作為訪客權威存檔，避免破壞已存在的本機進度。
- 不要求網路，Supabase 不可用時仍可開始與繼續訪客遊戲。
- 訪客不能呼叫 `game_saves` 的 select/insert/update/delete；資料庫 grants 與 RLS 都應拒絕。
- 訪客存檔不是 user-scoped；登入成會員後不可直接當會員存檔讀取，必須經過匯入確認與 codec 驗證。
- 設定仍放在 `sunHeartSettingsV1`，與 checkpoint 分離。

## 5. Member Architecture

會員模式的權威來源是 `public.game_saves`。

```text
Supabase session restored / login succeeds
          ↓
Save Coordinator enters MEMBER mode
          ↓
load game_saves where user_id = auth.uid()
          ↓
validate + migrate + hydrate
          ↓
checkpoint event → optimistic update/insert → server acknowledgement
```

會員本機只允許兩種 user-scoped 資料：

- `sunHeartMemberCacheV1:<user-id>`：最後一次雲端確認成功的副本，僅供斷線提示與災難復原。
- `sunHeartMemberPendingV1:<user-id>`：雲端寫入失敗、尚未確認的 checkpoint。

兩者都不能在另一位會員登入時使用，也不能在沒有比對 cloud revision 的情況下自動覆蓋雲端。登出時清除記憶體中的 session/user；user-scoped cache 可保留供同一帳號下次登入復原，但 UI 不得把它顯示成訪客存檔。

## 6. Authentication Architecture

### 身份來源

- 第一版只接受 email + password，不實作 username、phone、OAuth 或 roles。
- `Game.authUser` 是 UI 顯示與模式判斷的快取，不是授權依據。
- Database 授權只信任 request JWT 所對應的 `auth.uid()`。

### 啟動流程

1. 建立單例 Supabase client。
2. 註冊 `onAuthStateChange`；callback 本身保持短小，將後續 async load 排入下一個 task，避免 callback 內互鎖。
3. 讀取現有 session，決定顯示會員 main menu 或 auth gate。
4. 有 session 時設定 member mode，再讀 cloud summary；無 session 時顯示 auth gate，讓使用者選登入或訪客。
5. Auth 初始化完成前，Continue button 顯示 loading/disabled，避免 `main-menu.js` 先以錯誤資料來源判定。

Supabase session 由 access token 與 refresh token 組成，client library 會處理瀏覽器 session persistence/refresh；應監聽 sign-in、sign-out、token refresh 與 password recovery 狀態，而不是自行建立 token localStorage 格式。參考 [Supabase User Sessions](https://supabase.com/docs/guides/auth/sessions) 與 [onAuthStateChange](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)。

### 註冊

- `signUp({ email, password, options.emailRedirectTo })`。
- 正式環境建議啟用 email confirmation。啟用時 sign-up 可能成功建立 user 但不建立可用 session；UI 應顯示「請至信箱完成驗證」，不可直接進 member mode。
- Redirect URL 必須明列 localhost、preview 與 production URL。
- 正式發布前設定 custom SMTP；Supabase 預設寄信服務只適合試用。參考 [Supabase Password-based Auth](https://supabase.com/docs/guides/auth/passwords)。

### 登入、登出與 session restore

- 登入：`signInWithPassword({ email, password })`。
- 登出：`signOut()` 成功後停止 cloud operations、清除記憶體身份，回到 auth gate；不刪除雲端存檔。
- Session restore：啟動時讀 session；真正資料存取仍由 JWT + RLS 保護。
- Auth event 發生後必須重新整理 Continue summary，不能沿用登入前的 guest 判定。

### 忘記密碼

現有 UI 只有「提出 reset」入口，完整流程必須分兩步：

1. `resetPasswordForEmail(email, { redirectTo })` 寄送郵件；無論信箱是否存在都顯示同一種結果，避免帳號枚舉。
2. Reset redirect 回站後顯示設定新密碼 UI，使用 `updateUser({ password })`。

### Protected operations

- 只有 cloud save 的 load/create/update/delete 是 protected operation。
- 遊戲 route `/`、靜態素材與 guest play 不需要登入。
- 不建立 protected route wrapper，因為專案沒有 routing framework。

## 7. Save System Analysis

### 現況

主要實作位於 `js/checkpoint.js`：

- Storage key：`sunHeartCheckpointV1`。
- 記憶體副本：`Game.checkpoint`。
- 深拷貝：以 `JSON.stringify` / `JSON.parse` 處理。
- 寫入：`createGameCheckpoint(label)` 建立物件，再寫入記憶體與 localStorage。
- 讀取：`readStoredCheckpoint()` parse JSON，但只檢查 `version === 1`、`sceneId` 與 `progress` 是否存在。
- 摘要：`getGameCheckpointSummary()` 回傳 `label`、`sceneId`、`createdAt`。
- 載入：`restoreGameCheckpoint()` 回填 scene、progress、inventory、puzzle/timer/player，重建 scene objects，並關閉不相容 overlays。
- 清除：`clearGameCheckpoint()` 同時清除 `Game.checkpoint` 與 localStorage。

### 實際 checkpoint shape

```js
{
  version,
  label,
  sceneId,
  createdAt,
  progress,
  inventory,
  selectedItem,
  scaleState,
  mirrorState,
  timer: { remainingSeconds, isRunning },
  player: { x, y, direction } | null
}
```

### 實際儲存時機

| Trigger | 檔案 / function | Label | 語意 |
|---|---|---|---|
| 開場動畫完成 | `interaction.js` → `finishOpeningCutscene()` | 太陽神殿入口 | 第一場景 checkpoint |
| 進入審判室 | `judgement.js` → `enterJudgementChamber()` | 天秤審判室入口 | 第二場景 checkpoint |
| 進入法老王墓室 | `tomb.js` → `enterPharaohTomb()` | 法老王墓室入口 | 第三場景 checkpoint |

目前沒有手動 save、定時 save、每次互動 save 或結局完成 save。其產品語意是「死亡後回到場景入口」，不是隨時續玩。因此 Phase 1 不把它改造成 live-state autosave。

### 實際載入時機

- `main-menu.js` 的 Continue：讀 summary、預載資源，再 restore checkpoint。
- Death screen 的回到 checkpoint。
- 部分 bad ending 的回到 checkpoint。

### Reset / New Game

`puzzle.js:restartGame()` 會：

- 呼叫 `clearGameCheckpoint()`。
- 將所有 progress flags、inventory、scale/mirror、timer、scene/player 與視覺暫態重設。
- 回到第一場景開場流程。

會員新遊戲不應在使用者剛按下按鈕時立即 delete cloud row；建議保留舊 cloud checkpoint，直到新的「太陽神殿入口」checkpoint 成功寫入後才以新資料覆蓋。若使用者在 prologue/cutscene 中關閉頁面，舊存檔仍可復原。

### 可序列化與不可序列化資料

目前 checkpoint shape 只含 plain object、array、string、number、boolean、null，可 JSON 序列化。以下 runtime state 不可進 save：

- Canvas / context、DOM node、Image、Audio、function/callback。
- `sceneObjects` 中的互動函式。
- keys、camera target、particle/rock/dust arrays。
- dialogue callback/timer、animation frame、timeout ID。
- `Game.authUser` / session / tokens。
- `performance.now()` 基準的動畫時間不可作跨裝置時間依據。

### 現有風險

- Nested shape、enum、number range 都未驗證，損毀資料可能在 hydrate 時拋錯。
- Local key 不區分使用者。
- `createdAt` 是 client clock，不能用於安全或衝突裁決。
- `progress.awakeningStartedAt` 與 `mirrorRiseStartedAt` 是 page-relative 動畫時間；跨裝置載入時應 normalize 為完成狀態或 0，而不是原值重播。
- `slatesOrder` 是 module-local UI state，未存檔；因目前 checkpoint 只建立在場景入口，現況可接受。
- 結局欄位雖存在於 `progress`，但現有 checkpoint trigger 通常不會在結局後捕捉它；第一版不宣稱提供 ending history。

## 8. Canonical GameSave Model

Canonical model 應延續既有 checkpoint，而不是序列化整個 `Game`。建議契約如下：

```text
GameSaveV1
├── version: 1
├── label: non-empty string, max 80
├── sceneId: sun_temple | judgement_chamber | pharaoh_tomb
├── createdAt: finite integer milliseconds (legacy/display only)
├── progress: GameProgressV1
├── inventory: unique ItemId[]
├── selectedItem: ItemId | null
├── scaleState
│   ├── left: TrialItemId | null
│   └── right: TrialItemId | null
├── mirrorState: [0..2, 0..2, 0..2]
├── timer
│   ├── remainingSeconds: finite number, clamp 0..900
│   └── isRunning: boolean
└── player: { x: finite number, y: finite number, direction: -1 | 1 } | null
```

### `GameProgressV1`

依實際程式碼欄位整理：

```text
investigatedMural, investigatedTablet, puzzleCleared, torchTaken,
doorOpened, sunBadgeRevealed, sunBadgeTaken, sunBadgePlaced,
scene2Entered, judgementMuralRead, scaleCompartmentOpened,
scaleCompartmentSealed, scalePuzzleIntroduced, priestAmuletFound,
scaleCleared, scene3Entered, tombMechanismActivated,
priestAmuletActivated, priestWarningRead, mirrorsRevealed,
mirrorPuzzleSolved, sealedHeartAltarViewed, sunHeartAltarRevealed,
tombEscapeActive: boolean

scaleMistakes, mirrorMistakes: non-negative integer
collectedTrialItems: Record<TrialItemId, true>
sunHeartTaken: boolean | null
endingId: true_guardian | normal_taken_seal | bad_entombed | null
```

相容欄位 `awakeningStartedAt` 與 `mirrorRiseStartedAt` 可由 V1 parser 接受，但 hydrate 時轉為安全的完成狀態；V2 可正式移除。未知 progress key 應丟棄而不是寫回 runtime。

### ID allowlist

Codec 必須從現有 item definitions 建立明確 allowlist。已確認的 ID 包含 `torch`、`sun_badge`、`priest_amulet`、`golden_mask`／程式中曾出現的 `gold_mask` 相容值、`truth_feather`、`stone_heart`、`jewel_scarab`，以及第一場景石板相關 ID。Phase 2 應以 `rg` 結果建立單一常數並補測試，先處理 `gold_mask` 與 `golden_mask` 的既有不一致，不能猜測或靜默改名。

### Database envelope

`user_id`、cloud `revision`、`created_at`、`updated_at` 不放進 `save_data`；它們是 server-side row metadata。Auth token、email、password 也永不進 `save_data`。

## 9. Save Version Strategy

`version` 代表 payload schema，不代表遊戲版本，也不代表資料庫 revision。

規則：

1. 目前 canonical 版本為 `1`，沿用既有 `sunHeartCheckpointV1`。
2. 所有 local/cloud input 都必須走 `parse → validate → migrate → normalize`，不可直接 assign 到 `Game`。
3. `save_version` column 與 `save_data.version` 必須相等。
4. 未來每次格式改動新增單向 migrator，例如 `migrateV1ToV2()`；不可散落在 UI。
5. 舊版成功 migration 後先在記憶體使用；等下一次 checkpoint 或使用者確認後才寫回最新版，避免讀取動作意外覆寫。
6. 遇到比 client 新的 version：停止 hydrate、不覆蓋原 row，提示使用者重新載入／更新遊戲。
7. 遇到 invalid save：保留原始資料供診斷，不自動 delete；UI 提供重試或新遊戲。
8. Codec 與 migrators 必須有固定 fixture tests。

## 10. Local / Cloud Strategy

### 選項比較

| 選項 | 說明 | 複雜度 | UX / Offline | 衝突風險 | Portfolio 呈現 | 結論 |
|---|---|---:|---|---|---|---|
| A | Guest local、Member cloud，完全分離 | 最低 | Member 斷線寫入可能遺失 | 低 | 架構清楚但故障韌性弱 | 不採完整版本 |
| B | Member local + cloud 完整雙向同步 | 高 | Offline 最佳 | 高；多裝置/newest-wins 很容易覆蓋 | 能展示 sync，但超出遊戲需求 | 第一版不採 |
| C | 分離權威來源 + user-scoped recovery cache | 中低 | 遊戲可繼續；checkpoint 可標示 pending | 受控；不做自動雙向合併 | 能展示清楚的 failure/conflict design | **推薦** |

### 決策

採 Option C，但明確限制為：

- Guest local authoritative。
- Member cloud authoritative。
- 本機 cache 只用於「最後成功副本」與「尚未成功上傳副本」。
- 不採用單純 `createdAt` 或瀏覽器時鐘的 newest-wins。
- 使用 database `revision` 做 optimistic concurrency。
- 多裝置 revision 不一致時停止自動覆蓋，讓使用者選擇載入雲端或以本機 pending 明確取代。
- 第一版不承諾完整 offline-first；網路中斷時可繼續當前遊戲，但畫面必須顯示「尚未同步」。

## 11. Supabase Architecture

### 使用的 Supabase 能力

```text
Supabase Project
├── Auth
│   ├── Email/password
│   ├── Email confirmation
│   ├── Password recovery
│   └── Browser session persistence
└── PostgreSQL
    └── public.game_saves
        ├── FK → auth.users.id
        ├── RLS
        ├── minimal grants
        ├── updated_at/revision trigger
        └── pgTAP RLS tests
```

### 明確不使用

- Storage：素材由現有靜態網站部署。
- Realtime：一人一筆存檔不需訂閱。
- Edge Functions：沒有 server-secret 工作、付款、排行榜或不可由 RLS 表達的規則。
- 自建 API server：增加部署面與維運成本，沒有對應需求。

### Browser client key

Browser 只能使用 `sb_publishable_...`。Supabase 已將 publishable key 定位為可配送到 browser 的低權限 key；真正資料隔離依靠 Auth JWT、table grants 與 RLS。Secret/service-role key 會繞過 RLS，絕不可出現在 browser、bundle、Repository 或 log。參考 [Supabase API Keys](https://supabase.com/docs/guides/getting-started/api-keys)。

## 12. Database Schema Proposal

第一版只有一張 application table：`public.game_saves`。

| Column | PostgreSQL type | Null | Default / ownership | Constraint | Purpose |
|---|---|---:|---|---|---|
| `user_id` | `uuid` | No | client service 從目前 session user 取得 | Primary key；FK → `auth.users(id)`；`ON DELETE CASCADE` | 一位 user 最多一筆 save，亦是 row owner |
| `save_version` | `smallint` | No | `1` | `>= 1`；與 `save_data.version` 相等 | Payload migration 版本 |
| `current_scene` | `text` | No | 無 | allowlist 三個 scene；與 `save_data.sceneId` 相等 | 快速 summary 與 DB 層一致性 |
| `save_data` | `jsonb` | No | 無 | 必須是 JSON object；建議最大 64 KiB | Canonical GameSave payload |
| `revision` | `bigint` | No | `1`，由 DB trigger 在 update 時遞增 | `>= 1`；client 不自行決定新值 | Optimistic concurrency token |
| `created_at` | `timestamptz` | No | database `now()` | authenticated 不取得此欄的 INSERT/UPDATE privilege | Row 初次建立時間 |
| `updated_at` | `timestamptz` | No | database `now()`，由 update trigger 更新 | authenticated 不取得此欄的 INSERT/UPDATE privilege | 可信的雲端存檔顯示時間 |

### 為何沒有 `id`

`user_id` 已是 primary key 且產品是一人一筆存檔；再加 surrogate `id` 會允許或暗示多列，增加 unique constraint 與 query 複雜度，沒有價值。

### 為何沒有 `checkpoint_label` column

每次只讀一筆 row，label 可從 `save_data.label` 取得。只有 `current_scene` 因 allowlist、主選單摘要與一致性檢查而抽出。若未來查詢分析需要 label，再由 migration 增加 generated/derived 欄位，第一版不預先設計。

### 完整性責任

- Database：owner、型別、top-level JSON、size、version/scene 一致性、server timestamps。
- Client codec：完整 nested fields、enum、range、array uniqueness、player bounds 與 migration。
- RLS：誰可碰哪一列。

本節是 schema proposal，不是已建立 migration，也不是可直接執行的 SQL。

## 13. JSONB vs Normalized Decision

### 決策：一筆 metadata + 一個 `jsonb` payload

理由：

- 讀寫單位就是完整 checkpoint，不需要查詢「所有拿過火把的玩家」。
- Progress flags 與 puzzle state 會隨遊戲演進，拆成多張表會讓每次 checkpoint 需要 transaction 與大量 mapping。
- 每位使用者只有一筆、小於 64 KiB 的 document，JSONB 很適合。
- 既有 localStorage shape 可透過 codec 遷移，不需重新發明 domain model。

不採完全 opaque JSON：`save_version`、`current_scene`、`revision`、timestamps 仍正規化為 column，方便 constraint、摘要與衝突控制。

未來只有在出現跨玩家查詢、排行榜、成就統計、多人共享或多 slot history 時才考慮 normalized tables。不要因為 PostgreSQL 支援關聯就先拆 `inventory_items`、`puzzle_progress` 等表。

## 14. Profiles Decision

### 決策：第一版不建立 `profiles`

實際前端沒有 display name、avatar、bio、role、admin、會員中心或公開玩家資料。`auth.users` 已提供身份 ID 與 email；UI 可從 Auth user 取得 email 顯示。

只有在確認需要以下能力時才新增 profiles：

- 可編輯的 display name。
- Avatar。
- 公開/社交玩家頁面。
- 應用程式角色或偏好（且不能只靠不可信的 user metadata 做授權）。

省略 profiles 可避免無用途的 signup trigger、RLS table 與資料一致性問題。

## 15. Single Save vs Save Slots Decision

### 決策：每位會員單一 current checkpoint

| 證據 | 結論 |
|---|---|
| 主選單只有一個 Continue | 無 slot 選擇 UX |
| Local storage 只有一個 `sunHeartCheckpointV1` | 現行 domain 是 singleton |
| Death/ending 回復使用同一 checkpoint | 不存在歷史列表語意 |
| 三個 trigger 都是場景入口覆寫 | Save 是 rollback point，不是收藏紀錄 |

因此 `user_id` 直接作為 PK。若未來產品明確要求 3 slots，再新增 `slot_no` 並改為 composite unique `(user_id, slot_no)`；那會同時要求新增 UI、slot summary、delete/rename 與 migration，不應偷偷預留成未使用功能。

## 16. ERD

```text
auth.users                         public.game_saves
┌─────────────────────┐           ┌─────────────────────────┐
│ id uuid (PK)         │ 1       0..1│ user_id uuid (PK, FK) │
│ email / auth fields  │───────────│ save_version smallint   │
└─────────────────────┘  CASCADE   │ current_scene text      │
                                    │ save_data jsonb         │
                                    │ revision bigint         │
                                    │ created_at timestamptz  │
                                    │ updated_at timestamptz  │
                                    └─────────────────────────┘
```

不從 public schema 直接讀 `auth.users`；關聯只作 FK 與生命週期管理。

## 17. RLS Architecture

`public.game_saves` 位於 exposed schema，必須啟用 RLS。官方文件指出 grants 與 policies 是兩層獨立檢查；兩者都要設定與測試。參考 [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)。

### Grants

| Role | SELECT | INSERT | UPDATE | DELETE |
|---|---:|---:|---:|---:|
| `anon` | No | No | No | No |
| `authenticated` | 全 row 可讀（仍受 RLS） | 僅 `user_id`, `save_version`, `current_scene`, `save_data` | 僅 `save_version`, `current_scene`, `save_data` | Yes |
| secret/service role | Browser 不使用 | Browser 不使用 | Browser 不使用 | Browser 不使用 |

先 revoke client roles 的既有 table grants，再只 grant 上表需要的 table/column operations；不能假設建立 policy 就會自動移除多餘 grant。`revision`、`created_at`、`updated_at` 由 database default/trigger 管理，authenticated client 不取得其 INSERT/UPDATE column privilege；`user_id` 可 insert 但不可 update。這使 server metadata 不只依賴前端自律。

### Policy intent

| Operation | Role | Predicate / check | 效果 |
|---|---|---|---|
| SELECT | authenticated | `(select auth.uid()) = user_id` | 只能看到自己的 save |
| INSERT | authenticated | `WITH CHECK (auth.uid() = user_id)` | 不能替別人建立 row |
| UPDATE | authenticated | `USING (auth.uid() = user_id)` 且 `WITH CHECK (auth.uid() = user_id)` | 只能改自己的 row，也不能把 owner 改成別人 |
| DELETE | authenticated | `USING (auth.uid() = user_id)` | 只能清除自己的 row |

只寫 `TO authenticated` 不等於 owner isolation；所有已登入者仍共享同一 role，必須加入 `auth.uid() = user_id`。UPDATE 同時需要 SELECT policy 才能正常工作，並需要 `USING` 與 `WITH CHECK` 防止 ownership 被改寫。

### RLS tests

Phase 4 必須建立 pgTAP 測試，至少涵蓋：

- anon 四種操作全部拒絕。
- User A 可 CRUD A row。
- User A select 看不到 User B row。
- User A 無法 insert/update/delete User B row。
- User A 無法在 update 時將 `user_id` 改為 B。
- 刪除 auth user 時 save cascade delete。
- 缺少 session/JWT 時操作失敗。

## 18. Security Model

### Trust boundaries

```text
Browser data（不可信）
  ├── email/password input → Supabase Auth
  ├── user_id derived by service → RLS 再驗證 auth.uid()
  └── save_data → codec + DB constraints

Database（權威）
  ├── row ownership
  ├── revision
  ├── created_at / updated_at
  └── grants + RLS
```

### Key rules

- Browser 只放 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_PUBLISHABLE_KEY`。
- Publishable key 本來就可被檢視，不能把「藏 key」當成安全控制。
- Secret key / legacy service-role key 絕不出現在 `.env.example` 的真值、前端、source map、console、CI log 或 issue。
- Service API 不接受 caller 傳入任意 `userId`；由目前 Auth user 衍生。即便 client 被改寫，RLS 仍會阻擋偽造 owner。
- Password 只交給 Supabase Auth，不進 `Game`、localStorage、自訂 table 或 log。
- 不用 `user_metadata` 決定存檔 ownership 或權限。
- 建議對 `save_data` 設 size constraint，避免已登入 client 寫入異常巨大 JSON。
- 對 UI 內容使用 `textContent`，不把 cloud label 以 `innerHTML` 注入。
- `?test=1` 或開發直達功能不得將測試進度上傳 production cloud；save coordinator 必須在 production/test mode 間設 guard。
- 遊戲是非競技單人作品，玩家可在自己瀏覽器竄改自己的進度不是跨使用者安全漏洞；不需要 Edge Function 做 server-authoritative gameplay。

## 19. Service Layer Architecture

為維持 Vanilla 架構與可測試性，建議只新增以下薄層：

```text
js/
├── lib/
│   └── supabase-client.js       # createClient singleton + env validation
├── services/
│   ├── auth-service.js          # Auth API wrapper
│   ├── game-save-service.js     # game_saves CRUD + revision handling
│   └── save-coordinator.js      # guest/member source selection + pending cache
├── models/
│   └── game-save.js             # serialize/validate/migrate/normalize/hydrate helpers
└── backend-bootstrap.js         # composition, auth hooks, auth listener
```

責任邊界：

| Module | 可以做 | 不可以做 |
|---|---|---|
| `supabase-client` | 建 client、檢查 public env | UI、Game mutation、secret/admin client |
| `auth-service` | signUp/signIn/signOut/session/reset/update password | 操作 checkpoint 或 DOM |
| `game-save-service` | select/insert/update/delete own row、回傳 typed result | 直接讀寫 `Game` 或 localStorage |
| `save-coordinator` | 選 local/cloud、pending/retry/conflict orchestration | 定義故事/場景或 RLS |
| `game-save` | pure codec 與 hydrate plan | 網路、DOM、localStorage |
| `backend-bootstrap` | 將既有 `window.*` hooks 接到 service | 承載業務資料或重寫 game loop |

這些新檔案使用 ES modules；既有 gameplay scripts 暫不全面轉 module。具體 script boundary 必須等 Build/ESM phase 驗證後鎖定。

## 20. Frontend Integration Mapping

| Existing frontend | Event / function | New layer | Supabase / storage | Result |
|---|---|---|---|---|
| `login-gate.js` | `window.authenticateExplorer({account,password})` | `authService.signIn(email,password)` | Supabase Auth `signInWithPassword` | session → member mode |
| `login-gate.js` | `openExplorerRegistration()` | registration UI → `authService.signUp` | Supabase Auth signUp | confirmation message/session |
| `login-gate.js` | `openExplorerPasswordReset(account)` | `authService.requestPasswordReset` | Supabase Auth reset email | generic success state |
| reset redirect UI | submit new password | `authService.updatePassword` | Supabase Auth updateUser | recovery complete |
| startup / `puzzle.js:initApp()` 周邊 | app ready | `backendBootstrap.initialize()` | restore session + listener | AUTH_GATE or member main menu |
| `checkpoint.js` | `createGameCheckpoint(label)` | `gameSave.serialize` → `saveCoordinator.save` | Guest local / Member cloud | confirmed or pending checkpoint |
| `main-menu.js` | refresh Continue | `saveCoordinator.getSummary()` | active mode source | correct label/time/button state |
| `main-menu.js` | Continue click | `saveCoordinator.load()` → validate/migrate | local/cloud select | validated checkpoint |
| `checkpoint.js` | `restoreGameCheckpoint()` | `gameSave.hydrate` + existing scene rebuild | no direct DB call | runtime restored |
| `puzzle.js` | `restartGame()` | `saveCoordinator.beginNewGame()` | defer cloud overwrite until new entrance checkpoint | old safe save retained during intro |
| future logout control | logout click | `authService.signOut()` | Supabase Auth | stop member operations → AUTH_GATE |

### 最小侵入原則

- 保留 `createGameCheckpoint`、`restoreGameCheckpoint` 對其他遊戲模組的 public API，內部改委派 coordinator。
- `interaction.js`、`judgement.js`、`tomb.js` 的 checkpoint 呼叫點原則上不改。
- 不重寫 Canvas loop、scene transition、dialogue、inventory 或 puzzle modules。
- `main-menu.js` 只改資料來源與 async state，不改視覺結構。
- Auth UI 的新增只補足目前 hook 所代表的流程，不重做整個入口畫面。

## 21. Save Flow

### Guest

```text
scene entrance trigger
→ createGameCheckpoint(label)
→ serialize + validate GameSaveV1
→ write sunHeartCheckpointV1
→ update Game.checkpoint
→ refresh Continue summary
```

### Member（正常 online）

```text
scene entrance trigger
→ serialize + validate
→ write user-scoped pending copy
→ gameSaveService reads known cloud revision
   ├── cloud row absent → INSERT revision 1
   └── cloud row present → UPDATE where user_id=self AND revision=known
→ DB validates RLS/constraints and increments revision/updated_at
→ success: store acknowledgement cache, clear pending, show synced
```

### `user_id` 來源

Service method 不接受 UI 提供的 `userId`。它從 Supabase Auth 的目前 user/session 取得 ID，再把它放入 insert row；RLS `WITH CHECK auth.uid() = user_id` 是最後權威。這不是信任 client，而是讓 row 可建立並由 DB 驗證。

### 失敗處理

- Network/5xx：保留 pending copy；遊戲繼續；顯示「此 checkpoint 尚未同步」與 retry。
- 401/session expired：先讓 client 完成 refresh；仍失敗則切回 auth-required，不把 pending 當 guest save。
- RLS/403：視為安全或設定錯誤，不重試迴圈；記錄不含敏感資料的 error code。
- Validation error：不送網路；保留上一筆成功存檔；顯示無法建立 checkpoint。
- Revision mismatch：進 conflict flow，禁止自動 overwrite。

所有 save requests 應序列化排隊；同一頁面快速連續 checkpoint 只允許一個 in-flight write，後來的 valid checkpoint 取代尚未送出的舊 pending。

## 22. Load Flow

### 啟動 / 主選單

```text
Auth initialization pending
→ Continue disabled/loading
→ determine mode
   ├── Guest → read sunHeartCheckpointV1
   └── Member → SELECT own game_saves row
→ no row: Continue disabled; offer New Game
→ row exists: parse/validate/migrate
   ├── valid → show scene label + server updated_at
   └── invalid/future version → keep row; show actionable error
```

### Continue

1. 再次讀取 active source，避免 summary 與 click 間資料已改。
2. Validate/migrate，產生 immutable normalized object。
3. 先預載目標 scene assets。
4. 將 normalized data交給既有 restore/hydration 邏輯。
5. 只有 hydrate 全部成功才關閉 menu；失敗則保留目前畫面與原始 save。

### Member 無網路

- 若有最後成功 cache：顯示「雲端暫時無法確認」；第一版不自動以 cache 啟動並隨後覆寫。
- 可提供明確「以離線副本繼續」動作，但必須標示 pending，恢復連線時走 revision conflict check。
- 若無 cache：保留在 menu，提供重試或改用新的 guest session；不要把會員 cloud absence誤判成真正 empty state。

### 雲端沒有 save

- 若有 valid guest save：進入一次性匯入詢問。
- 若沒有：Continue disabled，New Game available。
- 不為單純登入自動建立空 row；第一個實際 checkpoint 才 insert。

## 23. Guest → Member Migration

### 選項比較

| 選項 | 優點 | 問題 |
|---|---|---|
| 不轉移 | 最簡單 | 訪客註冊後看不到剛玩的進度，UX 差 |
| 明確詢問後上傳 | 使用者理解資料去向；可避免覆蓋 | 需要一個確認 state |
| 自動上傳 | 少一步 | 容易覆蓋已有 cloud save，身份切換不可預期 |

### 決策：明確詢問，且只在安全條件成立時提供

條件：

1. 登入/註冊後已有有效 member session。
2. `sunHeartCheckpointV1` 通過 codec。
3. Cloud row 不存在。

流程：

```text
偵測 guest save + cloud empty
→ 詢問「將這台裝置的訪客進度存到此帳號？」
   ├── 稍後：保留 guest save，不建立 cloud row
   └── 匯入：INSERT own row
             ├── success → clear guest key（再次確認/明確文案）
             └── failure → guest key 保留，顯示 retry
```

若 cloud row 已存在，第一版永不自動匯入。預設載入 cloud；保留 guest key。若要提供「以訪客進度取代雲端」，必須顯示兩筆 summary 並要求二次確認，這可列在 conflict UX phase，不在登入瞬間偷偷做。

## 24. Error Handling Strategy

### 統一 result contract

Service 不把 raw Supabase error 直接丟到 UI；回傳：

```text
{ ok: true, data }
或
{ ok: false, code, retryable, userMessageKey, cause? }
```

Production UI 不顯示 SQL、JWT、request payload 或 stack。Development log 可記錄 operation、error code、request correlation context，但不得記 password/token/key/full save。

### UI states

| 狀態 | UI 行為 |
|---|---|
| `auth-loading` | Gate/Menu 防重複提交，顯示初始化中 |
| `auth-error` | 保留 email，不保留 password；顯示可理解訊息 |
| `confirmation-required` | 顯示檢查信箱與重新寄送（若後續需要） |
| `save-syncing` | 非阻塞 indicator，不暫停 game loop |
| `save-synced` | 短暫成功提示，可顯示 server time |
| `save-pending` | 明確尚未同步，可 retry |
| `load-empty` | Continue disabled，New Game |
| `load-network-error` | 不當作 empty；Retry / Guest 選項 |
| `load-invalid` | 不覆寫；顯示版本/損毀問題與 New Game |
| `conflict` | 顯示 cloud/local summary；不自動選 newest |

### 防重複操作

- Login/Register/Reset submit 期間 disable button。
- Save queue 單一 in-flight。
- Continue load 使用 operation token，過期 response 不 hydrate。
- Auth user change 時取消/忽略前一 user 的 pending async result。

## 25. Environment Strategy

### 目標方案

當 Vite build 穩定後使用：

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

- `.env.local`：本機真值，加入 `.gitignore`。
- `.env.example`：只有名稱與 placeholder，不放真值。
- Hosting provider：以 environment settings 注入 production/preview 值。
- Test：使用隔離的 local Supabase 或測試 project，不指向 production。

Supabase URL 與 publishable key 會出現在 browser bundle，這是正常設計；環境變數的作用是環境切換與避免硬編碼，不是把 publishable key 變成 secret。正式新專案使用 publishable key 命名，不再以 legacy `SUPABASE_ANON_KEY` 作首選。官方目前說明 browser 應使用 publishable key，而 secret key 必須留在受控 server 環境：[API Keys](https://supabase.com/docs/guides/getting-started/api-keys)。

### Environment matrix

| Environment | Supabase target | Email redirect | Cloud writes |
|---|---|---|---|
| Local dev | Local stack 或專用 dev project | localhost Vite URL | 測試資料 |
| Preview | 專用 preview/dev project | preview allowlist | 不碰 production |
| Production | production project | production HTTPS URL | 正式資料 |

不得讓 PR preview 直接寫 production game_saves。

## 26. Build / ESM Risks

### 已確認現況

- `package.json` 設定 `"type": "module"`。
- `start.js` 與現有 16 個 tests 使用 CommonJS 語法，原生執行會出現 ESM/CJS 衝突。
- `build` 指令是 `tsc && vite build`，但 Repository 無 TypeScript 專案設定且未安裝 dependencies。
- `index.html` 目前以 classic `<script>` 與 `window.*` globals 組合 12 個模組。
- Repository 目前不是 Git working tree。

### 對 Backend 的影響

- `@supabase/supabase-js` 應以 ESM import 進入 bundler；不能直接塞進既有 classic script。
- 若直接把全部 gameplay scripts 改成 modules，載入順序與 globals 可能大範圍破壞，違反最小侵入。
- 若改用 CDN global，可暫避 build，但版本鎖定、SRI、測試與 production reproducibility 較差，不建議。
- `import.meta.env` 只能在 Vite 處理的 module 邊界使用。

### 建議 gate

進入 Backend 實作前先以獨立小 Phase：

1. 確認真正的 Git root/origin。
2. 決定 package 是全 ESM，並將 Node-only `start.js`/tests 改為相容方式；不動 gameplay behavior。
3. 修正 build script，使它反映實際 Vanilla Vite 專案。
4. 建立一個 `backend-bootstrap.js` module boundary；它在既有 classic scripts 建立 globals 後啟動，透過明確 `window` hooks 溝通。
5. 先以無 Supabase 的 smoke test 證明 load order 沒變，再安裝 client package。

本文件不執行上述修正。

## 27. Git Strategy

目前目錄沒有 `.git`，因此不能直接依照團隊 Phase 建議 commit。優先順序：

1. 向隊友取得原始 GitHub/GitLab Repository URL、正確 branch 與目前 commit。
2. 將這份匯出目錄與原始 checkout 以檔案清單/hash 比較，確認沒有漏掉未提交成果。
3. 在原始 repository 建新 backend branch；不要在未知來源的副本上直接覆蓋隊友工作。
4. 只有當確認此目錄就是唯一來源、且已備份後，才考慮 `git init` + baseline commit。
5. 每個 Phase 小 commit，範例：
   - `chore: stabilize vanilla vite toolchain`
   - `feat: add supabase migration and rls tests`
   - `feat: implement email authentication service`
   - `feat: add versioned cloud checkpoint service`
   - `test: cover auth and save integration`
6. UI/CSS/asset 變更與 backend integration 分 commit，方便 reviewer 判斷是否誤改前端。

## 28. Architecture Diagram

```text
┌──────────────── Existing Browser Application ────────────────┐
│                                                               │
│  login-gate.js     main-menu.js       checkpoint.js           │
│       │                  │                   │                 │
│       └──────────────┬───┴───────────────────┘                 │
│                      ▼                                         │
│              backend-bootstrap.js                              │
│                 │             │                                │
│                 ▼             ▼                                │
│          auth-service     save-coordinator                     │
│                 │          │          │                        │
│                 │          │          ├─ Guest localStorage    │
│                 │          │          └─ Member pending cache  │
│                 │          ▼                                   │
│                 │    game-save-service                         │
│                 │          │                                   │
│                 └──────┬───┘                                   │
│                        ▼                                       │
│               supabase-client.js                               │
└────────────────────────┬───────────────────────────────────────┘
                         │ publishable key + user JWT
                         ▼
┌──────────────────── Supabase Project ─────────────────────────┐
│  Auth                         PostgreSQL                       │
│  email/password ─ user.id ──► public.game_saves               │
│                               grants + RLS + constraints       │
└───────────────────────────────────────────────────────────────┘
```

## 29. Data Flow

### Auth data flow

```text
Email/password form
→ auth-service
→ Supabase Auth
→ session/user event
→ backend bootstrap updates Game.isGuest/Game.authUser
→ save coordinator selects member mode
→ main menu reloads cloud summary
```

### Checkpoint data flow

```text
Game runtime
→ createGameCheckpoint(label)
→ serialize only canonical fields
→ validate and normalize
→ Save Coordinator
   ├── Guest → sunHeartCheckpointV1
   └── Member → pending cache → game-save-service
                              → RLS-protected row
                              → revision/updated_at acknowledgement
```

### Restore data flow

```text
Active source
→ parse JSON / select row
→ validate version and structure
→ migrate old version
→ normalize transient animation fields
→ preload scene assets
→ restoreGameCheckpoint/hydrator
→ scene-specific object rebuild
→ PLAYING
```

### Ownership data flow

```text
Supabase Auth JWT subject
→ auth.uid()
→ RLS compares game_saves.user_id
→ only matching row becomes visible/writable
```

## 30. ADR Decisions

### ADR-001 — Use Supabase instead of a custom API server

- **Decision:** Supabase Auth + PostgreSQL Data API + RLS。
- **Reason:** 需求只有 identity 與小型 per-user CRUD；自建 server 沒有額外 domain value。
- **Consequence:** Schema/RLS/tests 成為 backend 核心，browser 必須正確使用 publishable key。

### ADR-002 — Store one JSONB checkpoint per user

- **Decision:** `game_saves.user_id` PK，payload 使用 JSONB。
- **Reason:** Checkpoint 是整體讀寫單位，沒有跨玩家欄位查詢需求。
- **Consequence:** Nested validation 由 codec 負責，DB 保留 top-level constraints。

### ADR-003 — Guest local, member cloud authoritative

- **Decision:** 採分離權威來源與 user-scoped recovery cache。
- **Reason:** 保留 offline guest UX，避免完整雙向 sync 複雜度，同時處理 member write failure。
- **Consequence:** UI 必須區分 synced/pending/conflict，不能 silently newest-wins。

### ADR-004 — No profiles table in V1

- **Decision:** 只使用 Auth user ID/email。
- **Reason:** 前端沒有 profile domain。
- **Consequence:** 未來真的新增 display name/avatar 時另做 migration。

### ADR-005 — No save slots in V1

- **Decision:** 每位 user 0..1 row。
- **Reason:** 現有 UI 與 local save 都是 singleton。
- **Consequence:** 多 slot 是未來跨 UI/schema 的功能，不預留假功能。

### ADR-006 — Keep gameplay/static content in frontend

- **Decision:** Scene/dialogue/items/puzzles/maps/assets/config 不進 DB。
- **Reason:** 它們是版本化遊戲內容，不是 user-owned runtime data。
- **Consequence:** 內容更新仍透過 code review/deploy，不建 CMS。

### ADR-007 — Use RLS ownership, never client-only authorization

- **Decision:** anon no grants；四種 member operations 各自有 owner policy。
- **Reason:** 所有 browser code 與 publishable key 均可被檢視/修改。
- **Consequence:** 每次 schema 變更必須同 migration 更新 grants、RLS 與 deny/allow tests。

### ADR-008 — Preserve checkpoint semantics

- **Decision:** Cloud save 接收既有場景入口 checkpoint，不改成每次互動 live save。
- **Reason:** 現行 death/retry flow 依賴入口 rollback。
- **Consequence:** `endingId` 不等於 ending history；若未來需要需另立產品需求。

### ADR-009 — Establish one ESM backend boundary

- **Decision:** 新 Supabase 層使用 ESM，透過 bootstrap/window hooks 與既有 classic scripts 整合。
- **Reason:** 避免一次重寫 12 個 gameplay modules。
- **Consequence:** Toolchain stabilization 是實作前置 gate。

## 31. File Change Plan

### 預計新增（後續 Phase，現在尚未建立）

| File | Purpose |
|---|---|
| `js/lib/supabase-client.js` | 單例 client / env validation |
| `js/services/auth-service.js` | Auth operations |
| `js/services/game-save-service.js` | Cloud row CRUD/revision |
| `js/services/save-coordinator.js` | Guest/member/pending/conflict orchestration |
| `js/models/game-save.js` | Codec/version/migration/hydration helpers |
| `js/backend-bootstrap.js` | Auth/session startup + existing hooks |
| `.env.example` | Public configuration names only |
| `supabase/migrations/<timestamp>_game_saves.sql` | Table/grants/RLS/triggers（Phase 4 才建立） |
| `supabase/tests/game_saves_rls.test.sql` | Allow/deny isolation tests |
| 對應 JS tests | Codec/service/coordinator tests |

### 預計最小修改

| Existing file | 修改原因 | UI impact |
|---|---|---|
| `index.html` | 載入 backend bootstrap module；必要的 auth/reset/error nodes | 小；沿用既有視覺 |
| `js/login-gate.js` | 將現有 hooks 接成 loading/error/confirmation/logout/recovery flow | 行為補全，不重做 layout |
| `js/main-menu.js` | Continue summary 改為 async active-source；同步狀態 | 文字/disabled state |
| `js/checkpoint.js` | 保留 public functions，內部委派 codec/coordinator | 不改遊戲呼叫點 |
| `js/puzzle.js` | 初始化等待 auth source；new-game lifecycle | 不改 game loop/謎題 |
| `package.json` | 穩定 build/test/module scripts，之後加入 Supabase client | 無視覺影響 |
| `.gitignore` | 忽略 local env / generated output | 無視覺影響 |

### 原則上不修改

- `js/scene.js`、`js/player.js`、`js/interaction.js`、`js/judgement.js`、`js/tomb.js` 的故事、場景、互動與 puzzle 邏輯。
- 既有 CSS、images、audio、fonts。
- Canvas rendering 與 responsive layout。

只有 codec allowlist 或 restore bug 證明需要時才對上述檔案做極小修改，且需先在 Phase 報告原因。

## 32. Backend Implementation Roadmap

每個 Phase 開始前仍需依團隊規則報告目標、功能、預計新增/修改檔案、前端影響、完成條件與驗證方法；完成後報告實際修改與測試，不因本 Roadmap 自動取得執行授權。

| Phase | 內容 | Exit gate |
|---:|---|---|
| 0 | Frontend Deep Audit | `PROJECT_AUDIT.md` 已完成 |
| 1 | Backend Architecture Planning | 本文件；使用者確認後才能前進 |
| 2 | Detailed Schema & Save Contract | GameSave fixtures、column/constraint/policy/migration 設計鎖定；仍可只規劃 |
| 3 | Repository / Toolchain Baseline | 正確 Git root；native tests、dev server、production build 可重現 |
| 4 | Supabase Environment & Migration | Dev project/local stack、migration、table、grants、RLS、triggers |
| 5 | Database / RLS Tests | anon/owner/other-user CRUD isolation 全部通過 |
| 6 | Authentication Service | signup/login/logout/restore/confirm/reset integration tests |
| 7 | Versioned Save Codec & Guest Store | old/local/corrupt/future fixtures；既有 checkpoint regression passes |
| 8 | Cloud Save Service | insert/load/update/delete、revision conflict、network failure tests |
| 9 | Frontend Integration | Auth gate、menu、checkpoint hooks；保護原 UI |
| 10 | Migration / Error UX | guest import、pending/retry/conflict/empty/loading states |
| 11 | Security & Integration Audit | RLS、key exposure、user isolation、test-mode guard、session refresh |
| 12 | Production Build & Deployment | env、redirect URLs、SMTP、HTTPS、build artifact、deployment smoke test |
| 13 | Final Full-system Test | 真實註冊→驗證→登入→三 checkpoint→refresh→logout/login→isolation→reset flow |

建議 commit boundary 與 Phase 對齊；每個 Phase 先跑範圍內測試，最後才做 full-system regression。

## 33. Risks

| Risk | Likelihood / Impact | Mitigation |
|---|---|---|
| 目前不是 Git repo，可能是匯出副本 | 高 / 高 | 先找 origin/branch/hash，再改 code |
| Build/ESM/CJS 已損壞 | 高 / 高 | Supabase 前先建立穩定 module boundary 與 native test/build baseline |
| Auth init 與 main menu race | 高 / 中 | Continue 等待 mode/source 決定後再 enable |
| Corrupt/old cloud JSON 破壞 runtime | 中 / 高 | Pure codec、fixtures、不可直接 Object.assign |
| Multi-device overwrite | 中 / 中 | Server revision + conditional update + explicit conflict UI |
| Network save 靜默失敗 | 中 / 高 | Pending cache、visible status、manual retry |
| Guest save 覆蓋 member cloud | 中 / 高 | 只在 cloud empty 時提供匯入；永不自動覆蓋 |
| Animation timestamps 跨裝置失真 | 高 / 低 | Hydrate normalize/ignore page-relative values |
| `gold_mask` / `golden_mask` ID 不一致 | 已存在 / 中 | Phase 2 建 allowlist 與 backward-compatible canonicalization tests |
| Email confirmation/reset redirect 錯誤 | 中 / 高 | local/preview/prod redirect matrix + end-to-end email test |
| Supabase default mail 限制 | 高於 demo規模 / 中 | Production custom SMTP；測試不依賴 production users |
| Publishable key 被誤當 secret | 常見 / 中 | 文件化 key model；安全依賴 grants/RLS；secret 永不進 browser |
| RLS policy 存在但 grants 過寬 | 中 / 高 | 同 migration revoke/grant + pgTAP tests |
| Development `?test=1` 汙染 cloud | 中 / 中 | Production save guard、部署移除/禁用 dev controls |
| Cloud row保留舊 checkpoint，結局不記錄 | 必然 / 低 | 明示 checkpoint 語意；需要 ending history 時另立 feature |
| Cache 留在共用裝置 | 低至中 / 低 | user-scoped key、不跨 user hydrate；未來可提供「登出並清除此裝置資料」 |

## 34. Open Questions

以下問題在完整搜尋 Repository、audit、source、package/test/build 與目前可取得文件後仍無法由程式碼判斷，必須由專案擁有者或部署環境回答：

1. **原始 Git Repository 在哪裡？** 目前目錄沒有 `.git`，無法確認 remote、正確 branch、baseline commit，以及此匯出副本是否包含隊友所有未提交修改。
2. **Production 與 Preview 要部署到哪個 hostname/platform？** 這會決定 Vite build adapter、環境變數設定、Supabase Site URL、email confirmation 與 password reset redirect allowlist。
3. **正式寄信服務使用哪個 SMTP provider/domain？** Repository 沒有郵件網域、寄件者或 DNS 設定；若只做短期課堂 demo，可暫用 Supabase 試用寄信限制，但不能視為 production-ready。
4. **會員多裝置 conflict UI 的產品文案與破壞性覆蓋確認方式為何？** 架構已決定不自動 newest-wins，但現有前端沒有 conflict modal；實作前需由 UI owner 確認是在既有 overlay 內擴充，還是採簡化的「載入雲端／稍後重試」。

除以上四項外，第一版 Backend scope、資料模型、Guest/Member 策略、single save、profiles、RLS 與 service boundaries 已可由 Repository 證據做出決策，不列為 unknown。

---

## Official Reference Baseline

本規劃於 2026-09-03 重新核對 Supabase [Changelog](https://supabase.com/changelog) 與以下官方文件；正式實作各 Phase 前仍需再次確認版本與 CLI/SDK 行為：

- [Password-based Auth](https://supabase.com/docs/guides/auth/passwords)
- [User Sessions](https://supabase.com/docs/guides/auth/sessions)
- [JavaScript Auth State Changes](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [API Keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [JavaScript Upsert](https://supabase.com/docs/reference/javascript/upsert)

**停止點：** Phase 1 僅完成架構規劃。未建立 Supabase Project、Database、Table、SQL、Migration、Auth、API、Package、Deployment，也未修改前端或遊戲程式。等待使用者確認後才可進入下一階段。
