
For each feature write tests, check compilation, when done create a commit

Always start by marking the task as started using / 
Mark task as done after doing it

Add status and infos to the file- to sum up what was done and what is left to do

[x]  Advanced Ralph Loops for antigravity
    [x] Loop should use configurable file to save infos on the state of the execution
    [x] I want to be able to configure a prompt (configurable, templetable) for pre-start - it should run agent before the loop starts and it shuold update state file
    [x] I want to be able to configure a prompt (configurable, templetable) for pre-iteration - it should run agent before each iteration and it shuold update state file
    [x] I want to be able to configure a prompt (configurable, templetable) for post-iteration - it should run agent after each iteration and it shuold update state file
    [x] I want to be able to configure a prompt (configurable, templetable) for pre-stop - it should run agent after the loop stops and it shuold update state file
    [x] Loop starting prompt should be entered in side panel and then loop should be started - with all features enables - default prompt should be "Read tasks.md, pick next available task, do it and update tasks.md with result"