# Phase 5 Plan — Final QA / Production Readiness

> Target: `FIGMA2026 / sun-main / ujjvdmrenirjxusbtulx`  
> Status: `PLANNING — NOT STARTED`  
> Scope: 最終驗收、production readiness 與 release gate；不新增功能、不重構 UI、不改變遊戲設計。  
> Stop rule: 本文件完成後停止，等待使用者批准才執行測試、build、preview、修正、部署或資料清理。

## 1. Phase Goal

Phase 5 的目標是用可重現證據回答：

1. 現有 Frontend、Auth、Cloud Save、RLS 與完整遊戲流程是否仍通過 regression。
2. 失敗、空資料、錯誤憑證、離線、timeout、revision conflict 與跨使用者操作是否安全失敗。
3. production build 與 preview 是否只包含預期資產、沒有 secret，且可被部署平台正確提供。
4. 正式發布前還缺少哪些外部設定或人工決策。
5. 測試帳號與測試存檔應何時、如何安全清理。

Phase 5 不新增產品功能。若測試發現 defect，先記錄 Root Cause、影響、最小修正範圍與回歸測試，取得同意後才修改程式。

## 2. Hard Boundaries

- 唯一允許的 Supabase project：`FIGMA2026 / sun-main / ujjvdmrenirjxusbtulx`。
- 若任何 CLI、Dashboard、MCP 或 metadata 顯示其他 project ref，立即停止。
- 不操作 LifeQuest、`ss105213108supabase` 或其他 project。
- 不修改隊友 UI、CSS、layout、routing 或遊戲設計。
- 不新增產品功能或擴充 database schema。
- 不降低、停用或繞過 RLS。
- Browser 只使用 publishable key；禁止 service-role、secret key、database password。
- 不刪除或修改 User A / B / C 與其 `game_saves`，除非另行提出精確 mutation plan 並取得使用者批准。
- 不部署、不建立 release、不 commit、不 push，除非後續明確批准。

## 3. Read-only Audit Baseline

本節是 planning turn 的唯讀結果，不等同 Phase 5 正式測試結果。

### Repository / toolchain

| Item | Current observation | Status |
| --- | --- | --- |
| Git metadata | 目前目錄不是 Git repository | `RISK` |
| Node | `v24.18.0`; package 要求 `>=22` | `OBSERVED` |
| pnpm | `11.19.0`; lockfile 與 packageManager 存在 | `OBSERVED` |
| Supabase CLI | package pin `2.116.0`; sandbox 內執行 `--version` 遇到 `EPERM` | `REVERIFY_ON_EXECUTION` |
| Tests | 24 test files；最近 Phase 4 完整證據為 `56/56 PASS` | `HISTORICAL_PASS` |
| Build | 最近 Phase 4 production build 為 PASS | `HISTORICAL_PASS` |
| Current dist | 144 files、172,433,732 bytes；最近 timestamp 2026-09-04 | `REBUILD_REQUIRED` |
| Deployment config | 未找到 Vercel/Netlify/Cloudflare/Firebase/hosting config | `BLOCKING_INPUT` |

### Environment / secrets

