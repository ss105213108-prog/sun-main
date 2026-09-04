# Phase 5A｜Final QA / Production Readiness Verification Report

> 執行時間：2026-09-04 14:59:09 +08:00  
> Phase：`5A — Final QA / Production Readiness Verification`  
> Phase 5A Status：`COMPLETE_WITH_RELEASE_BLOCKERS`  
> Product QA：`PASS`  
> Production Release：`NOT READY`  
> Ready for Phase 5B：`YES`  
> 唯一遠端目標：`FIGMA2026 / sun-main / ujjvdmrenirjxusbtulx`

---

## 1. Executive Result

Phase 5A 已完成核准範圍內的最終驗收。沒有新增產品功能、沒有重構或修改隊友 UI、沒有降低 RLS、沒有部署、沒有初始化 Git、沒有清理 A/B/C，也沒有修改三筆既有 `game_saves`。

核心產品驗證結果為 PASS：

- Full regression：`56 / 56 PASS`
- Auth negative targeted tests：`19 / 19 PASS`
- Cloud Save / Load negative targeted tests：`23 / 23 PASS`
- Production build：`PASS`
- Production preview smoke：`PASS`
- 真實不存在帳號登入：`PASS`，顯示通用錯誤且沒有建立 User
- 真實 anon `game_saves` read denial：`PASS`，HTTP `401`、Postgres code `42501`
- Browser-visible secret audit：`PASS`，未發現 secret/service-role/database credential
- Release artifact audit：`PASS`，未將 `.env.local`、`supabase/.temp`、SQL、測試或本機 metadata 打入 `dist`
- Supabase Performance Advisor：`PASS`，0 findings

目前仍不能正式發布，原因是 release infrastructure 與 production Auth 設定尚未決定／完成：

1. 工作目錄不是 Git repository，缺少 release provenance 與可驗證 rollback point。
2. Hosting provider、production URL 與 domain 尚未決定，也沒有 hosting config。
3. Supabase Auth `Site URL` 仍為 `http://localhost:3000`，Redirect URLs 為空。
4. Custom SMTP 未啟用；Supabase 內建 SMTP 不適合作為 production email service。
5. Leaked Password Protection 仍為 disabled，Security Advisor 保留 1 個 WARN。

上述項目是 Phase 5B 的明確工作範圍，因此目前可進入 Phase 5B，但不能把目前狀態標記為 production release-ready。

---

## 2. Scope And Safety Boundaries

本輪實際遵守：

- 所有 Supabase MCP／CLI／Dashboard 檢查皆鎖定 `ujjvdmrenirjxusbtulx`。
- `supabase/.temp/project-ref` 再次確認為 `ujjvdmrenirjxusbtulx`。
- 沒有操作 LifeQuest、ss105213108supabase 或其他 Project。
- 沒有執行 migration、DDL、`db push`、RLS 變更或 Auth 設定變更。
- 沒有使用 service-role key 進入 Browser。
- 沒有建立、刪除或修改 User A / B / C。
- 沒有建立、刪除或修改 A / B / C 的 `game_saves`。
- 沒有啟用 Leaked Password Protection。
- 沒有正式部署或初始化 Git。
- 唯一工作區產出變更為重新產生 `dist` 與新增本報告；產品 source/UI 未修改。

執行工具版本：

| Tool | Version |
| --- | --- |
| Node.js | `v24.18.0` |
| pnpm | `11.19.0` |
| Vite | `5.4.21` |
| Supabase CLI | `2.116.0` |

---

## 3. PASS

### 3.1 Remote Project Identity And Preservation

| Check | Result |
| --- | --- |
| Project | `sun-main` |
| Project Ref | `ujjvdmrenirjxusbtulx` |
| Organization ID | `hvqcqjoryimlwvlecgkk` |
| Region | `ap-southeast-1` |
| Status | `ACTIVE_HEALTHY` |
| Database | PostgreSQL `17.6.1.166` |
| Linked local metadata | `supabase/.temp/project-ref = ujjvdmrenirjxusbtulx` |

