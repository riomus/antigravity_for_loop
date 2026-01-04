# Antigravity For Loop

🔄 **自動迭代修復循環插件** - 讓 AI 代理持續執行開發任務直到通過所有測試或達到迭代上限。

專為 **Google Antigravity IDE** 設計，支援多種 AI 模型（Gemini 3 Pro、Claude Sonnet 4.5、Claude Opus 4.5、GPT-OSS）。

## 功能特色

- **🔁 自動迴圈** - AI 自動執行「編碼 → 測試 → 修復」循環
- **✅ Auto-Accept** - 自動接受 agent 步驟，無需手動確認
- **📜 腳本控制** - 使用 `check-completion.sh` 強制控制停止條件
- **🛡️ 強制規則** - 透過 `.antigravity/rules.md` 強制 AI 遵守迴圈規則
- **⚠️ 卡住偵測** - 自動識別並停止無進展的迴圈
- **🌿 Git 分支管理** - 可選自動建立工作分支保護主線代碼

## 核心機制

### Antigravity 內部命令

本插件使用以下 Antigravity 內部命令實現自動化：

```javascript
// 自動接受 agent 步驟（代碼編輯、文件修改等）
vscode.commands.executeCommand('antigravity.agent.acceptAgentStep');

// 自動接受終端命令請求
vscode.commands.executeCommand('antigravity.terminal.accept');
```

### 強制控制流程

```
┌─────────────┐     ┌─────────────┐     ┌───────────────────┐
│  啟動迴圈   │ ──▶ │  AI 執行    │ ──▶ │ check-completion  │
└─────────────┘     └─────────────┘     └──────────┬────────┘
                           ▲                       │
                           │               ┌───────▼───────┐
                           │               │   輸出結果    │
                           │               └───────┬───────┘
                    ┌──────┴──────┐                │
                    │   CONTINUE  │◀───────────────┤
                    │ (強制繼續)   │                │
                    └─────────────┘                │
                                           ┌───────▼───────┐
                                           │  DONE/STUCK   │
                                           │  (可以停止)   │
                                           └───────────────┘
```

## 安裝

### 方法 1: VSCode 擴展安裝（推薦）

```bash
# 打包擴展
npm run package

# 在 Antigravity IDE 中安裝
code --install-extension antigravity-for-loop-*.vsix
```

### 方法 2: 僅使用 Workflow

將以下檔案複製到您的專案：
- `.agent/workflows/for-loop.md`
- `.antigravity/rules.md`
- `commands/for-loop.sh`
- `commands/check-completion.sh`
- `commands/cancel-loop.sh`

## CDP 設置（重要！）

為了讓 Auto-Accept 和自動注入功能正常運作，Antigravity 需要啟用 CDP (Chrome DevTools Protocol)。

### 自動設置（推薦）

1. 安裝擴展後，會自動顯示提示
2. 點擊 **「Enable CDP」** 按鈕
3. 按照指示重啟 Antigravity

### 手動設置

**macOS:**
```bash
open -a "Antigravity.app" --args --remote-debugging-port=9000
```

**Windows:**
1. 右鍵點擊 Antigravity 捷徑 → 內容
2. 在「目標」欄位末尾加上：`--remote-debugging-port=9000`
3. 點擊確定並重啟

**Linux:**
```bash
antigravity --remote-debugging-port=9000
```

### 驗證 CDP 狀態

- 點擊狀態欄的 **「For Loop」** 按鈕
- 查看選單中的 **「CDP: Enabled」** 或 **「CDP: Not Enabled」**
- 使用 **「Debug CDP」** 檢查連線狀態

## 使用方式

### 快捷鍵

| 快捷鍵 | 功能 |
|--------|------|
| `Cmd+Alt+Shift+A` (Mac) / `Ctrl+Alt+Shift+A` (Windows) | 切換 Auto-Accept |
| `Cmd+Alt+Shift+L` (Mac) / `Ctrl+Alt+Shift+L` (Windows) | 開啟選單 |

### 透過狀態欄

