# Phase 3 Report｜Authentication Integration

**Status:** Phase 3 Complete — Authentication implementation, real verification, and temporary-user cleanup all complete.

**Verified remote target:**

```text
Organization: FIGMA2026
Canonical Organization: figma2026
Organization ID: hvqcqjoryimlwvlecgkk
Project: sun-main
Project Ref: ujjvdmrenirjxusbtulx
Region: ap-southeast-1
Status: ACTIVE_HEALTHY
```

本 Phase 只實作 Supabase Authentication。沒有新增或修改 Database schema、migration、RLS、`game_saves` 資料、cloud save/load、checkpoint 或 gameplay。

## 1. Existing Auth UI Mapping

Repository 內只有一個既有 Auth gate，沒有第二個 Register form、Confirm Password 或 Logout control。

| Existing UI | DOM | Existing / updated event | Integration |
|---|---|---|---|
| Login form | `#explorer-login-form` | submit；email/password validation、loading lock | `window.authenticateExplorer()` → `authService.signIn()` |
| Email input | `#explorer-account` | trim、format validation | Supabase email identity |
| Password input | `#explorer-password` | login/register password；不保存 | Supabase password input |
| Login submit | `#explorer-login-submit` | loading/disabled、success/error status | member mode on valid session |
| Register entry | `#explorer-register` | 在同一 form 切換 register/login mode | `window.registerExplorer()` → `authService.signUp()` |
| Forgot password | `#explorer-forgot-password` | 驗證 email、共用 loading lock | `window.openExplorerPasswordReset()` |
| Guest entry | `#explorer-guest-enter` | 原有 guest transition | `Game.isGuest=true`，不呼叫 Supabase |
| Logout | Repository 原本不存在 UI | 未新增按鈕或重做 layout | 提供 `window.signOutExplorer()` integration point |

保留原有 tablet、按鈕、狀態區、主選單與 transition；沒有修改 `css/style.css`。

## 2. Auth Service Architecture

```text
Existing Auth Gate
↓
login-gate.js
↓ window integration points
backend-bootstrap.js
↓
auth-service.js
↓
supabase-client.js
↓
Supabase Auth
```

- `auth-service.js` 是唯一 Auth API wrapper；UI 沒有散落 Supabase calls。
- `backend-bootstrap.js` 負責 composition、session snapshot、既有 `window.*` hooks 與 auth event bridge。
- Supabase client 維持 `persistSession: true`、`autoRefreshToken: true`、`detectSessionInUrl: true`。
- 沒有新增 Redux、Context、Zustand 或自訂 token store。

## 3. Register Implementation

