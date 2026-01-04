# Antigravity For Loop - 使用指南

## 核心功能

1. **Auto-Accept**：自動接受 AI agent 的操作步驟
2. **Continuation Enforcer**：當測試失敗時自動生成繼續提示詞
3. **Clipboard Integration**：一鍵複製繼續提示詞

## 快速開始

### 安裝

**方法 A：從 VSIX 安裝**
1. 下載 `antigravity-for-loop-x.x.x.vsix`
2. 在 Antigravity IDE 中按 `Cmd+Shift+P` (Mac) 或 `Ctrl+Shift+P` (Windows)
3. 輸入 `Extensions: Install from VSIX`
4. 選擇下載的 .vsix 檔案

**方法 B：從 Open VSX 安裝**（發布後可用）
```
Cmd+Shift+X → 搜尋 "Antigravity For Loop" → 安裝
```

### 驗證安裝成功

安裝後，你應該在右下角狀態欄看到：

```
⏸️ For Loop: Off
```

---

## 基本使用

### 1. 啟動修復迴圈

**透過狀態欄（推薦）**
1. 點擊右下角的 `⏸️ For Loop: Off`
2. 選擇 `Start Loop with Auto-Accept`
3. 輸入任務描述，例如：`修復所有 TypeScript 錯誤`
4. 輸入最大迭代次數（預設 10）

**透過命令面板**
1. 按 `Cmd+Shift+P`
2. 輸入 `Antigravity: Start Fix Loop`

**透過 Shell**
```bash
bash ./commands/for-loop.sh "修復所有 TypeScript 錯誤" --max-iterations 20
```

### 2. 監控進度

狀態欄會顯示當前狀態：

| 顯示 | 意義 |
|------|------|
| `✅ Loop: 3/10` | Auto-Accept 開啟，迭代 3/10 |
| `⏸️ Loop: 3/10` | Auto-Accept 關閉，迭代 3/10 |
| `✅ Loop: Done` | 任務完成 |
| `❌ Loop: Stuck` | 卡住了，需要人工介入 |

### 3. 取消迴圈

**透過狀態欄**
1. 點擊狀態欄
2. 選擇 `Cancel Loop`

**透過 Shell**
```bash
bash ./commands/cancel-loop.sh
```

---

## 快捷鍵

| 快捷鍵 | 功能 |
|--------|------|
| `Cmd+Alt+Shift+A` | 切換 Auto-Accept |
| `Cmd+Alt+Shift+L` | 開啟選單 |
| `Cmd+Alt+Shift+C` | 複製繼續提示詞 |

（Windows 用 `Ctrl` 替換 `Cmd`）

---

## Continuation Enforcer（繼續執行強制器）

### 什麼是 Continuation Enforcer？

當 `check-completion.sh` 輸出 `CONTINUE`（表示測試仍未通過）時，插件會 **自動** 將繼續提示詞注入到 Antigravity AI 對話中。

### 全自動機制

插件使用系統級自動化來實現真正的全自動：

| 平台 | 技術 | 權限要求 |
|------|------|----------|
| macOS | AppleScript + System Events | **需要 Accessibility 權限** |
| Windows | PowerShell + SendKeys | 無 |
| Linux | xdotool + xclip | 需安裝 `xdotool` |

### macOS 權限設定（重要！）

首次使用時，macOS 會要求授予 Accessibility 權限：

1. 打開 **系統偏好設定** → **安全性與隱私** → **隱私權**
2. 選擇 **輔助使用**（Accessibility）
3. 勾選 **Antigravity** 或 **Terminal**（如果從終端啟動）

### 工作流程

1. AI 執行 `check-completion.sh`
2. 腳本輸出 `CONTINUE`（測試未通過）
3. 插件自動：
   - 生成繼續提示詞
   - 複製到剪貼板
   - 模擬鍵盤輸入 Cmd+V 貼上
   - 模擬 Enter 發送
4. AI 收到新提示詞，繼續修復

### Fallback 機制

如果自動注入失敗（例如權限問題），插件會：
1. 將提示詞保留在剪貼板
2. 顯示通知讓你手動貼上

### 手動複製提示詞

如需手動操作：

1. 點擊狀態欄 → 選擇「Copy Continuation Prompt」
2. 或按 `Cmd+Alt+Shift+C`

---

## Auto-Accept 功能

### 什麼是 Auto-Accept？

開啟後，AI 執行的每個步驟（編輯檔案、執行命令）會自動被接受，無需手動點擊確認。

### 何時使用？

- ✅ 執行自動化修復任務時
- ✅ 信任 AI 的操作時
- ❌ 操作敏感檔案時（建議關閉）
- ❌ 第一次使用時（建議先觀察）

### 安全機制

即使開啟 Auto-Accept，以下情況仍需人工確認：
- 刪除檔案操作
- 系統級命令
- 涉及敏感資料的操作

---

## AI 強制規則

當迴圈啟動後，AI 必須遵守以下規則：

### 規則 1：執行 → 檢查 → 繼續

```
1. 修改代碼
2. 執行: bash ./commands/check-completion.sh
3. 根據輸出決定下一步
```

### 規則 2：遵守腳本指令

| 腳本輸出 | AI 動作 |
|---------|---------|
| `DONE` | 可以停止 |
| `CONTINUE: ...` | **禁止停止**，繼續修復 |
| `STUCK: ...` | 停止，報告問題 |

### 規則 3：禁止自作主張

- ❌ 禁止「我覺得改好了」就停止
- ❌ 禁止跳過 `check-completion.sh`
- ❌ 禁止忽略 `CONTINUE` 指令

---

## 常見問題

### Q: 狀態欄沒有顯示 For Loop？

重新載入視窗：`Cmd+Shift+P` → `Developer: Reload Window`

### Q: Auto-Accept 沒有作用？

確認 Antigravity 版本支援 `antigravity.agent.acceptAgentStep` 命令。
在開發者控制台 (`Cmd+Shift+I`) 執行：
```javascript
vscode.commands.executeCommand('antigravity.agent.acceptAgentStep')
```

### Q: 迴圈一直卡住？

1. 檢查測試命令是否正確
2. 查看 `.antigravity/for-loop-state.json` 的 `stuck_count`
3. 嘗試增加 `--stuck-threshold` 值

### Q: 如何查看日誌？

點擊狀態欄 → `View Logs` 或 `Cmd+Shift+P` → `Antigravity: Show Loop Logs`

---

## 進階配置

### 自定義測試命令

```bash
# 使用 pytest
bash ./commands/for-loop.sh "修復測試" --test-command "pytest -v"

# 使用 cargo test
bash ./commands/for-loop.sh "修復 Rust 錯誤" --test-command "cargo test"

# 使用 ESLint
bash ./commands/for-loop.sh "修復 lint 警告" --test-command "npm run lint"
```

### 調整卡住偵測

```bash
# 允許相同錯誤出現 5 次才判定卡住
bash ./commands/for-loop.sh "複雜任務" --stuck-threshold 5
```

---

## 技術支援

- GitHub Issues: [github.com/iml1s/antigravity_for_loop/issues](https://github.com/iml1s/antigravity_for_loop/issues)
- 文檔: 見 `docs/` 目錄
