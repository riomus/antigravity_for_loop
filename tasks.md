
For each feature write tests, check compilation, when done create a commit

Always start by marking the task as started using / 
Mark task as done after doing it

Add status and infos to the file- to sum up what was done and what is left to do

[x]  Create side panel with all options
    [x]  create basic side panel
    [x]  add possibility to customize all the prompts
    [x]  add CDP status inf
    [x]  add continuation enforcer status info
    [x]  add possibility to enable/disable continuation enforcer
    [x]  add info on the loop - status - internals etc 
    [x]  add possibility to stop the loop
    [x]  add possibility to pause the loop 
    [x] show progress bar of the loop with current iteration and max iterations + logs
    [x] add possibility to change all prompts (Ralph Loop templates)
        [x] Update RalphLoop.js to support prompt templates
        [x] Update SidebarProvider.js to add prompt template editor
        [x] Update extension.js to persist and pass prompt templates
    [x] Fix Loop UI logic
        [x] Hide Start button when running
        [x] Disable/Hide Pause/Resume when not running
        [x] Color progress bar based on status (Red/Green)
    [x] Add Model Quota Limit Handling
        [x] Add detection for "Model quota limit exceeded" error
        [x] Parse resumption date from error message
        [x] Implement wait loop in RalphLoop
        [x] Add configuration UI in Sidebar