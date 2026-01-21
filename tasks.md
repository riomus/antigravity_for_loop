
For each feature write tests, check compilation, when done create a commit

Always start by marking the task as started using / 
Mark task as done after doing it

Add status and infos to the file- to sum up what was done and what is left to do

## Status Update (2026-01-21)

Fixed 21 failing unit tests:
- ✅ StateManager tests (9 tests) - fixed vscode mocking
- ✅ Verification logic tests (2 tests) - removed duplicate injection, fixed keyword usage
- ✅ Post-iteration prompt tests (2 tests) - moved prompt before completion checks
- ✅ Pre-iteration, pre-start, pre-stop tests (6 tests) - all passing

Known issue: Tests pass in isolation but fail when run together due to vscode mock interference between test files.

Remaining work: Fix test interference issue, address remaining 3 unique test failures (quota check, state config, default template).

## Tasks

[ ]  Advanced Ralph Loops for antigravity
    [ ] Before loop is started - agent run with pre-start prompt should be executed- state.md should be updated
    [ ] Before iteration - agent run with pre-iteration prompt should be executed- state.md should be updated
    [ ] After iteration - agent run with post-iteration prompt should be executed- state.md should be updated
    [ ] After loop is stopped - agent run with pre-stop prompt should be executed- state.md should be updated
    [ ] Loop should use configurable file to save infos on the state of the execution - by default in state.md, update default loop template to use state.md
    [ ] loop task default prompt in the ui should be: Read tasks.md, pick next available task, do it and update tasks.md with result
    [x] I want to be able to configure a prompt (configurable, templetable) for pre-start - it should run agent before the loop starts and it shuold update state file
    [x] I want to be able to configure a prompt (configurable, templetable) for pre-iteration - it should run agent before each iteration and it shuold update state file
    [x] I want to be able to configure a prompt (configurable, templetable) for post-iteration - it should run agent after each iteration and it shuold update state file
    [x] I want to be able to configure a prompt (configurable, templetable) for pre-stop - it should run agent after the loop stops and it shuold update state file
    [x] Loop starting prompt should be entered in side panel and then loop should be started - with all features enables - default prompt should be "Read tasks.md, pick next available task, do it and update tasks.md with result"
    [x] For the sidebar - use icon based on image.png 
    [x] Start loop in sidebar is still asking for the prompt
    [x] All prompts in sidebar should have sane defaults:
        - loop-task: Read tasks.md, pick next available task, do it and update tasks.md with result
        - pre-iteration: Update tasks.md to represent current status of the run
        - post-iteration: Check that all tests passes and static analysis passes
        - pre-start: Update tasks.md to be understandable, contain all needed info according to the project, update technical details, improve it as a prompt
        - pre-stop: Update docs and readmes to represent current status of the project
    [ ] Start loop in the side panel should not ask for anything - all params should have sane defaults configurable in the side panel - max iterations, stop condition etc - when i click start loop it should start the loop without any extra steps

[ ] Fix Unit Tests
    [x] Fix StateManager tests (9 tests)
    [x] Fix verification logic tests (2 tests)
    [x] Fix prompt injection tests (10 tests)
    [ ] Fix test interference issue (tests pass in isolation but fail together)
    [ ] Fix remaining unique failures (quota check, state config, default template)