Phase 5A 前後都確認以下三個 User 存在且 Email confirmed：

- User A：`2e76c4ff-0ca8-41e0-b6cf-846411355bf2`
- User B：`980f0e9c-9aaa-48dc-b260-8436c4675493`
- User C：`0cf757b5-b039-4405-9c13-d55d038188e9`

Phase 5A 結束後資料仍為：

| User | current_scene | revision | save_version |
| --- | --- | ---: | ---: |
| A | `sun_temple` | 4 | 1 |
| B | `judgement_chamber` | 2 | 1 |
| C | `judgement_chamber` | 1 | 1 |

最終計數：expected test users `3`、expected save rows `3`。不存在帳號的 negative login 沒有建立 User，新增數為 `0`。

### 3.2 Full Regression

Command：`node --test`

| Metric | Result |
| --- | ---: |
| Tests | 56 |
| Pass | 56 |
| Fail | 0 |
| Skipped | 0 |
| Duration | 525.53 ms |

第一次在受限沙箱內執行時，Windows pnpm junction 被拒絕存取，造成 5 個測試檔在載入 `@supabase/supabase-js` 前失敗；這不是 assertion 或產品功能失敗。在核准的沙箱外使用同一份 source 與既有 dependencies 重跑後為 `56 / 56 PASS`。沒有安裝或更新 package。

### 3.3 Auth Negative Tests

Targeted result：`19 / 19 PASS`

覆蓋：

- 空欄位、Email 格式、弱密碼在 network 前阻擋。
- duplicate registration 使用不洩漏帳號存在性的通用回應。
- wrong password 與 unknown account 使用相同錯誤語意。
- unconfirmed Email 安全處理。
- Session restore、token refresh、logout、password reset、password update minimum。
- Network failure 轉換為安全 UI 結果，不洩漏輸入。
- Missing URL/key 與 browser secret key rejection。

Production preview 真實 Browser 補充驗證：

- invalid Email：顯示 `電子信箱格式不正確。`，未送出遠端登入。
- syntactically valid 但不存在的 Email：Supabase request 完成後顯示 `電子信箱或密碼不正確。`。
- Console error：`0`。
- Auth User mutation：`0`。
- 沒有使用 A/B/C credential。

### 3.4 Cloud Save / Load Negative Tests

Targeted result：`23 / 23 PASS`

覆蓋：

- Cloud read 強制依 authenticated user 過濾。
- 無 row 是 empty state，不是 login failure。
- First save 使用 session identity，不接受 caller 注入的 `user_id`。
- Update 同時要求 current user 與 expected revision。
- Zero-row conditional update 回 conflict 並保留最新 cloud record。
- Missing / expired identity 在 table query 前阻擋。
- Timeout 回傳可 retry 的 structured error。
- Unsupported/corrupt/oversized save 被 codec 拒絕。
- Existing cloud protection、guest import confirm、pending recovery、revision conflict no-overwrite。
- Member new game 不會先刪除既有 cloud row。

真實匿名 Data API negative test：

| Request | Result |
| --- | --- |
| anon `GET /rest/v1/game_saves` | HTTP `401` |
| Postgres error code | `42501` |
| Response body | 已遮罩，未寫入報告 |

### 3.5 RLS / Cross-user Isolation

Current remote metadata：

- `public.game_saves`：RLS enabled。
- Remote table row count：3。
- Policies：4，且只授權 `authenticated` owner。
  - `game_saves_select_own`
  - `game_saves_insert_own`
  - `game_saves_update_own`
  - `game_saves_delete_own`
- Owner predicate：`auth.uid() = user_id`。
- UPDATE 同時有 `USING` 與 `WITH CHECK`。
- anon SELECT / INSERT / UPDATE / DELETE privileges：全部 `false`。
- authenticated table-level SELECT / DELETE：`true`。
- authenticated unrestricted INSERT / UPDATE：`false`。
- authenticated 可寫入 gameplay columns，但不能 UPDATE `user_id`，也不能 INSERT/UPDATE `revision`、`created_at`、`updated_at`。
- FK 仍指向 `auth.users.id`，schema metadata 未改變。

