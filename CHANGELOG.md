# [Unreleased]

## Added

- `MOD+P` new keyboard shortcut to open print dialog
- Notifications added for:
  - Sorting a task list

## Changed

- Remove default priority (was previously 5, now "")
- Remove "(min)" from duration column
- `launch.json` supports debugging within VS Code
- All unique source code was converted to TypeScript

## Fixed

- Clear `isProjectRoot` flag when moving a project to be a subtask
- Clear search when isolating task via action button (already cleared when using keyboard shortcut)
- Clicking on `all projects` throws an error.  Was checking for `undefined` instead of `null` when rendering

## Removed

- A large amount of old dependencies were removed (typings, gulp, etc.)