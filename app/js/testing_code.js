//these requires are needed in order to load objects on the Browser side of things
var Task = require("./js/Task.js");
var TaskList = require("./js/TaskList.js");
var jQuery = require("jquery")
var _ = require("lodash")

//TODO clean this section up to hide these variables
//delcare any local/global variables
var grid;

function entryPoint() {
    //this is equal to the onLoad event for the body
    setupMainPageTasks();

    mainTaskList = new TaskList();
}

function renderGrid() {
    grid.load(mainTaskList.getGridDataObject());
    grid.renderGrid("gridList", "testgrid");
}

function setupMainPageTasks() {
    //this is currently a dumping ground to get events created

    $ = require("jquery");

    $("#loader").on("click", function () {
        //set the list object
        TaskList.load(function (loadedTaskList) {
            mainTaskList = loadedTaskList;

            //get the tasks from the main list and render here
            console.log(mainTaskList.getGridDataObject());

            //TODO pull this initialziation code out of this single event
            grid = new EditableGrid("task-list");

            grid.modelChanged = function (rowIndex, columnIndex, oldValue, newValue, row) {
                //TODO update this call to handle validation
                //TODO allow this to delete the task if the name is blank
                console.log("Value for '" + this.getColumnName(columnIndex) +
                    "' in row " + this.getRowId(rowIndex) +
                    " has changed from '" + oldValue +
                    "' to '" + newValue + "'");

                //convert to rowId to get the correct ID in the task list
                var rowId = grid.getRowId(rowIndex);

                if (columnIndex == 0 && newValue == "") {
                    //delete the current item, it has been blanked
                    mainTaskList.removeTask(rowId);
                    grid.remove(rowIndex);
                }
                else {
                    //this will update the underlying data
                    mainTaskList.tasks[rowId][this.getColumnName(columnIndex)] = newValue
                }

                mainTaskList.save()
            };

            renderGrid();
        });
    });

    Mousetrap.bind("alt+right", function (e) {
        console.log("indent right requested");
        console.log(e)

        if (e.target.tagName == "INPUT") {
            //we have a text box
            console.log(e.target.parentElement.parentElement.id)
            //this contains "task-list_13"


            var currentID = e.target.parentElement.parentElement.id;
            currentID = currentID.split("task-list_")[1];

            //now holds the current ID
            var currentTask = mainTaskList.tasks[currentID];

            console.log(currentID);
            console.log(currentTask);

            //need to get the task located above the current one (0 index)
            var currentRow = grid.getRowIndex(currentID);

            //get the task above the current

            var aboveId = grid.getRowId(currentRow - 1);
            var aboveTask = mainTaskList.tasks[aboveId];

            console.log(aboveTask);


            //remove the current parent if it exists
            if (currentTask.parentTask != null) {
                var parentTask = mainTaskList.tasks[currentTask.parentTask];
                var parentChildIndex = parentTask.childTasks.indexOf(currentID);
                parentTask.childTasks.splice(parentChildIndex, 1);
            }

            //need to set the parent for the current and the child for the above
            currentTask.parentTask = aboveId;
            aboveTask.childTasks.push(currentID);

            //the relationship is known... rerender?
            renderGrid();
            grid.editCell(currentRow, 0)
        }
    })
    Mousetrap.bind("alt+left", function (e) {
        console.log("indent left requested");
        console.log(e)

        //indent left should put the current task under the level 
        //parent -> task -> current task, should be a child of parent
        //parent -> current task, should just null out the parent

        //remove this node from the childTasks of the current parent
        //check the parent of the parent and make them equal
        //add this node to the child nodes of that parent if it exists

        if (e.target.tagName == "INPUT") {
            //we have a text box
            console.log(e.target.parentElement.parentElement.id)
            //this contains "task-list_13"


            var currentID = e.target.parentElement.parentElement.id;
            currentID = currentID.split("task-list_")[1];

            //now holds the current ID
            var currentTask = mainTaskList.tasks[currentID];

            console.log(currentID);
            console.log(currentTask);

            //need to get the task located above the current one (0 index)
            var currentRow = grid.getRowIndex(currentID);

            //get the task above the current

            if (currentTask.parentTask == null) {
                return;
            }

            var aboveId = currentTask.parentTask;
            var aboveTask = mainTaskList.tasks[aboveId];

            console.log(aboveTask);

            //need to set the parent for the current and the child for the above
            console.log("childTasks of above task before:")
            console.log(aboveTask.childTasks)
            //get index of self in children of parent task and remove from current parent
            var parentChildIndex = aboveTask.childTasks.indexOf(currentID);
            aboveTask.childTasks.splice(parentChildIndex, 1);
            console.log("childTasks of above task:")
            console.log(aboveTask.childTasks)

            //get the new parent
            //grandparent
            var grandparentID = aboveTask.parentTask;
            console.log(grandparentID)
            console.log(mainTaskList)
            currentTask.parentTask = grandparentID;
            if (grandparentID != null) {
                var grandparentTask = mainTaskList.tasks[grandparentID];
                grandparentTask.childTasks.push(currentID);

                console.log("grandparent task after adding", grandparentTask)
            }

            console.log("currentTask after all")
            console.log(currentTask)


            //the relationship is known... rerender?
            renderGrid();
            grid.editCell(currentRow, 0)
        }
    })

    Mousetrap.bind("alt+up", function (e) {
        console.log("move up requested");
        console.log(e)

        //need to change the sort order to be one less than the task above the current one but at the same indent level
        //sort orders will be corrected to be sequential, so just need to get a number between the two spots

        if (e.target.tagName == "INPUT") {
            //we have a text box
            console.log(e.target.parentElement.parentElement.id)
            //this contains "task-list_13"

            var currentID = e.target.parentElement.parentElement.id;
            currentID = currentID.split("task-list_")[1];

            //now holds the current ID
            var currentTask = mainTaskList.tasks[currentID];

            currentTask.sortOrder -= 1.1;
            
            //need to cancel the editing before rendering to avoid a change being fired            
            //NOTE that these two calls always appear together... not sure why the onblur is nulled
            e.target.onblur = null
            e.target.celleditor.cancelEditing(e.target.element) ;

            renderGrid();
            grid.editCell(grid.getRowIndex(currentID), 0)
        }
    })

    Mousetrap.bind("alt+down", function (e) {
        console.log("move down requested");
        console.log(e)

        //need to change the sort order to be one less than the task above the current one but at the same indent level
        //sort orders will be corrected to be sequential, so just need to get a number between the two spots

        if (e.target.tagName == "INPUT") {
            //we have a text box
            console.log(e.target.parentElement.parentElement.id)
            //this contains "task-list_13"

            var currentID = e.target.parentElement.parentElement.id;
            currentID = currentID.split("task-list_")[1];

            //now holds the current ID
            var currentTask = mainTaskList.tasks[currentID];

            currentTask.sortOrder += 1.1;
            
            //need to cancel the editing before rendering to avoid a change being fired            
            //NOTE that these two calls always appear together... not sure why the onblur is nulled
            e.target.onblur = null
            e.target.celleditor.cancelEditing(e.target.element) ;

            renderGrid();
            grid.editCell(grid.getRowIndex(currentID), 0)
        }
    })

    Mousetrap.prototype.stopCallback = function (a, b, c) {
        //this lets the shortcuts go through whenever
        return false;
    }

    $("#saver").on("click", function () {
        //save the tasklist object
        mainTaskList.save();
    })

    $("#newTask").on("click", function () {
        //create a new task, stick at the end, and engage the editor
        var newTask = mainTaskList.getNew();
        newTask.description = "new task";

        renderGrid();
        grid.editCell(grid.getRowIndex(newTask.ID), 0)
    })
}