# Phase 4 Report — Cloud Save / Load + Backend Integration

> Target: `FIGMA2026 / sun-main / ujjvdmrenirjxusbtulx`  
> Report date: 2026-09-04  
> Status: `COMPLETE` — A/B 核心會員流程、Guest regression 與 Guest → Member Import 均已通過真實 Browser 測試。

## 1. Existing Save System Analysis

- 遊戲 checkpoint 由 `js/checkpoint.js` 建立與還原。
- 訪客存檔沿用 `localStorage` key：`sunHeartCheckpointV1`。
- Phase 4 在既有 UI 與遊戲流程外加入 `GameSave` model、save coordinator 與 Supabase service；未重做 UI、CSS 或 routing。
- Member 的權威來源為 Cloud；本機 Member cache/pending 只用於顯示與失敗復原，不取代 Cloud authority。

## 2. Canonical GameSave

Canonical format version 為 `1`，上限為 65,536 bytes，包含：

- `version`, `label`, `sceneId`, `createdAt`
- `progress`
- `inventory`, `selectedItem`
- `scaleState`, `mirrorState`, `timer`, `player`

允許場景為 `sun_temple`、`judgement_chamber`、`pharaoh_tomb`。遊戲進度、道具、謎題狀態、計時器與玩家位置皆經白名單驗證。

## 3. Serialization Strategy

- `serializeGameSave()` 從目前 `Game` / player runtime 建立純 JSON snapshot。
- `parseGameSave()` 同時負責 normalize 與 validation。
- `parseCloudGameSaveRow()` 驗證 DB metadata 與 JSON payload 的 version / scene 一致性。
- `performance.now()` 衍生時間不跨頁或裝置保存，還原時歸零，避免不安全的 runtime timestamp。

## 4. Validation Strategy

- 嚴格檢查版本、場景、欄位型別、允許道具、謎題值、玩家方向、計時器範圍與 payload 大小。
- 不支援的新版本回傳 `SAVE_VERSION_UNSUPPORTED`，不靜默降級。
- DB row 的 `revision` 必須為大於等於 1 的安全整數。
- 無效存檔以結構化 `{ ok: false, code, message }` 回傳，不直接套入 runtime。

## 5. Save Service

`js/services/game-save-service.js`：

- 每次 Cloud read/write 前以 `supabase.auth.getUser()` 取得可信 current user。
- 所有查詢都限定 `user_id = current user id`。
- 無 row 以 `{ ok: true, exists: false }` 表示，不視為登入或讀取錯誤。
- 第一次存檔使用 insert；後續更新要求符合預期 `revision`。
- 網路、逾時、權限、衝突與一般 DB 錯誤有分離的結構化結果。

## 6. Guest Storage Strategy

- Guest 只使用 `localStorage`，不查詢或寫入 Supabase。
- Guest checkpoint、load、F5 restore 與 new game 清除均由 save coordinator 管理。
- Guest 與 Member cache 使用不同 key namespace。

## 7. Member Cloud Strategy

- Member 的權威來源為 `public.game_saves`。
- 一位 Auth user 最多一筆 row。
- Member 登入後 Cloud 無 row 是合法的 New Game / No Save 狀態。
- Cloud write 失敗時保留 user-scoped pending snapshot，但不把它宣告為已同步。

## 8. Cloud Save Flow

`checkpoint → serializeGameSave → saveCoordinator.save → gameSaveService.saveCloudGame → public.game_saves`

- 初次 Cloud save：`expectedRevision = null`，執行 insert。
- 後續 Cloud save：帶入已讀取的 revision，執行條件式 update。
- 成功後更新 Member cache 並移除 pending snapshot。

## 9. Cloud Load Flow

`UI load action → saveCoordinator.load → gameSaveService.getCloudSave → validate row → restore checkpoint`

- 有 row：載入 Cloud save 並記錄 revision。
- 無 row：回傳合法 empty state，允許 Member 開始新遊戲。
- 讀取錯誤：顯示可重試狀態，不以 Guest/local 資料冒充 Cloud 成功。

## 10. Revision / Conflict Handling

Evidence: `AUTOMATED_PASS`

