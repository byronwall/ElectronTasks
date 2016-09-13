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