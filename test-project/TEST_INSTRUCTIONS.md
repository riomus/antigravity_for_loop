# 測試指南：驗證 AI 能否持續執行

## 目標

驗證 Antigravity For Loop 插件能否讓 AI **持續執行**直到測試通過。

## 測試檔案

- `src/broken.js` - 有 3 個故意的錯誤：
  1. 缺少分號
  2. `reutrn` 拼寫錯誤（應該是 `return`）
  3. `if (b = 0)` 錯誤（應該是 `===`）

- `test.js` - 測試檔案，會在錯誤修復前失敗

## 測試步驟

### 步驟 1：安裝擴展

```bash
code --install-extension ../antigravity-for-loop-0.2.0.vsix
```

### 步驟 2：用 Antigravity IDE 開啟 test-project

```bash
cd test-project
antigravity .
```

### 步驟 3：啟動迴圈

在 Antigravity 中執行（或點擊狀態欄）：

```
/for-loop "修復 src/broken.js 中的所有錯誤，讓 npm test 通過" --max-iterations 10
```

### 步驟 4：觀察 AI 行為

**預期行為：**

1. AI 嘗試修復錯誤
2. AI 執行 `bash ./commands/check-completion.sh`
3. 腳本輸出 `CONTINUE: 測試失敗`
4. AI **繼續**修復（不應該停止）
5. 重複 1-4 直到測試通過
6. 腳本輸出 `DONE`
7. AI 停止

**錯誤行為：**

- AI 說「我修好了」就停止（沒有執行 check-completion.sh）
- AI 執行了 check-completion.sh 但無視 `CONTINUE` 輸出

## 驗證成功的標準

1. ✅ `npm test` 通過（exit code 0）
2. ✅ AI 執行了多次迭代（至少 2-3 次）
3. ✅ AI 每次修改後都執行了 `check-completion.sh`
4. ✅ AI 只在看到 `DONE` 後才停止

## 手動驗證

測試結束後，執行：

```bash
npm test
```

應該看到：
```
✓ add(2, 3) = 5
✓ subtract(5, 3) = 2
✓ multiply(4, 3) = 12
✓ divide(10, 2) = 5
✓ divide by zero throws

結果: 5 passed, 0 failed
```

## 記錄結果

請回報：
- [ ] Auto-Accept 是否正常運作？
- [ ] AI 是否遵守 `CONTINUE` 指令繼續執行？
- [ ] AI 是否在 `DONE` 後才停止？
- [ ] 總共執行了幾次迭代？