- DB trigger 每次 update 由伺服器將 revision 加 1。
- Client update 同時限定 `user_id` 與 `expectedRevision`。
- 0-row conditional update 會重新讀取最新 Cloud row，回傳 `REVISION_CONFLICT`。
- 衝突時保留 pending snapshot、更新已知 Cloud metadata，且不自動覆蓋較新的 Cloud save。
- Targeted tests 已驗證衝突分支、pending 保留與不自動覆蓋。
- 遠端唯讀觀察到 User A revision `4`、User B revision `2`，證明正常寫入有 revision 遞增；這不是對真實競態衝突的 Browser 測試。

## 11. Guest → Member Import

Evidence: `REAL_BROWSER_PASS`

- 僅在已登入 Member、Guest save 有效、且 Member Cloud 無 row 時提供匯入。
- 必須取得明確確認才會 insert。
- 成功後才清除 Guest save。
- 若 Cloud 已存在，回傳 `CLOUD_EXISTS`，Guest save 不覆蓋 Cloud。
- 使用者已以原本 `game_saves = 0` 的 User C 完成 Guest → Member Import 真實 Browser 測試並確認 PASS。
- 匯入後的唯讀確認顯示 User C 有 1 筆 Cloud save，`current_scene = judgement_chamber`。

## 12. Error Handling

- Auth missing/expired、network failure、timeout、access denied、validation failure、revision conflict 均使用不同 error code。
- 失敗狀態不宣告為 synced。
- Cloud save 失敗保留 pending；Cloud load 失敗不改用 Member local cache 作為權威資料。
- `Member + 0 Cloud Save` 為成功 empty state，不是 Login Failure。

## 13. Files Added

Phase 4 相關新增檔案目前包含：

- `js/models/game-save.js`
- `js/services/game-save-service.js`
- `js/services/save-coordinator.js`
- `tests/game-save.test.mjs`
- `tests/game-save-service.test.mjs`
- `tests/save-coordinator.test.mjs`
- `tests/member-empty-login.test.js`
- `PHASE_4_REPORT.md`

## 14. Files Modified

Phase 4 串接涉及的既有檔案包含：

- `js/backend-bootstrap.js`
- `js/checkpoint.js`
- `js/main-menu.js`
- production build 產物中的對應 runtime files

本輪只新增／更新本報告，未修改遊戲程式碼。

## 15. Database Interaction

- 唯一使用的 application table：`public.game_saves`。
- Schema 包含 `id`, `user_id`, `save_data`, `save_version`, `current_scene`, `revision`, `created_at`, `updated_at`。
- `user_id` unique 且 FK 指向 `auth.users.id`。
- Phase 4 建立了一個獨立的臨時 User C；Cloud save 由真實 Browser 的 Guest → Member Import 正常建立，未以 SQL 或 service-role 偽造。
- 沒有 migration、policy、grant 或 RLS 變更。

## 16. Real Cloud Save Test

依使用者 2026-09-04 人工測試結果：

| Item | Result |
| --- | --- |
| User A Cloud Save | `REAL_BROWSER_PASS` |
| User B Cloud Save | `REAL_BROWSER_PASS` |

兩位使用者均玩到第 2 關並成功保存，包含道具狀態。

## 17. Real Cloud Load Test

依使用者人工測試結果：

| Item | Result |
| --- | --- |
| User A Cloud Load | `REAL_BROWSER_PASS` |
| User B Cloud Load | `REAL_BROWSER_PASS` |

重新載入後，兩位使用者均回到各自第 2 關，存檔與道具狀態保留。

## 18. F5 Restore Test

依使用者人工測試結果：

| Item | Result |
| --- | --- |
| User A F5 Restore | `REAL_BROWSER_PASS` |
| User B F5 Restore | `REAL_BROWSER_PASS` |

F5 後 Session 與進度均未消失。

## 19. User A / B Integration

| Item | Result |
| --- | --- |
| User A Login | `REAL_BROWSER_PASS` |
| User B Login | `REAL_BROWSER_PASS` |
| A/B application isolation | `REAL_BROWSER_PASS` |

使用者確認 A/B 沒有互相讀取對方進度。遠端唯讀結果亦顯示兩個不同 `user_id` 各一筆 row：

| User | Row count | current_scene | revision |
| --- | ---: | --- | ---: |
| `2e76c4ff-0ca8-41e0-b6cf-846411355bf2` | 1 | `sun_temple` | 4 |
| `980f0e9c-9aaa-48dc-b260-8436c4675493` | 1 | `judgement_chamber` | 2 |

`current_scene` 是資料庫的實際值；「兩者均玩到第 2 關」來自使用者的人工 Browser 測試敘述，兩者不混為同一證據。

## 20. Guest Regression