- `.env.local` 目前只有 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_PUBLISHABLE_KEY` 兩個變數名稱；未讀出或記錄其值。
- `.env.local`、`.env.*`、`supabase/.temp/`、`dist/` 與 `.phase2-baseline/` 已列入 `.gitignore`。
- Browser client 明確拒絕 `sb_secret_` key。
- `supabase/.temp/pooler-url` 是本機 link metadata，可能包含敏感連線資訊；雖被 ignore，仍不可納入 zip、upload 或 release artifact。
- `dist` 中出現字串 `sb_secret_` 是 client-side rejection guard 的程式碼標記，不代表已發現真實 secret；正式 audit 仍需用 pattern + entropy + known-value fingerprint 三層掃描確認。

### Remote Supabase

| Item | Read-only observation |
| --- | --- |
| Project | `sun-main` / `ujjvdmrenirjxusbtulx` / `ACTIVE_HEALTHY` |
| Region | `ap-southeast-1` |
| PostgreSQL | 17.6 |
| Migrations | 1：`20260903032810_create_game_saves` |
| Application tables | 只有 `public.game_saves` |
| RLS | enabled |
| Policies | SELECT / INSERT / UPDATE / DELETE 共 4 個 owner policies |
| Anon privileges | SELECT / INSERT / UPDATE / DELETE 全部 false |
| Authenticated grants | table SELECT/DELETE；INSERT/UPDATE 只限核准欄位 |
| Protected metadata | `revision`, `created_at`, `updated_at` 不可由 Browser 寫入；`user_id` 不可 update |
| Test Auth users | A / B / C 共 3 位 |
| Test save rows | 共 3 rows，一位 user 一筆 |
| Security advisor | `WARN`: Leaked Password Protection Disabled |
| Performance advisor | 無 findings |

### Deployment unknowns

- Hosting provider 與 production hostname 尚未指定。
- Supabase production Site URL、confirmation/reset redirect allowlist 尚未取得驗證證據。
- Custom SMTP provider/domain、寄件者與 DNS 設定尚未提供。
- HTTPS、CSP、Referrer-Policy、X-Content-Type-Options、frame protection 與 cache headers 尚未有 hosting-level configuration。
- Google Fonts 是 production 第三方 request；CSP、privacy 與離線行為需在 hosting 決策中處理。
- `dist` 約 172.4 MB，需確認 hosting quota、single-file limits、CDN cache 與實際載入效能。

## 4. Execution Order and Stop Gates

```text
Verify exact project / workspace
↓
Capture immutable baseline
↓
Static environment + secret audit
↓
Full automated regression
↓
Auth negative tests
↓
Cloud Save / Load negative tests
↓
RLS / cross-user final verification
↓
Production build
↓
Artifact audit
↓
Production preview smoke test
↓
Deployment readiness review
↓
Release checklist
↓
Separate cleanup approval gate
```

任一項出現以下狀況即停止後續 release gate：

- project ref 不符。
- test/build failure。
- secret/service-role/database credential 出現在 source、bundle、log 或 artifact。
- RLS/owner isolation 失敗。
- build artifact 缺檔、runtime 404、Auth/Cloud flow regression。
- 測試需要未批准的遠端 mutation、帳號建立／刪除或資料覆寫。

## 5. Full Regression Test Plan

### Goal

確認既有 56-test baseline、遊戲互動、Auth、save codec、service、coordinator、assets 與 migration contract 沒有 regression。

### Planned actions

1. 確認 Node / pnpm / lockfile / installed dependency versions。
2. 執行 `pnpm.cmd test`，保存 test count、pass/fail、duration 與 failing test names。
3. 測試分類核對：gameplay、assets、main menu、checkpoint、Auth、Supabase client、save codec、save coordinator、Cloud service、migration contract。
4. 不以「沒有紅字」取代精確 test count。

### Exit gate

- `0 failed`, `0 skipped`（除非事先核准），測試數不得低於 Phase 4 的 56。
- 任一失敗先停止，進 Root Cause Diagnosis；不直接大量修改。

## 6. Auth Negative Test Plan

### Automated / non-mutating cases

- empty email/password。
- invalid email format。
- weak password validation。
- wrong password 與 unknown email 使用同一 generic error，避免 account enumeration。
- unconfirmed email response 不洩漏敏感資料。
- network failure / timeout 轉成安全 UI error。
- no session、expired identity、logout 後 state 清除。
- refresh/token event 不產生 duplicate initialization。
- password reset 使用 generic response；redirect URL 去除 query/hash token。

### Browser cases

- 使用錯誤密碼確認無 session、無 Cloud request、錯誤訊息安全。
- logout 後 F5 不恢復已登出 member session。
- Session Restore 僅在有效 session 下恢復。

### Safety

- 優先使用 mock/local negative cases，避免遠端 rate limit 或鎖定測試帳號。
- 不建立新的 Auth user；若某案例必須使用 unconfirmed user，先另行申請批准。
- 不將 Email、Password、access token 或 refresh token寫入 test output。

## 7. Cloud Save / Load Negative Test Plan

### Required cases

- Member + no row 是合法 empty state，不是 login failure。
- invalid/corrupt/future-version payload 被拒絕且不套入 runtime。
- timeout/network failure 顯示 pending/retryable state，不宣告 synced。
- failed write 保留 user-scoped pending recovery。
- existing Cloud save 阻止 Guest import overwrite。
- revision conflict 不自動覆蓋較新 Cloud row。
- member new game 在新 checkpoint 成功前保留既有 Cloud save。
- auth identity 缺失時，在 table query 前停止。

### Evidence levels

- Service/codec/coordinator negative paths：automated tests。
- Browser offline/network failure：production preview + DevTools offline 或 request interception。
- 真實 revision conflict 若需要兩個 session，先提出精確 data mutation 與 restore strategy；未批准前只使用 automated conflict harness。

### Exit gate

- 不得因 negative test 改寫 A/B/C 既有 save。
- 所有失敗狀態必須可理解、可重試且不洩漏 credential/database detail。

## 8. RLS / Cross-user Isolation Final Verification

### Layer 1 — static remote metadata

- Reverify project ref、migration list、RLS enabled、4 policies、grants、column privileges、FK cascade 與 revision trigger。

### Layer 2 — database tests

- 優先在 local Supabase stack 執行 `supabase/tests/game_saves_rls.test.sql` 的 43 assertions。
- 覆蓋 anon deny、owner CRUD、other-user SELECT/UPDATE/DELETE deny、owner forgery deny、metadata protection、revision increment 與 cascade。
- 若 Docker/local stack 不可用，停止並回報；不自動改在 production DB 執行帶 mutation 的 pgTAP。

### Layer 3 — live application evidence

- 保留 Phase 4 A/B application isolation 的 `REAL_BROWSER_PASS` 作歷史證據。
- Phase 5 對 remote 先做 read-only verification；任何 owner write/delete/cross-user mutation 必須另行批准。

### Exit gate

- anon 無任何 table operation。
- authenticated 只能看到與操作自己的 row。
- User A/B/C row count 與 owner 不變。
- Browser bundle 無 privileged key。

## 9. Production Build Plan

### Planned actions

1. 在 tests 全綠後執行 `pnpm.cmd build`。
2. 記錄 Vite exit code、warnings、duration、dist file count/bytes。
3. 確認 classic runtime scripts 數量 gate 通過。
4. 確認 `raw_references`、AEP、PSD、MOV、ZIP、`.env*`、Supabase `.temp` 與 test credentials 不在 `dist`。
5. 比對 build output references，確保入口 HTML、module chunks、classic scripts、CSS、images 都存在。

### Exit gate

- Build exit code 0。
- 無 missing asset / unresolved import。
- Artifact secret scan 0 findings。
- 只有 deploy allowlist 內容進入 artifact。

## 10. Production Preview Smoke Test Plan

### Planned actions

1. 執行 `pnpm.cmd preview --host 127.0.0.1`，使用獨立 preview port。
2. HTTP smoke：`/`, CSS, module chunks, classic scripts 與代表性 assets 均為 200。
3. Browser console：無 uncaught error、module/CORS/404 error。
4. UI smoke：main menu、login gate、Guest start、Member login、continue/load、F5 restore、logout。
5. Network smoke：只連到 exact `ujjvdmrenirjxusbtulx.supabase.co` 與已核准第三方資源。

### Exit gate

- 0 runtime exception、0 required-resource 404。
- Guest 與 Member source authority 正確。
- 不重做 Phase 4 的完整 gameplay；只執行 release smoke path。

## 11. Environment / Secret Exposure Audit Plan

### Source and local workspace

- 驗證 `.env.local` ignored；只列 key names，不輸出值。
- 搜尋 `sb_secret_`, `service_role`, JWT-like strings、database URLs/passwords、access/refresh tokens。
- 區分「guard/test fixture 字串」與真實 credential，不以單純 substring 誤報。
- 檢查 reports、logs、zip、baseline、Supabase `.temp` 與 shell history artifact 是否可能被錯誤打包。

### Build artifact

- 對 `dist` 重做相同掃描。
- 確認只含 project URL 與 publishable key；這兩者是 browser-visible configuration，不是 authorization boundary。
- 確認沒有 source map 暴露不必要資訊（目前需在正式 build 後驗證）。

### Exit gate

- 真實 privileged credential findings = 0。
- release artifact 不含 `.env.local`, `.temp`, reports, tests, raw references 或 authoring source files。

## 12. Deployment Readiness Plan

### Blocking inputs required from user

1. Hosting platform/provider。
2. Production hostname 與是否需要 preview hostname。
3. 是否為正式公開 production 或限時課堂/demo release。
4. Supabase Auth production Site URL 與 exact redirect allowlist。
5. Custom SMTP provider、sender domain/address；若沿用 Supabase 試用寄信，需明確接受其限制。
6. Security headers 與 Google Fonts policy：保留 remote fonts、self-host，或接受第三方 dependency。

### Platform checks after inputs

- Node/static hosting compatibility。
- SPA/static asset paths、HTTPS、compression、cache-control。
- CSP、frame-ancestors/X-Frame-Options、Referrer-Policy、X-Content-Type-Options。
- Environment variables只在 hosting settings 注入 URL + publishable key。
- Supabase URL allowlist、email confirmation、password reset callback。
- 172.4 MB artifact 是否符合平台 quota；必要時只做資產最佳化提案，不在 QA 階段擅自改畫質或內容。
- Deployed URL smoke test 與 network destination audit。

## 13. Test User / Save Cleanup Strategy

### Current scope

| Test identity | Auth user | game_saves |
| --- | --- | --- |
| User A | exists | 1 row |
| User B | exists | 1 row |
| User C | exists | 1 row |

### Recommended timing

保留 A/B/C 直到 production preview、deployment smoke 與最終 release evidence 全部完成；cleanup 是 release 前最後一個獨立 approval gate。提前刪除會失去真實 Session/Auth/Cloud regression 測試資料。

### Proposed cleanup sequence — not authorized now

1. 唯讀確認 exact project ref、三個 exact user IDs、row count 與 scene/revision snapshot。
2. 列出將被刪除的 Auth users 與 cascade rows，取得使用者逐項批准。
3. 處理／撤銷測試 sessions；注意刪除 user 不應被當作立即失效所有既有 JWT 的唯一手段。
4. 使用 Supabase Admin/Dashboard 刪除三個 exact Auth users；不執行廣泛 SQL delete。
5. 依 `ON DELETE CASCADE` 預期移除對應三筆 `game_saves`。
6. 唯讀驗證三個 Auth users 不存在、三筆 save rows 不存在、其他 users/rows 未受影響。
7. 關閉並清除所有一次性 localhost credential page／clipboard 暫存。

### Alternative

若要保留 demo accounts，需明確決定 owner、有效期限、password rotation、是否允許公開登入，以及測試資料標記策略；不能無期限保留未知責任人的 shared credentials。

## 14. Risk Register

| Priority | Risk | Current evidence | Mitigation / Gate |
| --- | --- | --- | --- |
| P0 | 錯誤 project mutation | 多 project 歷史存在 | 每次 remote call 明列並驗證 exact ref；不符即 STOP |
| P0 | Browser secret/service-role exposure | Client 有 secret-key rejection guard | Source + dist + network 三層 scan；0 finding gate |
| P0 | RLS/cross-user regression | 4 owner policies；Phase 4 A/B pass | pgTAP 43 assertions + remote metadata + read-only isolation evidence |
| P1 | 無 Git metadata | `git status` 失敗 | 發布前恢復正確 Git root/origin/branch/commit，否則 release provenance blocked |
| P1 | Production hostname/hosting 未定 | 無 deployment config | 使用者提供 platform + URLs 後才能配置與 deploy |
| P1 | Leaked Password Protection disabled | Supabase security advisor WARN | 評估方案支援與 UX；變更 Auth setting 前另行批准 |
| P1 | Production redirect/SMTP 未完成 | 目前只有 local URL 證據 | 設定 exact allowlist + custom SMTP，實測 confirm/reset |
| P1 | 大型 artifact | `dist` 約 172.4 MB | 檢查 hosting quota/CDN/cache/性能；不得在 QA 擅自刪資產 |
| P2 | Google Fonts/CSP/privacy dependency | CSS remote import | 決定 self-host 或允許來源並配置 CSP |
| P2 | Local sensitive metadata被誤打包 | `.env.local`, `.temp`, baseline zip 存在 | Deploy allowlist；只上傳 freshly built `dist` |
| P2 | Negative test 誤傷 Cloud save | A/B/C 各有一 row | 預設 mock/local；任何 remote write/conflict 另行批准 |
| P2 | Test accounts 長期殘留 | A/B/C 仍存在 | release 完成後獨立 cleanup approval + exact post-delete verification |

## 15. Final Release Checklist

每項只能標記 `PASS`, `BLOCKED`, `WAIVED_WITH_REASON`，不得以模糊敘述代替。

### Source / provenance

- [ ] 正確 Git root、remote、branch、commit 已確認。
- [ ] 工作樹與 release diff 已審核。
- [ ] Lockfile 與 package versions 可重現。

### Tests

- [ ] Full regression：至少 56 tests，0 fail。
- [ ] Auth negative tests PASS。
- [ ] Cloud Save / Load negative tests PASS。
- [ ] RLS pgTAP 43 assertions PASS。
- [ ] A/B/C cross-user isolation final verification PASS。

### Build / artifact

- [ ] Fresh production build PASS。
- [ ] Artifact inventory/size 記錄完成。
- [ ] Required assets 0 missing / 0 runtime 404。
- [ ] Secret scan 0 findings。
- [ ] Artifact 只含 deploy allowlist。

### Production preview

- [ ] HTTP smoke PASS。
- [ ] Browser console/network smoke PASS。
- [ ] Guest/Auth/Cloud minimal release flow PASS。
- [ ] F5/session restore/logout smoke PASS。

### Supabase / security

- [ ] Exact project ref reverified。
- [ ] RLS enabled、policies/grants/metadata protection verified。
- [ ] Security advisor 已處理或明確 waive leaked-password warning。
- [ ] Browser 不含 privileged key。
- [ ] Production Site URL / redirect allowlist 正確。
- [ ] SMTP/confirmation/reset flow ready。

### Hosting / deployment

- [ ] Hosting provider、production URL、preview URL 已批准。
- [ ] HTTPS、CSP、headers、compression、cache configured。
- [ ] Artifact size 符合平台 limits。
- [ ] Deployed URL smoke PASS。
- [ ] Rollback artifact / procedure 可用。

### Test data / release decision

- [ ] A/B/C cleanup 或保留方案獲得明確批准。
- [ ] 若 cleanup：exact users/rows post-delete verification PASS。
- [ ] 若保留：owner、期限、rotation、access policy 已記錄。
- [ ] Final QA report 完成。
- [ ] 使用者明確批准 release/deployment。

## 16. Planned Deliverables After Approval

- `PHASE_5_REPORT.md`：命令、實際結果、證據層級、failures、risks、release decision。
- Fresh test/build logs 的摘要；不保存或回報 credential。
- Production artifact inventory 與 secret-scan summary。
- Preview/deployment smoke checklist。
- 如獲批准，test-data cleanup report。

## 17. Approval Boundary

本 planning turn 已完成唯讀 audit 與計畫文件；尚未執行：

- Full test suite
- Auth/Cloud negative Browser tests
- pgTAP / RLS test run
- production build
- production preview
- source modification
- Auth/database mutation
- test user/save cleanup
- hosting configuration
- deployment/release

等待使用者批准 Phase 5 execution。即使批准一般 QA，test-data cleanup、remote destructive mutation 與正式 deployment 仍各自需要明確批准。