Cross-user evidence：

1. Phase 4 的 User A / B 真實 Browser Cloud Save、Cloud Load、F5 Restore 與 application isolation 已為 `REAL_BROWSER_PASS`。
2. Phase 5A 重新確認 A/B/C 各自仍是一個不同 `user_id` 的 row，revision／scene 與 Phase 4 相同。
3. Phase 5A app-level tests 再驗證 user-filtered query、caller user-id rejection、revision conditional update 與 no-overwrite conflict handling。
4. Phase 5A 以 browser publishable key 做 anon read，遠端實際回 `401 / 42501`。

因此目前 deployed RLS / isolation control 評為 `PASS`。43 項 pgTAP 未在本輪重新執行成功，詳見 WARNING；不得把它誤記為 `43 / 43 PASS`。

### 3.6 Production Build

Command：`pnpm.cmd build`

- Exit code：`0`
- Vite transformed modules：52
- Build duration：729 ms
- `dist/index.html`：28,294 bytes
- 結果：`PASS`

Vite 對 12 支既有 classic scripts 顯示「沒有 `type=module`，不會由 Vite bundle」警告；`vite.config.js` 仍依專案既定策略把它們複製到 `dist/js`。Production preview 已逐一驗證首頁引用 27 個 local resources 均為 HTTP 200，代表本次沒有造成缺檔。

### 3.7 Production Preview Smoke

Local-only preview：`http://127.0.0.1:4173/`

| Check | Result |
| --- | --- |
| `/` | 200 |
| HTML local refs | 27 / 27 HTTP 200 |
| `js/preload.js` | 200 |
| `js/login-gate.js` | 200 |
| `js/main-menu.js` | 200 |
| Representative large asset | 200 |
| Login gate rendered | PASS |
| Invalid Email UI error | PASS |
| Unknown-account generic error | PASS |
| Guest entry | PASS |
| Main menu | PASS |
| New game / prologue | PASS |
| Canvas initialized | PASS |
| Countdown / current objective | PASS |
| App Console errors | 0 |

本輪沒有重跑已通過的 A/B/C cloud browser flow，也沒有觸發任何 cloud write。

### 3.8 Browser-visible Secret / Credential Exposure Audit

Runtime source scan：

- `.env.local` 的 Supabase URL exact value 在 source hardcode：0 files。
- `.env.local` 的 publishable key exact value 在 source hardcode：0 files。
- `postgres://` / `postgresql://`：0 files。
- private key marker：0 files。
- service-role marker：0 runtime source files。
- `sb_secret_`：只出現在 `js/lib/supabase-client.js` 的 rejection guard。

`dist` scan：

- `VITE_SUPABASE_URL` value：只在 Supabase browser client bundle 出現，分類為 public project URL。
- `VITE_SUPABASE_PUBLISHABLE_KEY` value：只在同一 browser client bundle 出現，且為 `sb_publishable_` 類型。
- secret/service-role key：0 finding。
- database connection URL：0 finding。
- pooler URL：0 finding。
- private key：0 finding。
- `sb_secret_` 命中為 client rejection guard 字串，不是 credential。
- `access_token` / `refresh_token` 命中為 bundled Supabase client library 的欄位名稱；沒有發現實際 token 值。

結果：`PASS`。Production browser bundle 只有設計上可公開的 project URL 與 publishable key。

### 3.9 Release Artifact Audit

Fresh `dist`：

| Metric | Value |
| --- | ---: |
| Files | 144 |
| Bytes | 172,433,732 |
| MiB | 164.45 |

以下項目在 `dist` 皆為 0：

- `.env` / `.env.local`
- `supabase/.temp`
- `pooler-url`
- database credentials
- secret/service-role key
- migration / `.sql`
- Phase reports / audit documents
- test files / test credentials
- `.map`
- `raw_references`
- AEP / PSD / MOV / ZIP
- 本機 linked-project metadata

