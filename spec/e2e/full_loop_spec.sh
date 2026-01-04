# spec/e2e/full_loop_spec.sh
# 完整迴圈流程 E2E 測試 (Antigravity 版本)

Describe 'E2E: 完整迴圈流程'
    setup() {
        ANTIGRAVITY_PROJECT_ROOT="${SHELLSPEC_TMPBASE}/test_project"
        export ANTIGRAVITY_PROJECT_ROOT
        mkdir -p "$ANTIGRAVITY_PROJECT_ROOT/.antigravity"
        mkdir -p "$ANTIGRAVITY_PROJECT_ROOT/commands"
        # 複製 check-completion.sh 到測試目錄
        cp ./commands/check-completion.sh "$ANTIGRAVITY_PROJECT_ROOT/commands/"
    }

    cleanup() {
        rm -rf "${SHELLSPEC_TMPBASE}/test_project"
    }

    create_state_file() {
        iteration="${1:-0}"
        max_iterations="${2:-10}"
        test_command="${3:-echo test passed}"

        mkdir -p "$ANTIGRAVITY_PROJECT_ROOT/.antigravity"
        cat > "$ANTIGRAVITY_PROJECT_ROOT/.antigravity/for-loop-state.json" << EOF
{
    "iteration": $iteration,
    "max_iterations": $max_iterations,
    "completion_promise": "DONE",
    "original_prompt": "Test task",
    "test_command": "$test_command",
    "stuck_threshold": 3,
    "stuck_count": 0,
    "last_error_hash": "",
    "branch": "",
    "started_at": "2024-01-01T00:00:00+00:00"
}
EOF
    }

    BeforeEach setup
    AfterEach cleanup

    Describe '啟動與取消流程'
        It '啟動後可成功取消'
            # 啟動迴圈
            source ./commands/for-loop.sh "E2E 測試" --no-branch > /dev/null 2>&1

            When run source ./commands/cancel-loop.sh
            The status should be success
            The output should include '修復迴圈已取消'
        End
    End

    Describe 'check-completion.sh 輸出'
        It '測試通過時輸出 DONE'
            create_state_file 1 10 "echo 'all tests passed'"
            cd "$ANTIGRAVITY_PROJECT_ROOT"

            When run bash ./commands/check-completion.sh
            The status should be success
            The output should include 'DONE'
            The stderr should include '執行測試'
        End

        It '測試失敗時輸出 CONTINUE'
            create_state_file 1 10 "exit 1"
            cd "$ANTIGRAVITY_PROJECT_ROOT"

            When run bash ./commands/check-completion.sh
            The status should be success
            The output should include 'CONTINUE'
            The stderr should include '執行測試'
        End

        It '達到最大迭代次數時輸出 STUCK'
            create_state_file 10 10 "exit 1"
            cd "$ANTIGRAVITY_PROJECT_ROOT"

            When run bash ./commands/check-completion.sh
            The status should be success
            The output should include 'STUCK'
        End
    End
End
