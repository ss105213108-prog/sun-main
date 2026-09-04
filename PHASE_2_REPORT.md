# Phase 2 Report｜專案穩定化 + Supabase + Database

報告日期：2026-09-03  
專案：`heart-of-the-sun`  
Phase 狀態：**Phase 2 Complete — 本機基礎、正式 remote migration、RLS、environment 與 regression gates 全部通過**

本階段嚴格停在 Project Stabilization、Supabase client foundation、`game_saves` remote migration 與 RLS behavior verification。沒有實作正式 Authentication、Guest/Member 切換、cloud save/load、checkpoint 串接、inventory/scene/puzzle 改寫或 deployment。

## 1. Git / Repository Status

- 工作目錄：`C:\Users\user\Desktop\sun-main`
- 此目錄沒有 `.git`，因此不是可執行 `git status`、建立 branch 或 commit 的 Git checkout。
- Repository 內也找不到可證明來源的 GitHub/GitLab remote URL；不能安全地替團隊猜測 remote，也沒有執行 `git init`。
- 修改前已建立可回復基線：`.phase2-baseline/before-phase2-source.zip`。
- 基線壓縮檔 SHA-256：`E2CDBA448FC8A5BA91ED59FEF67E9457262DA28ED69584A2F5B857FB5B4DF442`。
- `.phase2-baseline/` 已加入 `.gitignore`，不應被日後的 Repository 納入。
- 與基線逐檔比對：`.gitignore`、`package.json`、`pnpm-lock.yaml`、`start.js` 有預期變更；`index.html` 的 SHA-256 與修改前完全相同，沒有留下 UI 或 runtime 變更。

目前無法完成「每個 Phase 一個 commit」的唯一原因是缺少 Git metadata。後續若取得正式 clone，應把本階段變更整理為一個獨立 commit，例如 `feat: stabilize build and add supabase database foundation`。

## 2. Build / ESM / CJS Root Cause

原始狀態同時存在三個彼此衝突的模組假設：

1. `package.json` 宣告 `"type": "module"`。
2. `start.js` 與 16 個既有測試使用 CommonJS `require(...)`。
3. `build` script 執行 `tsc && vite build`，但專案沒有 TypeScript source project，也沒有可支撐此 build flow 的 `tsconfig.json`。

直接結果：

- 16 個既有測試全部在載入階段因 `require is not defined in ES module scope` 失敗。
- `node start.js` 因相同 ESM/CJS 衝突失敗。
- build command 不符合這個 Vanilla HTML/CSS/classic JavaScript 專案的實際架構。

這不是遊戲邏輯故障，而是 package-level module boundary 與啟動/測試檔案格式不一致。

## 3. Build Fixes

- 保留 package-level ESM，將 `start.js` 轉為 Node ESM import。
- 新增 `tests/package.json`，只在 `tests/` boundary 宣告 `"type": "commonjs"`；16 個既有測試不需大量重寫。
- `build` 改為 `vite build`，移除不成立的 `tsc` 前置步驟。
- 新增 `vite.config.js`：
  - 保留 12 個既有 classic scripts，不把整個遊戲 runtime 強制改造成 ESM。
  - production build 將 12 個 scripts 複製至 `dist/js/`；數量不等於 12 時 build 直接失敗。
  - 遞迴複製 114 個 browser-safe image assets。
  - 排除 `raw_references/` 與 `.aep`、`.psd`、`.zip`、`.mov` 等 source artifacts。
  - 將 Supabase client 建成獨立 ESM bundle，但本階段不載入遊戲頁面。
- `start.js` 額外加入安全 URL parsing、project-root path boundary，以及供 smoke test 使用的 `NO_OPEN=1`。
- scripts 現為：`start`、`dev`、`test`、`build`、`preview`。
- `packageManager` 固定為 `pnpm@11.19.0`，Node engine 為 `>=22`；實測 Node 為 `v24.18.0`。

Build 仍會提示 12 個 classic scripts 沒有 `type="module"`、因此不由 Vite bundle。這是刻意保留隊友現有 runtime 的結果；plugin 會將它們原樣複製，且 artifact integrity test 已確認全部存在，不是 build failure。

## 4. Supabase Environment Setup

已安裝並固定：

| Package / Tool | Version | Scope |
|---|---:|---|
| `@supabase/supabase-js` | `2.114.0` | browser client dependency |
| Supabase CLI (`supabase`) | `2.116.0` | dev dependency |
| Vite | `5.4.21` | existing build tool |
| pnpm | `11.19.0` | declared package manager |

環境檔案狀態：

