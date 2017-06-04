var grid;

class TaskGrid {
    constructor() {
        //TODO bring this EditableGrid class into the TS fold
        grid = new EditableGrid("task-list");
        grid.enableSort = false;
        //TODO move these functions to their own home
        //TODO combine these functions into a common thing, they are the same currently
        grid.editorCancelled = function (rowIndex, columnIndex, element) {
            //get the task for the element
            //convert to rowId to get the correct ID in the task list
            console.log("editor cancelled, will delete task if new");
            var rowId = grid.getRowId(rowIndex);
            var columnName = this.getColumnName(columnIndex);
            var currentTask = mainTaskList.tasks[rowId];

            //need to add a check here for hash tags
            if (columnName === "description" && currentTask.description === "new task") {
                //reset the fields before setting them again

                console.log("task was deleted");
                currentTask.removeTask();

                saveTaskList(false);
                renderGrid();
            }
        };

        grid.editorBlurred = function (rowIndex, columnIndex, element) {
            //get the task for the element
            //convert to rowId to get the correct ID in the task list
            var rowId = grid.getRowId(rowIndex);
            var columnName = this.getColumnName(columnIndex);
            var currentTask = mainTaskList.tasks[rowId];

            //need to add a check here for hash tags
            if (columnName === "description" && currentTask.description === "new task") {
                //reset the fields before setting them again

                console.log("task was deleted");
                currentTask.removeTask();

                saveTaskList(false);
                renderGrid();
            }

            //TODO come up with a unified fix here
            //this handles the disappearing comments
            renderGrid();
        };

        grid.modelChanged = function (rowIndex, columnIndex, oldValue, newValue, row) {
            //TODO update this call to handle validation

            //convert to rowId to get the correct ID in the task list
            var rowId = grid.getRowId(rowIndex);
            var columnName = this.getColumnName(columnIndex);
            var currentTask = mainTaskList.tasks[rowId];

            //this will update the underlying data
            currentTask[columnName] = newValue;
            currentTask.isFirstEdit = false;

            //need to add a check here for hash tags
            if (columnName === "description") {
                //reset the fields before setting them again
                currentTask.tags = [];
                currentTask.milestone = null;
                currentTask.status = null;

                //check for "#"
                //split on space
                var parts = newValue.split(" ");
                var tags = [];
                _.each(parts, function (part) {
                    switch (part[0]) {
                        case "#":
                            var tag = part.substring(1);
                            tags.push(tag);
                            break;
                        case "@":
                            currentTask.status = part.substring(1);
                            break;
                        case "!":
                            currentTask.milestone = part.substring(1);
                            break;
                    }
                });

                currentTask.tags = tags;
            }

            saveTaskList();
            renderGrid();

            if (shouldAddTaskWhenDoneEditing && columnName === "description") {
                var options = {
                    parentTask: currentTask.parentTask,
                    sortOrder: currentTask.sortOrder + 0.5
                };
                createNewTask(options);
                shouldAddTaskWhenDoneEditing = false;
            }
        };
    }
    getGrid() {
        return grid;
    }
}