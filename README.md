# 🌞 太陽之心：法老王的封印 (Heart of the Sun)

一座未曾記載於任何探勘文獻的古埃及地下神殿，橫亙在探險家亞倫・卡特的眼前。  
封印已經啟動，長廊入口崩塌封死——唯有破解拉神石像與四大祭壇的古老箴言，方能重見天日！

---

## 🎮 遊戲特色

- **電影級開場過場動畫**：全螢幕震動、動態落石物理粒子、鏡頭特寫平移、古墓沉浸式語音宣告。
- **神殿探索與解謎**：橫向卷軸 3600px 埃及長廊、古代壁畫、審判石碑、長明火把暗格、四大祭壇石板安放。
- **原創視覺與動態音效**：HTML5 Canvas 繪圖渲染、自定義 Sprite 動畫、Web Audio API 合成音效與環境光暈。
- **15 分鐘封印倒數計時**：緊迫的古墓逃生體驗。

---

## 🧩 目前開發狀態

目前倉庫以**前端可遊玩 Demo**為主，包含登入／訪客入口、主頁、序章、三個遊戲場景、互動解謎、倒數、背包、場景紀錄與多結局流程。

- 技術：HTML、CSS、JavaScript、HTML5 Canvas、Vite
- 目前紀錄方式：瀏覽器 `localStorage`
- 尚未串接：後端 API、雲端資料庫、會員／登入系統
- 後端將由小組成員後續接手；串接時請優先保留既有 Canvas 遊戲迴圈與前端狀態流程。

登入畫面目前提供可用的訪客流程；正式登入不會偽造成功狀態。後端可實作 `window.authenticateExplorer({ account, password })`，回傳 `{ ok: true, user }` 或 `{ ok: false, message }`。建立帳號與忘記密碼則分別保留 `window.openExplorerRegistration()`、`window.openExplorerPasswordReset(account)` 掛接點。

後端若要接續玩家紀錄，可從 `js/login-gate.js` 的登入入口、`js/checkpoint.js` 的場景存檔，以及 `js/main-menu.js` 的繼續遊戲入口開始整合。

---

## 🕹️ 操作方式

| 按鍵 | 操作說明 |
| :--- | :--- |
| **A / D** 或 **◀ / ▶** | 角色左右移動 |
| **E** | 調查 / 互動 |
| **B** | 開啟／關閉探險背包 |
| **ESC** | 關閉目前面板／跳過開場動畫 |
| **E / 空白鍵 / Enter** | 對話推進 |
| **方向鍵或 A / D，再按 E** | 切換並確認最終選擇 |

---

## 🚀 快速啟動

### 方式一：Node.js 本地伺服器（推薦，支援圖片自動去背）
```bash
node start.js
```
伺服器啟動後將自動在瀏覽器開啟 `http://localhost:8080/`。

### 方式二：Vite 開發模式
```bash
pnpm install
pnpm dev
```

---

## 📁 專案架構

```
太陽之心/
├── assets/         # 遊戲素材 (角色、道具、背景、音效等)
├── css/            # 羊皮紙風格與 HUD 樣式表
├── js/
│   ├── scene.js        # 場景渲染、火把光暈、相機震動與落石系統
│   ├── player.js       # 亞倫物理移動、待機/行走動畫與相機跟隨
│   ├── interaction.js  # 互動判定、對話打字機、開場動畫與 Web Audio
│   ├── judgement.js    # 第二場景、天秤與四座物品祭壇
│   ├── tomb.js         # 第三場景、銅鏡、太陽之心與結局
│   ├── checkpoint.js   # localStorage 場景紀錄與回檔
│   ├── objective.js    # 依遊戲進度更新目前目標
│   ├── main-menu.js    # 主頁、設定與繼續遊戲
│   ├── prologue.js     # 開始遊戲後的序章流程
│   ├── login-gate.js   # 登入／訪客入口與後端認證掛接點
│   └── puzzle.js       # 解謎流程、背包與 15 分鐘計時
├── docs/           # 遊戲企劃書與設計文件
├── tests/          # 自動化測試案例
├── index.html      # 遊戲主入口
├── start.js        # 本地靜態伺服器
└── package.json
```