- 新增 `.env.example`，只定義 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_PUBLISHABLE_KEY` 的 placeholder。
- `.env.local` 已建立，只含 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_PUBLISHABLE_KEY` 的真實 browser-visible 值；此檔被 `.gitignore` 排除。
- `.env`、`.env.production`、`.env.development` 仍不存在。
- `.gitignore` 忽略 `.env` 與 `.env.*`，但明確保留可提交的 `.env.example`。
- Browser 只允許 publishable/anon 等級的公開 key；secret/service-role/database password 不可進入 browser、bundle 或 Repository。這與 [Supabase API Keys 官方指引](https://supabase.com/docs/guides/getting-started/api-keys)一致。

Supabase CLI 已建立 `supabase/config.toml`，其 Phase 2 相關設定包括：

- `api.auto_expose_new_tables = false`
- local seed、Realtime、Storage、Edge Runtime、Analytics 關閉
- local Auth 保留啟用，但 anonymous sign-in 關閉
- local site URL 指向 `http://127.0.0.1:5173`
- redirect allowlist 只含 localhost / 127.0.0.1 的 5173 與 8080 開發位址

Project identity 尚未確認時的歷史清單如下；正式 target 與最終狀態以第 16、17 節為準：

| Project | Ref | Current status | 判斷 |
|---|---|---|---|
| `ss105213108supabase` | `czpvcbelvqatyakmvwey` | INACTIVE | 名稱無法證明屬於本遊戲，不可自行套 migration |
| `LifeQuest` | `jwpbwlrdzmfzjlbrktlc` | ACTIVE | schema 明顯屬於另一個 Life RPG 專案，已排除 |

該歷史階段沒有建立或修改任何 project。之後已由使用者指定並驗證既有 `FIGMA2026 / sun-main / ujjvdmrenirjxusbtulx`；`LifeQuest` 與 `ss105213108supabase` 全程不是 linked target。

## 5. Supabase Client

唯一 client foundation 位於 `js/lib/supabase-client.js`：

- `resolveSupabaseConfig()`：驗證 URL 與 publishable key。
- `createBrowserSupabaseClient()`：建立 browser-safe client。
- `getSupabaseClient()`：lazy singleton，避免多 client instance。
- 明確拒絕 `sb_secret_...` key。
- Auth client options 預設開啟 session persistence、token refresh 與 URL session detection；這只是 client configuration，沒有登入/註冊流程。
- 錯誤只回傳固定 configuration error，不會把 key 印到 error message。

本階段刻意沒有在 `index.html` 載入此 module，也沒有任何 runtime `.auth.*` 或 `.from('game_saves')` 呼叫。這可確保 Phase 2 不會提前變更現有 Guest/UI/gameplay 行為；Phase 3 確認後再由 service/auth boundary 引入。

## 6. Database Schema

候選並已寫入 migration 的唯一 application table 為 `public.game_saves`：

| Column | Type | Rules / Purpose |
|---|---|---|
| `id` | `uuid` | Primary key，預設 `gen_random_uuid()` |
| `user_id` | `uuid` | NOT NULL、UNIQUE、FK → `auth.users(id)`、`ON DELETE CASCADE` |
| `save_data` | `jsonb` | NOT NULL；版本化 GameSave payload |
| `save_version` | `smallint` | NOT NULL、default 1、必須 >= 1 |
| `current_scene` | `text` | NOT NULL；限三個目前存在的 scene ID |
| `revision` | `bigint` | NOT NULL、default 1；由 DB trigger 維護的 optimistic concurrency token |
| `created_at` | `timestamptz` | NOT NULL、DB default |
| `updated_at` | `timestamptz` | NOT NULL、DB default；update 時由 DB trigger 更新 |

一人一份存檔由 `UNIQUE (user_id)` 強制保證。這個 unique index 同時支援 FK cascade、owner lookup 與 RLS policy 的 `user_id` 存取路徑，符合 [Supabase RLS performance 建議](https://supabase.com/docs/guides/database/postgres/row-level-security#rls-performance-recommendations)。

`save_data` 的 DB-level guard：

- 必須是 JSON object。
- serialized size 不得超過 64 KiB。
- payload 必須含 numeric `version`，且等於 `save_version`。
- payload 必須含 string `sceneId`，且等於 `current_scene`。

Phase 1 architecture 曾以 `user_id` 直接作 PK；本 Phase 的最新明確需求要求 schema 至少包含 `id`，因此採用 `id` PK + `user_id` UNIQUE。沒有另外發明 save slots 或其他 domain tables。

## 7. Migration

Migration：`supabase/migrations/20260903032810_create_game_saves.sql`

包含：

- `game_saves` table 與所有 constraints。
- `auth.users` cascade foreign key。
- `set_game_saves_server_metadata()` trigger function。
- update 時由 DB 強制增加 `revision` 並重設 `updated_at`。
- table grants、RLS enable 與四個 operation-specific policies。

Migration 已通過 5 個 executable Node contract tests，並已正式套用至 exact linked project `ujjvdmrenirjxusbtulx`。Remote migration history 現在只有 `20260903032810_create_game_saves`；遠端 catalog 已實查 table、8 欄、PK、FK cascade、UNIQUE、JSONB/check constraints、indexes、trigger、function、grants、RLS 與四個 policies。

本機 `supabase test db --local` 與 CLI `test db --linked` 仍因主機沒有 Docker runner 而不可用；這個 runner 限制沒有被誤認為 Database failure。等價的正式測試改以 CLI 2.116.0 `db query --linked --file` 透過 Management API 執行同一份 transaction-wrapped pgTAP，43/43 通過並 rollback。

## 8. RLS Policies

`public.game_saves` 已在 migration 中 `ENABLE ROW LEVEL SECURITY`。設計採 database-enforced owner isolation，參考 [Supabase Row Level Security 官方文件](https://supabase.com/docs/guides/database/postgres/row-level-security)。

| Policy | Role | Operation | Rule |
|---|---|---|---|
| `game_saves_select_own` | `authenticated` | SELECT | `(select auth.uid()) = user_id` |
| `game_saves_insert_own` | `authenticated` | INSERT | `WITH CHECK (auth.uid() = user_id)` |
| `game_saves_update_own` | `authenticated` | UPDATE | owner `USING` + owner `WITH CHECK` |
| `game_saves_delete_own` | `authenticated` | DELETE | `(select auth.uid()) = user_id` |

權限最小化：

- `anon` 沒有 `game_saves` table privilege。
- `authenticated` 可 SELECT/DELETE。
- INSERT 只可寫 `user_id`、`save_data`、`save_version`、`current_scene`。
- UPDATE 只可寫 `save_data`、`save_version`、`current_scene`。
- client 不可寫 `id`、`revision`、`created_at`、`updated_at`，也不可改 `user_id`。
- trigger function 的 EXECUTE 已從 `public`、`anon`、`authenticated` 撤銷。
- RLS 內使用 `(select auth.uid())`，避免每一列重複求值。

`supabase/tests/game_saves_rls.test.sql` 已擴充為 43 項 pgTAP assertions，涵蓋 anon denial、User A/B 各自 CRUD、雙向 cross-user isolation、雙向 forged owner denial、one-save unique、column/table/function grants、revision/updated_at metadata 與 user-delete cascade。已在 `sun-main` hosted PostgreSQL 實際執行並全部通過；測試最後 rollback，固定測試 users 與 rows 均確認為 0。

## 9. Security Checks

| Check | Result | Evidence |
|---|---|---|
| 真實 browser env 安全邊界 | PASS | `.env.local` 僅兩個 public client 變數且被 ignore；`.env.example` 仍只有 placeholder |
| `.env*` ignore boundary | PASS | `.gitignore` 已設定；`.env.example` 例外保留 |
| secret/service-role key 不進 browser | PASS | client 主動拒絕 `sb_secret_`；無 service-role variable |
| production bundle credential scan | PASS | bundle 只含核准 project URL 與 publishable key；無 secret key、JWT 或 credential-bearing Postgres URL |
| Repository secret token review | PASS | 命中只來自防護程式、刻意失敗的 test fixture、placeholder 與文件，沒有真實 credential |
| anonymous table access | PASS（migration contract） | explicit revoke；沒有 anon grant |
| authenticated least privilege | PASS（migration contract） | column-level INSERT/UPDATE grants |
| user isolation design | PASS（SQL authored） | 四個 owner-only RLS policies |
| user isolation on real DB | PASS | hosted PostgreSQL transaction test 43/43；A/B self CRUD、雙向 denial、forged owner denial |
| destructive cascade scope | PASS（design） | 僅 `auth.users` → 該使用者唯一 `game_saves` row |
| Supabase advisors | PASS | security 0 findings；performance 0 findings |

沒有取得或使用 secret key、service-role key、database password、admin API、Security Definer bypass 或前端權限判斷取代 RLS。真實 anonymous browser-client SELECT 以 publishable key 連線後得到 PostgreSQL `42501` / HTTP 401，證明 anon 沒有 table access。

## 10. Files Added

Source / configuration：

- `.env.example`
- `vite.config.js`
- `pnpm-workspace.yaml`
- `js/lib/supabase-client.js`
- `tests/package.json`
- `tests/supabase-client.test.mjs`
- `tests/migration-contract.test.js`
- `supabase/config.toml`
- `supabase/migrations/20260903032810_create_game_saves.sql`
- `supabase/tests/game_saves_rls.test.sql`
- `PHASE_2_REPORT.md`

Local/generated artifacts：

- `.env.local`（ignored；exact `sun-main` URL + modern publishable key）
- `.phase2-baseline/before-phase2-source.zip`（ignored、可回復基線）
- `node_modules/`（ignored）
- `dist/`（ignored）
- `supabase/.temp/`（ignored CLI metadata）

## 11. Files Modified

- `.gitignore`
  - 忽略 dependencies、build output、Supabase temp/branches、baseline backup 與 real env files。
- `package.json`
  - 修正 scripts/module-compatible workflow，固定 Supabase dependencies、package manager 與 Node engine。
- `pnpm-lock.yaml`
  - 記錄實際安裝的 dependency graph。
- `start.js`
  - CommonJS → ESM；安全 path boundary；`NO_OPEN` smoke-test mode。
- `supabase/tests/game_saves_rls.test.sql`
  - 25 → 43 assertions；補齊 User B 自身 CRUD、雙向 cross-user denial、grants 與 metadata runtime coverage，並修正 PostgreSQL data-modifying CTE 測試語法。
- `PHASE_2_REPORT.md`
  - 記錄 link、dry-run、formal push、remote catalog、RLS、environment 與 regression evidence。

明確未修改：

- `index.html`（與基線 SHA-256 相同）
- 12 個既有 `js/*.js` gameplay/runtime scripts
- `assets/`
- `style.css`
- `PROJECT_AUDIT.md`
- `BACKEND_ARCHITECTURE.md`

因此 checkpoint、inventory、scene、puzzle、localStorage 與 UI 沒有被 Phase 2 改寫。

## 12. Tests Executed

1. Baseline `node --check` 與 `node --test`。
2. Final `npm test`（Node built-in test runner）。
3. Final `node --check` source sweep。
4. `npm run build` production build。
5. `npm run dev` localhost smoke test。
6. `NO_OPEN=1 node start.js` source-server smoke test。
7. `npm run preview -- --port 4175 --strictPort` production preview。
8. HTTP checks：首頁、Canvas marker、classic script、runtime PNG、Supabase bundle。
9. Production artifact integrity：classic scripts、browser assets、forbidden source formats、client bundle count。
10. Source 與 `dist` credential-shaped value scan。
11. Supabase CLI version/help/init/migration workflow checks。
12. `supabase test db --local supabase/tests/game_saves_rls.test.sql`（預期進行真 DB/RLS 測試，但環境阻擋）。
13. Exact-ref guarded `supabase db push --linked --skip-vault`。
14. Remote catalog：migration history、table/columns、constraints、indexes、trigger/function、grants、RLS/policies。
15. `supabase db query --linked --file supabase/tests/game_saves_rls.test.sql`：hosted PostgreSQL pgTAP。
16. Separate-request metadata lifecycle：authenticated INSERT → UPDATE → Auth-user cleanup/cascade。
17. Real publishable browser-client anonymous Data API denial。
18. Supabase security/performance advisors。
19. Final `npm.cmd test`、`npm.cmd run build`、production preview HTTP smoke 與 credential scan。

## 13. Test Results

| Test | Result | Detail |
|---|---|---|
| Baseline tests | FAIL, root cause identified | 16/16 因 package-level ESM 與 CommonJS test boundary 衝突，非 gameplay assertion failure |
| Final `npm test` | PASS | 25 passed、0 failed |
| Existing game regressions | PASS | 原 16 個 test files 全數通過 |
| Supabase client tests | PASS | config normalize、missing config、secret rejection、client creation 共 4 項 |
| Migration contract tests | PASS | schema、metadata trigger、RLS、anon grant、credential boundary 共 5 項 |
| Source syntax | PASS | 32 個 source `.js`，0 syntax failure |
| Production build | PASS | Vite 5.4.21；46 modules transformed |
| Classic runtime artifact | PASS | 12/12 scripts，0 missing |
| Browser image artifacts | PASS | 114/114 assets，0 missing |
| Forbidden source artifacts | PASS | `dist` 內 `.aep/.psd/.zip/.mov` = 0 |
| Supabase bundle | PASS | 1 bundle，222,368 bytes（gzip 58.30 kB）；含 exact URL 與 modern publishable key |
| Production preview HTTP | PASS | HTML、Canvas marker、classic script、runtime PNG、Supabase bundle 均 HTTP 200 |
| Source server HTTP | PASS | `/` 與 `/js/puzzle.js` HTTP 200，Canvas marker 存在 |
| Dist/source secret scan | PASS | 無 secret key、JWT 或 credential-bearing Postgres URL；真 publishable key只在 ignored env與預期 bundle |
| Local/CLI pgTAP runner | ENVIRONMENT LIMITATION | Docker/local Postgres 不存在；`test db --linked` runner 也要求 Docker，未執行 tests |
| Remote migration | PASS | migration history 只有 `20260903032810_create_game_saves` |
| Remote schema contract | PASS | `game_saves`、8 欄、PK、FK cascade、UNIQUE、JSONB/checks、trigger/function |
| Remote RLS behavior | PASS | 43/43 hosted PostgreSQL assertions；transaction rollback後 0 test users / 0 rows |
| Separate-request metadata | PASS | revision 2、scene updated、`updated_at > created_at`、cleanup/cascade 0 residual rows |
| Anonymous browser client | PASS | publishable client連線成功；SELECT 得 `42501` / HTTP 401 |
| Supabase advisors | PASS | security 0 findings；performance 0 findings |

`dist` 目前總大小為 172,403,058 bytes。這不是 Phase 2 correctness failure，但會是 deployment 前應評估的資產體積風險。

補充：Codex managed sandbox 無法直接讀取由 host-context pnpm 建立的部分 junction/ACL；相同 `npm test` 在實際 host user context 完整通過 25/25。這是測試沙箱權限差異，不是 Repository dependency 缺檔。

## 14. Remaining Risks

1. **沒有 Git metadata**：無法產出 branch、diff、commit 或 remote-backed rollback；目前只有本機 baseline zip。
2. **Classic-script build warning**：現有 runtime 被刻意保留；未來若隊友增減 root `js/*.js`，12-file invariant 會要求同步審查 build config。
3. **Scene constraint 需 migration 演進**：若遊戲新增 scene ID，`current_scene` check constraint 必須同步更新。
4. **Nested save validation 尚未實作**：DB 只檢查 JSON object、size、version 與 scene；完整 GameSave codec 屬後續 service layer。
5. **Production assets 偏大**：`dist` 約 172.4 MB，部署前應確認 hosting limits、cache 與載入效能。
6. **正式 Auth 與 cloud persistence 尚未實作**：RLS test principals 是 transaction 內的 `auth.users` rows + JWT claim simulation，並非可登入的產品帳號；Phase 3 才處理註冊、登入、session 與 password flow。
7. **CLI pgTAP runner 需 Docker**：本輪已用同版本 CLI 的 Management API query執行同一測試契約；未來 CI仍應在有 Docker/Postgres runner 的 Git checkout 重跑標準 `supabase test db`。

## 15. Ready for Phase 3？

**目前：Yes — Phase 2 Complete。**

Link、exact Project Ref、dry-run、正式 migration、remote schema、RLS/policies、A/B isolation、browser env、secret scan、既有 tests、production build、HTTP smoke 與 advisors 全部通過。依使用者 stop rule，本報告完成後不自動開始 Phase 3 Authentication 或 Phase 4 Cloud Save，等待下一次明確確認。

## 16. Remote Link + Migration Dry Run｜2026-09-03（Historical Pre-Apply Gate）

> 本節保留正式 apply 前的 dry-run 時點證據；其 `NOT RUN` / mutation 0 狀態已由使用者後續明確批准取代。正式結果見第 17 節。

### Gate Status

**DRY RUN COMPLETE — 已完成指定 project link 與 migration preview；等待正式 remote migration 核准。**

本次唯一允許且實際 linked 的目標為：

```text
Organization: FIGMA2026
Canonical Organization Name: figma2026
Organization ID: hvqcqjoryimlwvlecgkk
Project: sun-main
Project Ref: ujjvdmrenirjxusbtulx
Project URL: https://ujjvdmrenirjxusbtulx.supabase.co
Project Status: ACTIVE_HEALTHY
Region: ap-southeast-1
```

Supabase Dashboard 的 canonical organization name 為小寫 `figma2026`；Organization ID、Project Name、Project Ref、Project URL、region 與 status 均與核准目標一致。`LifeQuest`、`ss105213108supabase` 與 `ss105213108-prog's Project` 均顯示 `linked=false`，未被操作。

### Link Result

執行指令：

```powershell
.\node_modules\.bin\supabase.CMD link --project-ref ujjvdmrenirjxusbtulx --output-format text
```

結果：**Success**（exit code 0，CLI 回報 `Finished supabase link.`）。第一次執行因 CLI 尚未驗證而安全失敗；使用 Supabase 官方 CLI browser authentication 完成登入後重試成功。CLI credential 僅由 CLI 儲存在使用者設定中，沒有顯示於報告、寫入 Repository、`.env.example` 或任何 source file，也未要求 database password。

Link 後驗證：

| Evidence | Result |
|---|---|
| `supabase/.temp/project-ref` | `ujjvdmrenirjxusbtulx`（exact match） |
| Supabase CLI project list | `sun-main` / `ujjvdmrenirjxusbtulx` / org `hvqcqjoryimlwvlecgkk` / `ACTIVE_HEALTHY` / `linked=true` |
| 其他 projects | `linked=false`，未操作 |

### Migration Dry Run

執行前再次讀取 `supabase/.temp/project-ref`，只有在其 exact value 為 `ujjvdmrenirjxusbtulx` 時才允許 dry run。執行指令：

```powershell
.\node_modules\.bin\supabase.CMD db push --dry-run --linked --skip-vault --output-format text
```

使用 `--skip-vault` 明確排除 Vault secret 更新。結果：**Success**（exit code 0）。CLI 明確輸出 `DRY RUN: migrations will *not* be pushed to the database.`，並只列出下列一個待套用 migration：

| Migration filename | Timestamp | Source directory | Purpose |
|---|---|---|---|
| `20260903032810_create_game_saves.sql` | `20260903032810` | `C:\Users\user\Desktop\sun-main\supabase\migrations` | 建立單一使用者存檔 table、server metadata trigger、grants 與 owner-only RLS policies |

Migration directory 只有此一 SQL migration；沒有混入其他 Repository 的 migration。

### Planned Schema Changes

Dry run 預計建立或設定：

- `public.game_saves` table。
- `id uuid` primary key，default `gen_random_uuid()`。
- `user_id uuid not null unique`，foreign key 指向 `auth.users(id)`，`on delete cascade`。
- `save_data jsonb not null`。
- `save_version smallint not null default 1`。
- `current_scene text not null`。
- `revision bigint not null default 1`。
- `created_at timestamptz not null` 與 `updated_at timestamptz not null`，default `statement_timestamp()`。
- Save version、scene allowlist、JSON object/size、payload metadata consistency 與 revision 的 check constraints。
- `public.set_game_saves_server_metadata()` trigger function 與更新 trigger，用於 server-side revision/`updated_at` 維護。

`current_scene` 與 `revision` 是核准 migration 對 save payload 一致性及 optimistic concurrency 的必要 metadata；它們不是額外 domain table。

### Planned RLS Changes

- 對 `public.game_saves` 啟用 Row Level Security。
- SELECT policy：只有 `(select auth.uid()) = user_id` 可讀取自己的 row。
- INSERT policy：`with check` 限制只能建立自己的 row。
- UPDATE policy：`using` 與 `with check` 都限制為 row owner。
- DELETE policy：只有 row owner 可刪除。

以上均為 **planned / not yet applied**；實際 user A / user B isolation 必須等正式 migration 後測試。

### Planned Grants

- 對 `anon`、`authenticated` 先 revoke table all privileges。
- `authenticated` 只取得 SELECT。
- `authenticated` INSERT 只允許 `user_id`、`save_data`、`save_version`、`current_scene`。
- `authenticated` UPDATE 只允許 `save_data`、`save_version`、`current_scene`。
- `authenticated` 取得 DELETE，仍受 owner-only RLS 限制。
- Trigger function 的 EXECUTE 對 `public`、`anon`、`authenticated` revoke。

### Scope / Suspicious Schema Check

沒有待建立 `profiles`、`inventory`、`puzzles`、`scenes`、`dialogues`、`achievements`、`save_slots`、`admin`、`leaderboards`、`statistics` 或任何其他 domain table。Migration 內搜尋到這些名稱的地方僅是「刻意不建立額外 schema」的註解，不是 DDL。

### Remote Mutation Status at Dry-Run Time

```text
Remote Database Schema Mutation: 0
```

Dry run 後的 exact-project read-only verification：

| Remote check on `ujjvdmrenirjxusbtulx` | Result |
|---|---|
| Remote migration history | empty |
| Remote `public` tables | empty |
| Formal `db push` / migration apply | NOT RUN |
| Remote SQL | NOT RUN |
| Remote RLS/policy mutation | NOT RUN |
| Auth/key mutation | NOT RUN |

### Warnings / Risks

- Dry run 只確認待套用 migration 清單與連線目標，不代表 SQL 已在 hosted Postgres 實際執行成功。
- Schema、constraints、trigger、grants、RLS policies 與 owner-vs-other-user isolation 目前都還沒有 remote runtime evidence。
- CLI authentication token 存於使用者層級的 Supabase CLI 設定，不在 Repository；後續應依帳號安全政策管理或撤銷。
- 本次沒有建立 real `.env`、取得或寫入 publishable key，也沒有重做 application regression/build；app/runtime source 未變更，先前本機結果維持 `PREVIOUS LOCAL PASS`。

### Historical Safety Decision / Stop Point

依 dry-run 顯示的單一 migration、exact linked ref 與本機 SQL scope，**可以進入正式 `db push` 的人工核准點**；未發現額外或可疑 schema。但這不等於正式 migration 已驗證成功，仍須取得下一次明確批准後才可 push，並在 push 後執行 remote schema、RLS、grants 與 user isolation tests。

Supabase 官方 CLI 文件說明 `db push --dry-run` 只列出待套用 migrations、不正式套用；正式 `db push` 才會更新 remote migration history 並執行尚未套用的 migrations。參考 [Local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows)、[Supabase link CLI reference](https://supabase.com/docs/reference/cli/supabase-link) 與 [Supabase db push CLI reference](https://supabase.com/docs/reference/cli/supabase-db-push)。

本節當時依指示停在 dry run。使用者其後明確批准正式 Remote Database Gate；實際 apply 與完整驗證結果如下。

## 17. Formal Remote Migration + RLS Verification｜2026-09-03

### Remote Migration

```text
Target Organization: FIGMA2026
Canonical Organization: figma2026
Organization ID: hvqcqjoryimlwvlecgkk
Target Project: sun-main
Target Project Ref: ujjvdmrenirjxusbtulx
Status: ACTIVE_HEALTHY
Region: ap-southeast-1
```

正式操作前，PowerShell guard 再次確認 `supabase/.temp/project-ref` exact match，且 `supabase/migrations` 只有唯一核准檔名。執行：

```powershell
.\node_modules\.bin\supabase.CMD db push --linked --skip-vault --output-format text --yes
```

結果：**PASS**。CLI 只列出並成功套用：

```text
20260903032810_create_game_saves.sql
```

- Migration timestamp：`20260903032810`
- Remote history：`20260903032810 / create_game_saves`
- Local migration SHA-256：`DADB26D0513A3B549ADC03757C4D514B648C02DC746B752CE4EE6A4F0777A97E`
- `--skip-vault`：沒有更新 Vault secrets。
- `LifeQuest`、`ss105213108supabase` 與其他 project：沒有 link、push 或 SQL mutation。

### Remote Schema

Remote catalog 實查結果：

| Object / contract | Result |
|---|---|
| `public.game_saves` | PASS；唯一 application table，RLS enabled，測試後 rows = 0 |
| `id` | `uuid not null`；default `gen_random_uuid()`；Primary Key |
| `user_id` | `uuid not null`；UNIQUE；FK → `auth.users(id)`；`ON DELETE CASCADE` |
| `save_data` | `jsonb not null`；object、64 KiB、payload version/scene consistency checks |
| `save_version` | `smallint not null default 1`；`>= 1` |
| `current_scene` | `text not null`；三個核准 scene allowlist |
| `revision` | `bigint not null default 1`；`>= 1`；DB trigger increment |
| `created_at` / `updated_at` | `timestamptz not null default statement_timestamp()` |
| Indexes | `game_saves_pkey(id)`；`game_saves_user_id_key(user_id)` |
| Trigger | `set_game_saves_server_metadata`，BEFORE UPDATE，enabled |
| Function | `public.set_game_saves_server_metadata()`；security invoker、empty search path |

Public schema 沒有 `profiles`、`inventory`、`puzzles`、`scenes`、`dialogues`、`achievements`、`save_slots`、`admin`、`leaderboards`、`statistics` 或其他 application table。

### RLS / Policies / Grants

- `public.game_saves.relrowsecurity = true`。
- `game_saves_select_own`：authenticated SELECT，owner `USING`。
- `game_saves_insert_own`：authenticated INSERT，owner `WITH CHECK`。
- `game_saves_update_own`：authenticated UPDATE，owner `USING` + `WITH CHECK`。
- `game_saves_delete_own`：authenticated DELETE，owner `USING`。
- Ownership predicate 都是 `(select auth.uid()) = user_id` 的 PostgreSQL-normalized 等價形式。
- `anon` 的 SELECT / INSERT / UPDATE / DELETE 全部 false。
- `authenticated` table-level 只有 SELECT / DELETE；沒有 unrestricted table-level INSERT / UPDATE。
- `authenticated` INSERT columns：`user_id`、`save_data`、`save_version`、`current_scene`。
- `authenticated` UPDATE columns：`save_data`、`save_version`、`current_scene`。
- `id`、`user_id` update、`revision`、`created_at`、`updated_at` 都不能由 browser client 寫入。
- Metadata function 的 EXECUTE 對 `public`、`anon`、`authenticated` 都是 false。

### User Isolation

正式 RLS test file：`supabase/tests/game_saves_rls.test.sql`

- Assertions：43 planned / 43 executed / 43 passed。
- Test SHA-256：`36DB05D9759CE76AD27CC9109AE0DC36006D9D6C4CF6C5F3168DB6247F868B2A`。
- 測試 principal：transaction 內插入 User A / User B 至本 project 的 `auth.users`，再以 `authenticated` role + per-user JWT claims 呼叫實際 PostgreSQL RLS。
- User A：自身 INSERT / SELECT / UPDATE / DELETE 全部允許。
- User B：自身 INSERT / SELECT / UPDATE / DELETE 全部允許。
- A → B：SELECT 不可見；UPDATE / DELETE 0 rows；偽造 B `user_id` 得 `42501`。
- B → A：SELECT 不可見；UPDATE / DELETE 0 rows；偽造 A `user_id` 得 `42501`。
- 同 user 第二筆 save：UNIQUE violation，one user = one save成立。
- User deletion：FK cascade 清除 save。
- Test transaction 最後 `ROLLBACK`；事後實查 test Auth users = 0、test saves = 0、total saves = 0。

標準 `supabase test db --linked` 在此 Windows host仍要求 Docker，沒有真正開始測試。等價驗證改用 CLI 2.116.0 正式支援的 `db query --linked --file`，透過 Management API 在 hosted PostgreSQL 執行同一份 pgTAP SQL。第一次實跑也找出並修正原測試內不合法的 nested data-modifying CTE；沒有更動 migration、RLS 或 grants。

### Server Metadata Lifecycle

為避免單一 Management API batch 的 `statement_timestamp()` 固定語意遮蔽時間變化，另以兩個獨立 remote requests 實測：

1. User A authenticated INSERT：revision 1。
2. 下一個 request authenticated UPDATE：revision 2、scene updated、`updated_at > created_at`。
3. 刪除測試 Auth user：FK cascade 後 Auth user 0、save 0。

結果：**PASS**；無 persistent test data。

### Environment / Browser Key Safety

- `.env.local`：configured、ignored，只含兩個允許變數。
- `VITE_SUPABASE_URL`：exact `https://ujjvdmrenirjxusbtulx.supabase.co`。
- `VITE_SUPABASE_PUBLISHABLE_KEY`：唯一啟用的 modern `default` publishable key；值不寫入報告。
- `.env.example`：仍只有 placeholder，不含 real URL/key。
- Production bundle：包含 exact URL/publishable key，這是 browser key的預期行為。
- Real publishable key 在 source/docs/`.env.example` 的非允許位置：0。
- Secret key、service-role credential、JWT、database password、credential-bearing Postgres URL：0。
- 真實 anonymous browser-client query：連到正確 Data API；SELECT 被 PostgreSQL `42501` / HTTP 401 拒絕。

### Regression / Production

| Gate | Result |
|---|---|
| `npm.cmd test` | PASS；25/25、0 failed |
| Existing game regressions | PASS；16 個原有 test files |
| Supabase client tests | PASS；4/4 |
| Migration contract tests | PASS；5/5 |
| `npm.cmd run build` | PASS；Vite 5.4.21、46 modules transformed |
| Classic runtime | PASS；12 scripts |
| Supabase client bundle | PASS；1 bundle、222,368 bytes、gzip 58.30 kB |
| HTTP smoke | PASS；HTML/Canvas、classic JS、PNG、Supabase bundle 均 200 |
| Credential scan | PASS |
| Security Advisor | PASS；0 findings |
| Performance Advisor | PASS；0 findings |

Classic scripts 的 non-module warnings 仍是已核准的保留策略，不是 build failure；`index.html`、既有 gameplay/UI/CSS/assets 均未為 Backend integration 重寫。

### Phase 2 Completion Checklist

```text
Supabase link ✅
Project Ref ✅
Migration dry-run ✅
Migration formal apply ✅
game_saves / PK / FK / UNIQUE / JSONB ✅
Trigger / revision / updated_at ✅
RLS + four owner policies ✅
User A self access + User B self access ✅
A → B denied + B → A denied + forged IDs denied ✅
Publishable client config + anon denial ✅
No secret exposure ✅
Existing tests + build + HTTP smoke ✅
Security/performance advisors ✅
```

**Phase 2 Complete。** 本階段在此 STOP；不開始 Phase 3 Authentication 或 Phase 4 Cloud Save，等待使用者確認。