Evidence: `REAL_BROWSER_PASS`

- Targeted tests 驗證 Guest 仍以 `localStorage` 為權威、checkpoint 可存取、new game 只清除 Guest save，且不呼叫 Cloud。
- 使用者已完成真實 Browser Guest regression 測試並確認 PASS。

## 21. Guest Import Test

Evidence: `REAL_BROWSER_PASS`

- Targeted tests 驗證明確確認、Cloud 無 row 才可匯入、成功後清除 Guest save。
- Targeted tests 驗證已有 Cloud 時 Guest import 被阻止且 Cloud 不被覆蓋。
- 使用者已完成 User C 的 Guest → Member Import 真實 Browser 測試並確認 PASS。
- 先前唯讀確認：User C `game_saves` row count 為 `1`，`current_scene = judgement_chamber`。

## 22. Tests

- 本輪剩餘 Phase 4 targeted tests：`18/18 PASS`、`0 FAIL`。
- 覆蓋 login gate、bootstrap import、Guest regression、Cloud existing protection、revision conflict、Auth identity、timeout 與 Cloud CRUD contract。
- 最近一次完整 suite（前一輪程式修正後）：`56/56 PASS`。
- 本輪沒有程式碼變更，因此依要求未重跑完整 suite。
- A/B 已通過項目沒有重跑。

## 23. Build

- 最近一次程式修改後的 production build：`PASS`。
- 本輪只有 Markdown 報告變更，因此依要求未重跑 production build。

## 24. Security

- Browser 不使用 service-role key。
- Current user 由 Supabase Auth 驗證，不信任 UI 傳入的 user ID。
- DB 已啟用 RLS，SELECT/INSERT/UPDATE/DELETE policy 均以 `auth.uid() = user_id` 限制 owner。
- Column grants 不允許 Browser 直接指定 revision / server metadata。
- A/B isolation 已有 `REAL_BROWSER_PASS`；自動測試亦驗證 user-scoped query/update。
- 本輪未修改 RLS、grants、User A / User B 或任何 `game_saves`；唯一 Auth mutation 是建立獲准的臨時 User C。

## 25. Manual Test Status

- User A / User B Login、Cloud Save、Cloud Load、F5 Restore、application isolation：`REAL_BROWSER_PASS`
- Guest regression：`REAL_BROWSER_PASS`
- Guest → Member Import：`REAL_BROWSER_PASS`
- Phase 4 Browser 測試已全部完成；不需要重跑。

## 26. Remaining Risks

- Phase 4 沒有尚未完成的 blocking item。
- Cloud existing protection 與 revision conflict 已有 targeted automated coverage；若 Phase 5 要求更高強度，可再規劃多 session / network-failure negative Browser tests，但不是 Phase 4 completion blocker。
- 遠端 row 的場景值是查詢當下 snapshot；後續 checkpoint 可能改變。
- Phase 4 臨時測試帳號與存檔仍保留；清理必須等待使用者另行明確批准。

## 27. Ready for Phase 5?

`YES — Phase 4 COMPLETE。`

已完成：

- A/B 九項核心會員流程：`REAL_BROWSER_PASS`
- Guest regression：`REAL_BROWSER_PASS`
- Guest → Member Import：`REAL_BROWSER_PASS`
- 剩餘四項的程式／service 自動驗證：`AUTOMATED_PASS`
- Targeted tests：`18/18 PASS`

Phase 4 在此停止；Phase 5 必須等待使用者另行批准後才開始。

## 28. Phase 5 Pending Items

Phase 5 尚未開始。開始前仍需依團隊流程先提交目標、範圍、預計新增／修改檔案、前端影響、完成條件與驗證方法，取得使用者確認後才能實作。

待規劃項目：

1. 鎖定 Phase 5 的正式 scope 與 acceptance criteria，不從 Phase 4 自動延伸功能。
2. 盤點 Phase 4 保留的 User A / User B / User C 與 `game_saves`；是否清理須取得明確批准，不在本次處理。
3. 決定是否把多 session revision conflict、network failure、pending/retry 與 Cloud existing protection 納入 Phase 5 的真實 Browser negative tests。
4. 若 Phase 5 有程式碼修改，才執行相應 targeted tests、Auth/save regression、完整 test suite 與 production build。
5. 後續 production readiness 仍需獨立處理 deployment environment、redirect allowlist、SMTP、HTTPS、deployed smoke test 與最終 security audit；本次不執行。