結果：`PASS`。Release 時必須維持「只發布 fresh `dist`」原則，不能把 repository root 當成 deploy directory。

### 3.10 Supabase Advisors

| Advisor | Result |
| --- | --- |
| Performance | `PASS` — 0 findings |
| Security | 1 WARN — Leaked Password Protection Disabled |

Security remediation：<https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection>

---

## 4. FAIL

目前沒有產品功能、automated regression、production build 或 preview smoke 的 FAIL。

以下 pgTAP 執行問題歸類為 QA harness WARNING，不是產品 assertion FAIL；以下 release prerequisites 歸類為 BLOCKER，不與產品測試結果混在一起。

---

## 5. WARNING

### 5.1 43-item Remote pgTAP Was Not Re-executed

既有 `supabase/tests/game_saves_rls.test.sql` 為 `BEGIN … ROLLBACK`、`plan(43)`。

本輪兩個安全嘗試：

1. Supabase read-only SQL runner：在 `CREATE EXTENSION pgtap` 處回 `25006 cannot execute CREATE EXTENSION in a read-only transaction`；沒有執行測試 DML。
2. Official CLI：`supabase test db --linked --project-ref ujjvdmrenirjxusbtulx ...` 正確連到 remote，但 CLI 的 pgTAP runner 要求 Docker；本機沒有 Docker，因此以 `LegacyDockerRunError` 結束。

遠端確認 `pgtap` extension 仍不存在，代表沒有留下 schema mutation。由於本輪禁止新增 extension／安裝環境，沒有擴大處理。

Phase 5B 建議在可用 Docker 的本機或 CI 執行既有 43 assertions；執行前後仍須核對 Project Ref 與 A/B/C data fingerprint。

### 5.2 Vite Classic-script Warnings

12 支既有 classic scripts 沒有 `type=module`，Vite 不 bundle 它們。這是目前架構的既定行為，production preview 已證明 copy output 可用，因此不是 blocker；未來若要改為 module bundling，屬於獨立架構工作，不能在 release QA 偷做。

### 5.3 Large Artifact

`dist` 容量來源：

| Type | Files | Bytes | Share |
| --- | ---: | ---: | ---: |
| Images | 128 | 171,821,941 | 99.65% |
| PNG | 101 | 161,399,944 | 93.60% |
| JS | 14 | 538,103 | 0.31% |
| CSS + HTML | 2 | 73,688 | 0.04% |

Asset folder breakdown：

| Folder | MiB |
| --- | ---: |
| `assets/道具` | 96.75 |
| `assets/items` | 26.77 |
| `assets` root | 18.62 |
| `assets/characters` | 12.74 |
| `assets/backgrounds` | 9.26 |

Largest finding：`壁畫.png` 與 `items/mural.png` 各約 7.18 MiB。SHA-256 分析發現 28 組重複內容，額外佔 51,585,198 bytes（49.20 MiB，29.92%）。

判斷：容量明確由隊友圖像 assets 構成，不是 JS/backend 膨脹。本機 build 與 preview 沒有被它阻擋；但在 hosting provider 未選定前，無法驗證 repository/deploy quota、single-file limit、upload timeout、CDN cache 或首載效能，因此目前仍是 deployment risk。本輪依限制沒有壓縮、刪除、改名或重做任何圖片。

### 5.4 Leaked Password Protection Disabled

Security Advisor 唯一警告為 `auth_leaked_password_protection`。

建議 Phase 5B 啟用，但需先確認 Supabase plan 支援（官方文件標示 Pro Plan 以上）並取得明確批准。可能影響：

- 新註冊、密碼更新與弱／外洩密碼登入可能回 `WeakPasswordError`。
- 需要驗證既有 UI 是否能將這類錯誤轉成安全且可理解的訊息。
- 啟用後應重測 signup、login、forgot/reset、update password 與 A/B/C 測試帳號登入。

本輪未啟用。

### 5.5 Google Fonts External Dependency

Runtime CSS 會請求 `fonts.googleapis.com`。Hosting 決策需把它納入 CSP、privacy、offline/failure fallback 與 performance 評估。本輪沒有修改字體或 UI。

