---
description: 啟動 Antigravity 自動修復迴圈
---

# For Loop Workflow

這個 Workflow 用於啟動自動修復迴圈。它會調用底層的 shell 腳本來執行測試和迭代。

## 步驟

1. **解析參數**
   - 接收用戶輸入的任務描述和選項
   - 預設最大迭代次數: 10
   - 預設完成標記: DONE

2. **執行啟動腳本**
   - 執行: `bash ./commands/for-loop.sh "{{args}}"`
   - 該腳本會建立狀態檔案並初始化 Git 分支

3. **開始迭代**
   - 進入代碼生成與測試循環
   - 使用 Stop Hook (`hooks/on_stop.sh`) 攔截過早退出