- 同一個既有 form 切換至「建立探勘紀錄」，未新增第二套 UI。
- 使用 `supabase.auth.signUp({ email, password, options: { emailRedirectTo } })`。
- Client-side handling：空 email、email format、空 password、少於 6 字元、loading lock。
- Supabase handling：weak password、signup disabled、rate limit、network/unknown error。
- Email confirmation 開啟時，成功但沒有 session 會返回 login mode並顯示檢查信箱訊息，不會直接進 member mode。
- 重複 email 使用與一般 confirmation 相同的 generic response，不洩漏帳號是否存在。這符合官方 `signUp()` 對既有帳號可能隱藏資訊的行為：[JavaScript signUp](https://supabase.com/docs/reference/javascript/auth-signup)。
- Repository 沒有 Confirm Password input，因此沒有虛構或新增該欄位。

驗證層級：

- Valid sign-up response、confirmation-required、immediate-session 分支：automated service tests PASS。
- Weak / invalid / empty：automated tests + real product UI PASS。
- Duplicate account：real product UI 對臨時帳號呼叫 Supabase，generic response PASS。
- 臨時 Auth identity：Dashboard 以 auto-confirm 建立，避免假裝完成無法收信的 confirmation 流程。
- 真正「使用可收信地址註冊 → 點擊確認信」保留為人工測試；本輪沒有使用個人 email。

## 4. Login Implementation

- 使用 `supabase.auth.signInWithPassword({ email, password })`。
- 成功必須同時取得 `session` 與 `user`，才允許 member mode。
- `invalid_credentials` 對錯誤密碼與未知帳號顯示同一訊息，避免帳號枚舉；官方 API 也不保證區分這些情況：[JavaScript signInWithPassword](https://supabase.com/docs/reference/javascript/auth-signinwithpassword)。
- `email_not_confirmed` 顯示先完成信箱驗證，不會進 member mode。
- Network/Auth error 轉為安全 UI result，不讓遊戲 crash，也不回傳 password 或 token。
- 真實 production UI 已使用臨時帳號登入成功。

## 5. Logout Implementation

- `authService.signOut()` 呼叫 Supabase `signOut()`。
- `window.signOutExplorer()` 是既有 Vanilla UI 可綁定的最小 integration point。
- 成功後 session/user/member state 清除，發送 `SIGNED_OUT` 狀態並回到 Auth gate。
- 不刪除 Auth user、Guest LocalStorage、Cloud Save 或任何 Database row。
- Repository 沒有 Logout control，因此本 Phase 沒有自行新增 UI。

## 6. Session Restore

- 啟動時先註冊 auth listener，再呼叫 `getSession()`。
- 有 session：設定 `Game.isGuest=false`、`Game.authUser=session.user`，既有 gate 進入主選單。
- 無 session：保留 Auth gate與 Guest 選項。
- Restore error：顯示安全提示，允許重新登入或 Guest，不 crash。
- 真實 production browser 測試：Login → reload/F5 → 無第二次 login → gate hidden、member main menu visible，PASS。
- `getSession()` 用於 browser persistence；需要向 Auth server 驗證 identity 時另用 `getUser()`。參考 [JavaScript getSession](https://supabase.com/docs/reference/javascript/auth-getsession)。

## 7. Auth State Handling

`onAuthStateChange` callback 本身只 queue downstream state application，沒有在 callback 內等待其他 Auth method。

已處理／驗證：

| Event | Behavior | Evidence |
|---|---|---|
| `INITIAL_SESSION` | restore member or remain unauthenticated | unit + real F5 PASS |
| `SIGNED_IN` | session/user → member state | unit + real service event PASS |
| `TOKEN_REFRESHED` | replace in-memory session/user | unit PASS |
| `SIGNED_OUT` | clear member state and show gate | unit + real service event PASS |
| `PASSWORD_RECOVERY` / `USER_UPDATED` | listener forwards current session | service listener installed；full recovery UI not added |

Supabase 官方建議監聽這些 Auth events，且 callback 應保持同步短小：[onAuthStateChange](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)。

## 8. Guest / Member State

| Mode | Session | `Game.isGuest` | `Game.authUser` | Backend write |
|---|---|---:|---|---:|
| Unauthenticated gate | none | `null` | `null` | none |
| Guest | none | `true` | `null` | none |
| Member | valid | `false` | Supabase user | none in Phase 3 |

Helpers：

- `window.getExplorerAuthSnapshot()`
- `window.getCurrentExplorerSession()`
- `window.getCurrentExplorerUser()`
- `window.isExplorerAuthenticated()`

`Game.authUser` 只是 UI/runtime cache；Database authorization 仍只信任 JWT 與 RLS。

## 9. Email Confirmation Behavior

2026-09-03 對 exact project 的 `/auth/v1/settings` 唯讀查詢結果：

```text
external.email: true
disable_signup: false
mailer_autoconfirm: false
```

因此實際設定為：email/password signup 已開啟、允許註冊、Email confirmation 已啟用。一般 public sign-up 不應直接取得 member session；UI 已依此顯示 verification message。沒有停用或修改遠端安全設定。

Hosted project 預設可要求 email verification，confirmation/reset 依賴可用 SMTP；正式環境應設定 production URL allowlist 與 custom SMTP。參考 [Password-based Auth](https://supabase.com/docs/guides/auth/passwords)。

## 10. Forgot Password Status

已實作：

- `authService.requestPasswordReset(email, { redirectTo })`
- `window.openExplorerPasswordReset(account)`
- 既有 Forgot Password button 的 email validation、loading、generic success/error message
- `authService.updatePassword(password)` 與 `window.updateExplorerPassword(password)` integration point

未新增：reset redirect 後的「設定新密碼」產品 UI。現有 Repository 沒有對應頁面／overlay，而使用者明確禁止大幅新增 UI；正式發布前應由 UI owner決定最小 recovery state。Forgot Password 不阻塞本 Phase 核心 Register/Login/Logout/Session。

## 11. Files Added

| File | Purpose |
|---|---|
| `js/services/auth-service.js` | Auth validation、signUp/signIn/signOut/session/user/reset/update password wrappers |
| `js/backend-bootstrap.js` | Auth composition、listener、session restore、Guest/Member integration points |
| `tests/auth-service.test.mjs` | Auth service positive/negative/security tests |
| `tests/backend-bootstrap.test.mjs` | session/listener/logout/global bridge tests |
| `PHASE_3_REPORT.md` | 本報告 |

真實驗證期間曾使用不含 credentials 的臨時 browser harness；完成後已移除，最終 Repository 中為 0 個 harness files。

## 12. Files Modified

| File | Minimal change | UI/gameplay impact |
|---|---|---|
| `js/login-gate.js` | register mode、validation、loading/error、auth state restore/logout handling | 保留原 gate；不改 CSS/Canvas/game logic |
| `index.html` | account input 明確改為 email；載入 backend module | 無 layout 重構 |
| `vite.config.js` | 排除 module bootstrap，不將其誤算為第 13 支 classic script | 保留原 12-script load invariant |
| `tests/login-gate.test.js` | 增加 register/session/logout/lock/error regression | test only |

沒有修改：`scene.js`、`player.js`、`interaction.js`、`judgement.js`、`tomb.js`、`checkpoint.js`、`objective.js`、`main-menu.js`、`prologue.js`、`puzzle.js`、`css/style.css`、assets 或 migration。

## 13. Tests Added

新增 12 個 Node test cases：

- Register input validation、confirmation、duplicate obfuscation、immediate-session branch
- Login success、wrong/unknown generic handling、empty/unconfirmed handling
- Session/getUser/listener/logout/unsubscribe
- Password reset/update validation、network sanitization
- Bootstrap session restore、async listener boundary、token refresh、logout、redirect sanitization

既有 `login-gate.test.js` 同時擴充：

- Product form login
- Register mode與 confirmation state
- Duplicate submit lock
- Session restore
- Logout returns gate
- Password reset status
- Invalid email
- Guest regression

## 14. Test Results

### Automated Regression

```text
npm.cmd test
37 tests
37 pass
0 fail
```

涵蓋 Auth tests、Supabase client、migration contract，以及所有既有 game regression tests。

### Real Auth Verification

```text
Target Project: sun-main
Project Ref: ujjvdmrenirjxusbtulx
Temporary Auth User Created: yes
Temporary Auth User ID: 60efc835-6528-4d98-b9c7-f6f8bd9f60af
Email confirmed: yes (Dashboard auto-confirm)
Temporary Auth User Deleted: yes (after explicit user approval)
Temporary Auth User Exists After Cleanup: no
game_saves rows after cleanup: 0
```

| Verification | Result | Evidence |
|---|---|---|
| Existing production Login UI | PASS | form → bootstrap → authService → Supabase Auth；gate closed、main menu shown |
| Auth service login | PASS | session + current user returned；ID matched temporary user |
| Session | PASS | valid browser/client session existed |
| F5 restore | PASS | production page reload restored member UI without another login |
| Auth state | PASS | real `SIGNED_IN` and `SIGNED_OUT` observed；unit `TOKEN_REFRESHED` passed |
| JWT identity | PASS | JWT subject matched Supabase Auth User ID |
| Database/RLS identity request | PASS | authenticated `game_saves` SELECT under existing owner RLS returned HTTP success, 0 rows, no error |
| `auth.uid()` chain | PASS | official semantics define `auth.uid()` as request user ID；JWT subject/current user/temp user IDs matched, and the authenticated RLS request succeeded |
| Logout | PASS | `signOut()` success、`SIGNED_OUT`、subsequent `getSession()` null |
| Wrong password | PASS | generic invalid-credentials message、no member session |
| Unknown account | PASS | same generic message as wrong password |
| Invalid/empty input | PASS | blocked safely、no crash |
| Duplicate signup | PASS | actual product UI returned generic confirmation response |
| Guest regression | PASS | no session → Guest → existing main menu |
| Temporary-user cleanup | PASS | Dashboard row removed；`auth.users` existence check false；temporary-user and total `game_saves` counts both 0 |

Supabase documents that `auth.uid()` returns the ID of the user making the database request：[Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)。本輪沒有新增 debug RPC 或修改 schema 來回傳 `auth.uid()`；驗證使用真實 JWT subject、server-validated current user 及 authenticated RLS request 的一致 identity chain。

## 15. Build Result

```text
npm.cmd run build
Vite 5.4.21
49 modules transformed
Build: PASS
```

- Auth module bundle：`dist/assets/app-DCuKNukJ.js`，HTTP 200。
- Supabase bundle：`dist/assets/supabase-client-XWrmS8Dm.js`。
- 12 支既有 classic game scripts 全數保留並複製。
- Root HTML、Auth module bundle、`dist/js/login-gate.js` HTTP smoke 均為 200。
- Vite 對 12 支 classic scripts 顯示既有「不能 bundle without type=module」warning；這是 Phase 2 已核准的保留策略，不是 build failure。

## 16. Security Checks

| Check | Result |
|---|---|
| Exact project guard | PASS；只使用 `ujjvdmrenirjxusbtulx` |
| Credentials written to repo/report/env/source | none |
| Email/password/token printed | none |
| Secret/service-role/database password exposure | none |
| Secret-pattern scan | 0 findings |
| Password LocalStorage/SessionStorage/IndexedDB scan | 0 findings |
| Password console logging scan | 0 findings |
| Client key type | browser publishable key only |
| Account enumeration | wrong/unknown login identical；duplicate signup generic |
| Duplicate submit | locked |
| Other Supabase projects modified | none |
| Database schema/data mutation | 0；no `game_saves` were created |
| Temporary Auth user cleanup | PASS；specified UUID no longer exists；total `game_saves` remains 0 |
| Temporary browser harness | removed；0 residual files |

Session/JWT 由 Supabase client 管理。沒有 custom token、fake token 或手動 credential persistence。Supabase Auth client預設可以持久化 browser session：[JavaScript Auth overview](https://supabase.com/docs/reference/javascript/auth)。

## 17. Manual Test Instructions

1. 執行 `npm.cmd run dev`，開啟顯示的 localhost URL。
2. 點「建立帳號」，使用可收信的測試 email 與至少 6 字元密碼。
3. 確認畫面回到 login mode並提示檢查信箱；到信箱完成 Email confirmation。
4. 回到網站，輸入同一組 email/password，點「載入探勘紀錄」。
5. 確認進入既有主選單；F5，確認仍直接顯示會員主選單。
6. 目前沒有 Logout UI；在 browser console 執行 `await window.signOutExplorer()`，確認回到 Auth gate。此 integration point供未來既有 UI control 綁定。
7. 點「以訪客身分進入」，確認仍可進主選單、開始遊戲與使用原本 LocalStorage checkpoint。
8. 另測錯誤密碼、未知 email、空欄位與弱密碼，確認只在既有 status area顯示錯誤且不 crash。

注意：confirmation/reset redirect URL 必須先列入 Supabase Auth URL Configuration。正式部署 hostname 尚未確定，因此發布前必須補 production URL allowlist。

## 18. Remaining Risks

1. **Full email delivery未自動化**：真實 project 已確認 Email confirmation 啟用；本輪不使用個人 email，因此沒有假裝驗證收信／點信流程。
2. **Password recovery UI**：寄信 service與 update-password integration point 已完成，但現有 UI 沒有 recovery redirect state；正式發布前需 UI owner核准最小畫面。
3. **Production URL / SMTP**：正式 hostname、redirect allowlist與 custom SMTP 尚未提供；Supabase 預設寄信服務僅適合測試。
4. **No Git metadata**：目前資料夾仍不是 Git repository，無法提供 branch/diff/commit 或 Git rollback evidence。
5. **No Logout control**：功能已存在並通過測試，但一般使用者目前沒有可見按鈕；依本 Phase指示沒有自行新增 UI。

## 19. Ready for Phase 4?

**Functional gate：YES。** Register、Login、Logout、Session Restore、Auth State、Guest/Member、error handling、secret safety、game regression、production build與 real Supabase Auth verification均通過。

**Workflow gate：YES — Phase 3 Complete。** 臨時 Auth User 已在使用者明確批准後刪除，Dashboard 與 database verification 都確認 user 不存在、`game_saves` 總數仍為 0。本輪依指示 STOP；Phase 4 必須等待下一次明確批准才可開始。

```text
Phase 4 Cloud Save / Cloud Load: NOT STARTED
game_saves INSERT / UPDATE: 0
Guest → Member save migration: NOT STARTED
```