---

## 6. BLOCKER

### 6.1 No Git Repository / No Verified Rollback Point

`git rev-parse` 與 `git status` 都回 `fatal: not a git repository`。

影響：

- 無法證明這次 release 對應哪個 commit。
- 無法安全比較隊友 source 與 release artifact 的差異。
- 無法建立 tag、release branch 或快速 rollback 到已驗證版本。
- 發生 production regression 時，只能依本機資料夾／手動備份回復，風險高。

Phase 5B 不應直接盲目 `git init`；應先確認團隊既有 upstream repository、remote URL、default branch 與目前工作樹來源。若確定沒有既有 repo，再由使用者批准初始化、建立 baseline commit、remote 與 release tag 策略。

### 6.2 Hosting / Production URL Not Decided

目前沒有 Vercel、Netlify、Cloudflare、Firebase、Docker 或其他 hosting config，也沒有 `.openai/hosting.json`。Production hostname、custom domain、HTTPS、deployment directory、quota、cache headers、SPA fallback 與 rollback 方法均未定。

在 platform 與 URL 未決定前，不能安全配置 Auth redirect，也不能判定 172.4 MB artifact 是否符合平台限制。

### 6.3 Supabase Production URL Configuration Is Not Ready

Dashboard read-only evidence：

- Site URL：`http://localhost:3000`
- Redirect URLs：`No Redirect URLs`

這會直接影響 signup confirmation、password reset 與其他 email redirect flow。Phase 5B 必須在 production URL 確定後設定：

- exact production Site URL
- exact production confirmation/reset callback URLs
- 是否保留 localhost preview URLs
- 是否需要 staging/preview allowlist
- 是否允許 wildcard；production 原則優先 exact URLs

設定後必須真實測試 confirmation 與 password reset，不得只看 Dashboard。

### 6.4 Custom SMTP Is Disabled

Dashboard `Enable custom SMTP` 狀態：`false / unchecked`。

官方文件說明內建 SMTP 只適合探索與非 production 使用，會限制寄送到 project team 預先授權地址、限流且沒有 SLA。此專案 UI 已包含註冊、Email confirmation 與 forgot-password，因此 public production release 前需要 custom SMTP 決策。

Phase 5B 需決定：provider、sender domain、From address/name、SMTP credential storage、SPF/DKIM/DMARC、rate limits、template branding、bounce/abuse handling，以及 confirmation/reset deliverability test。

官方參考：<https://supabase.com/docs/guides/auth/auth-smtp>

---

## 7. Release Artifact And Secret Gate

Production deploy gate：

1. 只部署 fresh `dist`。
2. Hosting environment 只注入 browser-safe Supabase URL + publishable key。
3. 不把 `.env.local`、repository root、`supabase/.temp`、pooler URL、database password、Access Token 或 service-role key上傳到 hosting。
4. Build 後重新執行 exact-value fingerprint 與 pattern scan。
5. 確認 source map 未產出或不含敏感資訊。
6. 確認 hosting log 不列印 Auth tokens、Email/password 或 `.env` values。

目前 gate 1–5 的 local artifact audit 通過；hosting log 必須在選定 platform 後驗證。

---

## 8. Test Users And Save Cleanup Strategy

本輪保留：

- User A / B / C Auth records
- A / B / C 各自的 `game_saves`
- Phase 4 真實 browser evidence

建議策略：

1. Phase 5B configuration 完成後，先用 A/B/C 做 production URL、SMTP、password-protection 與最後 staging verification。
2. 正式 release sign-off 前建立 read-only fingerprint：User ID、row count、revision、current_scene。
3. 清理必須另取得使用者明確批准，且只能在 `ujjvdmrenirjxusbtulx`。
4. 若批准清理，先刪除 Auth User 前記錄 evidence；因 FK `ON DELETE CASCADE`，對應 save 會一併刪除。
5. 清理後再次驗證 A/B/C 不存在、對應 saves 為 0，並保留不含 credential/token 的 audit record。