點擊右下角狀態欄的「For Loop」按鈕，開啟快速選單：

- **Toggle Auto-Accept** - 切換自動接受模式
- **Start Loop...** - 啟動新的修復迴圈
- **Start Loop with Auto-Accept** - 啟動迴圈並開啟自動接受
- **Cancel Loop** - 取消當前迴圈
- **Run Check Script** - 手動執行檢查腳本
- **View Logs** - 查看輸出日誌

### 透過命令面板

按 `Cmd+Shift+P` (Mac) 或 `Ctrl+Shift+P` (Windows)，搜尋 "Antigravity"。

### Shell 命令

```bash
# 啟動迴圈
bash ./commands/for-loop.sh "修復所有 TypeScript 錯誤" --max-iterations 20

# 檢查完成狀態
bash ./commands/check-completion.sh

# 取消迴圈
bash ./commands/cancel-loop.sh
```

**選項：**

| 選項 | 預設值 | 說明 |
|------|--------|------|
| `--max-iterations N` | 10 | 最大迭代次數 |
| `--test-command "<cmd>"` | npm test | 測試命令 |
| `--stuck-threshold N` | 3 | 卡住偵測閾值 |
| `--no-branch` | - | 不自動建立 Git 分支 |

## 目錄結構

```
antigravity_for_loop/
├── extension.js                 # VSCode 擴展主程式
├── package.json                 # 擴展清單
├── .agent/
│   └── workflows/
│       └── for-loop.md         # Antigravity Workflow 定義
├── .antigravity/
│   └── rules.md                # AI 強制規則
├── commands/
│   ├── for-loop.sh             # 啟動迴圈命令
│   ├── check-completion.sh     # 檢查完成腳本 (核心!)
│   └── cancel-loop.sh          # 取消迴圈命令
└── docs/
    └── architecture.md         # 架構文檔
```

## AI 強制規則

當 `.antigravity/for-loop-state.json` 存在時，AI 必須遵守以下規則：

### 規則 1：禁止自主停止

- ❌ 禁止說「我認為已經完成」然後停止
- ❌ 禁止跳過測試直接結束

### 規則 2：強制檢查

- ✅ 每次修改代碼後，**必須**執行 `bash ./commands/check-completion.sh`

### 規則 3：遵守腳本指令

| 腳本輸出 | AI 必須執行的動作 |
|---------|-------------------|
| `DONE` | 可以停止，報告完成 |
| `CONTINUE: ...` | **禁止停止**，繼續修復代碼 |
| `STUCK: ...` | 停止，報告陷入死循環 |

## 技術參考

### 發現的 Antigravity 內部命令

透過分析 [antigravity-auto-accept](https://github.com/pesoszpesosz/antigravity-auto-accept) 等插件，發現以下內部命令：

| 命令 | 功能 |
|------|------|
| `antigravity.agent.acceptAgentStep` | 接受 agent 步驟 |
| `antigravity.terminal.accept` | 接受終端命令 |
| `antigravity.refreshQuota` | 刷新配額 |
| `antigravity.openDashboard` | 開啟儀表板 |

### 相關專案

- [antigravity-auto-accept](https://github.com/pesoszpesosz/antigravity-auto-accept) - Auto-accept 參考實作
- [antigravity-usage](https://github.com/example/antigravity-usage) - 配額監控
- [kingmode-mission-control](https://github.com/RekitRex21/kingmode-mission-control) - 任務控制框架

## 安全注意事項

⚠️ **重要提醒：**

- Auto-Accept 開啟時會自動接受所有 agent 操作
- 建議在使用前提交當前工作，以便需要時回滾
- 高風險操作（如刪除文件）仍建議手動確認
- 使用 `--max-iterations` 限制迭代次數以防止無限循環

## 依賴

- `jq` - JSON 處理工具 (必須)
- `git` - 版本控制 (可選，用於分支管理)

## 授權

MIT License

## 貢獻

歡迎提交 Issue 和 Pull Request！

---

**Made for Google Antigravity IDE** 🚀