本輪沒有執行清理。

---

## 9. Phase 5B Changes Requiring Explicit Approval

按建議優先順序：

1. **Recover or establish Git provenance**：確認正確 upstream；若沒有既有 repo，再批准初始化、baseline commit、remote、branch/tag 與 rollback 流程。
2. **Choose hosting**：provider、plan、production domain、deploy directory、quota、CDN/cache、SPA fallback、rollback。
3. **Set production Auth URLs**：Site URL、exact redirect allowlist、staging/localhost policy；真實測試 confirmation/reset。
4. **Configure custom SMTP**：provider、sender domain、credentials、SPF/DKIM/DMARC、rate limit與 deliverability tests。
5. **Leaked Password Protection decision**：確認 plan，批准後啟用並跑 Auth regression；本輪不啟用。
6. **Complete pgTAP harness**：在具 Docker 的本機或 CI 執行 43 assertions；不得為了測試而永久擴大 remote schema。
7. **Hosting security headers**：HTTPS、CSP（含 Supabase + Google Fonts）、Referrer-Policy、X-Content-Type-Options、frame protection、cache policy。
8. **Large asset deployment decision**：先依 hosting limits 判斷；若需優化，必須取得 UI/asset owner 批准，不能在 QA 階段擅自改圖。
9. **A/B/C cleanup decision**：最後全系統驗證完成後另行批准，不與 deployment 自動綁定。

---

## 10. Final Release Checklist

### Product QA

- [x] Full regression 56 / 56 PASS
- [x] Auth negative 19 / 19 PASS
- [x] Cloud negative 23 / 23 PASS
- [x] Real unknown-account Browser negative PASS
- [x] Real anon database read denied
- [x] Phase 4 A/B/C browser evidence preserved
- [x] Production build PASS
- [x] Production preview smoke PASS
- [x] Browser console 0 error during smoke
- [x] RLS enabled and 4 owner policies present
- [x] Security / Performance Advisors checked
- [x] Secret and artifact audits PASS
- [x] A/B/C and three saves unchanged

### Still Required Before Production Release

- [ ] Correct Git root / remote / branch / release commit / rollback point
- [ ] Hosting provider and plan approved
- [ ] Production domain and HTTPS active
- [ ] 172.4 MB artifact accepted by hosting limits
- [ ] Production Site URL configured
- [ ] Exact redirect allowlist configured
- [ ] Custom SMTP configured and verified
- [ ] Confirmation and password-reset links tested on production domain
- [ ] Leaked Password Protection decision completed
- [ ] pgTAP 43 assertions executed in Docker/CI-capable environment
- [ ] Hosting security headers and cache policy verified
- [ ] Final post-deploy smoke and Auth/Cloud flow test
- [ ] A/B/C cleanup decision explicitly approved or documented as retained

---

## 11. Final Status

### PASS

- Product regression、Auth/Cloud negative、build、preview、anon denial、artifact 與 secret audit。
- Current remote project identity、RLS metadata、A/B/C users 與 saves 均保持正確。

### FAIL

- None。

### WARNING

- pgTAP 43 assertions 因缺少 Docker／remote runner 限制未重跑，不能宣稱通過。
- Vite classic-script warnings 為既有架構；preview 已通過。
- `dist` 99.65% 為圖片，約 29.92% bytes 為重複內容；需依 hosting plan 評估。
- Leaked Password Protection disabled。
- Google Fonts 是外部 runtime dependency。

### BLOCKER

- No Git provenance / rollback。
- Hosting 與 production URL 未定。
- Supabase Site URL 仍是 localhost，redirect allowlist 空白。
- Custom SMTP disabled，不適合 public production Auth email。

### Phase 5B Readiness

`YES — 可進 Phase 5B。`

理由：Phase 5A 的產品 QA 已通過，且所有 release blockers 都已具體定位，可在 Phase 5B 以逐項批准、小範圍修改與重新驗證處理。這個 `YES` 不代表現在可正式部署；目前 production release status 仍為 `NOT READY`。
