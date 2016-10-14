//these requires are needed in order to load objects on the Browser side of things
var Task = require("./js/Task.js");
var TaskList = require("./js/TaskList.js");

var app = require('electron').remote;
var dialog = app.dialog;

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

//check if the filename is already in the list
function addFileToRecentFileList(fileName) {
    _.remove(recentFiles, function (item) {
        return (item == fileName);
    })
    recentFiles.unshift(fileName);
    console.log(recentFiles);
    //if not, add to the top of the list

    localStorage.setItem("recentFiles", JSON.stringify(recentFiles));
    updateRecentFileButton();
}

function updateRecentFileButton() {

    if (recentFiles.length > 0) {
        $("#recentFileGroup ul").empty();
    }

    _.each(recentFiles, function (sortDir) {
        console.log("sort dir", sortDir)
        var label = $("<li/>").appendTo("#recentFileGroup ul")
        var aDom = $("<a/>").attr("href", "#").text(sortDir).appendTo(label);

        //set up a click event on the LABEL... does not work for the input
        $(label).on("click", function (ev) {
            //this seems to be opposite of the actual value
            console.log("label was clicked", sortDir)
            TaskList.load(sortDir, loadTaskListCallback);
        })
    });
}

function loadTaskListCallback(loadedTaskList) {
    mainTaskList = loadedTaskList;
    _.each(visibleColumns, function (columnName) {
        mainTaskList.columns[columnName].active = true;
    })
    renderGrid();
}

function setupMainPageTasks() {
    //this is currently a dumping ground to get events created

    //create a blank task list to start
    mainTaskList = new TaskList();

    //set up the grid related events
    grid = new EditableGrid("task-list");
    grid.modelChanged = function (rowIndex, columnIndex, oldValue, newValue, row) {
        //TODO update this call to handle validation
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
        renderGrid();
    };


    $("#loader").on("click", function () {
        //set the list object
        dialog.showOpenDialog(function (fileName) {
            if (fileName === undefined) {
                console.log("no file chosen")
                return false;
            }

            fileName = fileName[0];
            console.log("folder", fileName);

            TaskList.load(fileName, loadTaskListCallback);

            addFileToRecentFileList(fileName);
        });
    });

    //load the recentfile list from localStorage
    recentFiles = JSON.parse(localStorage.getItem("recentFiles"));
    console.log("recentFiles", recentFiles);
    updateRecentFileButton();

    visibleColumns = JSON.parse(localStorage.getItem("visibleColumns"));
    if (visibleColumns == null) {
        visibleColumns = ["description"];
    }
    console.log("visibleColumns", visibleColumns);

    //TODO extract this code to a new function call
    //set up the column chooser
    _.each(mainTaskList.getListOfColumns(), function (columnName) {
        //create the label and the actual input element
        var label = $("<label/>").appendTo("#columnChooser").text(columnName).attr("class", "btn btn-primary");
        var inputEl = $("<input/>").attr("type", "checkbox").prop("checked", true).appendTo(label);

        if (visibleColumns.indexOf(columnName) > -1) {
            console.log("adding column, ", columnName);
            label.addClass("active");
            mainTaskList.columns[columnName].active = true;
        }

        //set up a click event on the LABEL... does not work for the input
        $(label).on("click", function (ev) {

            //this seems to be opposite of the actual value
            var isActive = !$(this).hasClass("active")
            mainTaskList.columns[columnName].active = isActive;

            if (isActive) {
                visibleColumns.push(columnName);
            }
            else {
                _.remove(visibleColumns, function (item) {
                    return item == columnName;
                })
            }

            //update the local storage
            localStorage.setItem("visibleColumns", JSON.stringify(visibleColumns));

            renderGrid();
        })

        //this adds the column to the sort selection
        var label = $("<label/>").appendTo("#sortChooser").text(columnName).attr("class", "btn btn-primary");
        var inputEl = $("<input/>").attr("type", "radio").appendTo(label);

        //set up a click event on the LABEL... does not work for the input
        $(label).on("click", function (ev) {
            //this seems to be opposite of the actual value
            mainTaskList.sortField = columnName;
            renderGrid();
        })
    });

    //create the asc/desc buttons
    var sortDirs = ["asc", "desc"];
    _.each(sortDirs, function (sortDir) {
        var label = $("<label/>").appendTo("#sortChooser").text(sortDir).attr("class", "btn btn-info");
        var inputEl = $("<input/>").attr("type", "radio").appendTo(label);

        //set up a click event on the LABEL... does not work for the input
        $(label).on("click", function (ev) {
            //this seems to be opposite of the actual value
            mainTaskList.sortDir = sortDir;
            renderGrid();
        })
    });

    //set up events for the search box
    $("#btnClearSearch").on("click", function (ev) {
        var searchBox = $("#txtSearch")
        //clear the search box
        searchBox.val("");

        //reset the search filter
        mainTaskList.searchTerm = "";

        //render again
        renderGrid();
    });

    $("#txtSearch").on("keyup", function (ev) {
        //this needs to do the active search
        //set a filter

        //find the ESC key
        if (ev.keyCode == 27) {
            $(this).val("");
        }

        mainTaskList.searchTerm = $(this).val();

        //render again
        renderGrid();

        //possibly put in a delay so it doesnt rip around
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
            currentID = parseInt(currentID);

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

            var editor = e.target.celleditor;
            //if editing or a change was made, apply that change
            // backup onblur then remove it: it will be restored if editing could not be applied
            e.target.onblur_backup = e.target.onblur;
            e.target.onblur = null;
            if (editor.applyEditing(e.target.element, editor.getEditorValue(e.target)) === false) {
                e.target.onblur = e.target.onblur_backup;
            }

            //the relationship is known... rerender?
            mainTaskList.save()
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
            currentID = parseInt(currentID);

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

            var editor = e.target.celleditor;
            //if editing or a change was made, apply that change
            // backup onblur then remove it: it will be restored if editing could not be applied
            e.target.onblur_backup = e.target.onblur;
            e.target.onblur = null;
            if (editor.applyEditing(e.target.element, editor.getEditorValue(e.target)) === false) {
                e.target.onblur = e.target.onblur_backup;
            }


            //the relationship is known... rerender?
            mainTaskList.save()
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
            currentID = parseInt(currentID);

            //now holds the current ID
            var currentTask = mainTaskList.tasks[currentID];

            currentTask.sortOrder -= 1.1;

            //need to cancel the editing before rendering to avoid a change being fired            
            //NOTE that these two calls always appear together... not sure why the onblur is nulled
            var editor = e.target.celleditor;
            //if editing or a change was made, apply that change
            // backup onblur then remove it: it will be restored if editing could not be applied
            e.target.onblur_backup = e.target.onblur;
            e.target.onblur = null;
            if (editor.applyEditing(e.target.element, editor.getEditorValue(e.target)) === false) {
                e.target.onblur = e.target.onblur_backup;
            }

            mainTaskList.save()
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
            currentID = parseInt(currentID);

            //now holds the current ID
            var currentTask = mainTaskList.tasks[currentID];

            console.log("current task", currentTask)

            currentTask.sortOrder += 1.1;

            //need to cancel the editing before rendering to avoid a change being fired            
            //NOTE that these two calls always appear together... not sure why the onblur is nulled
            var editor = e.target.celleditor;
            //if editing or a change was made, apply that change
            // backup onblur then remove it: it will be restored if editing could not be applied
            e.target.onblur_backup = e.target.onblur;
            e.target.onblur = null;
            if (editor.applyEditing(e.target.element, editor.getEditorValue(e.target)) === false) {
                e.target.onblur = e.target.onblur_backup;
            }

            mainTaskList.save()
            renderGrid();
            grid.editCell(grid.getRowIndex(currentID), 0)
        }
    })

    Mousetrap.bind("alt+a", function (e) {
        console.log("new task requested");

        var options = {};

        if (e.target.tagName == "INPUT") {



            //we have a text box
            console.log(e.target.parentElement.parentElement.id)
            //this contains "task-list_13"


            var currentID = e.target.parentElement.parentElement.id;
            currentID = currentID.split("task-list_")[1];
            currentID = parseInt(currentID);

            //now holds the current ID
            var currentTask = mainTaskList.tasks[currentID];

            console.log(currentID);
            console.log(currentTask);

            //have the task be below the current one
            options.sortOrder = currentTask.sortOrder + 0.5;
            options.parentTask = currentTask.parentTask;

            var editor = e.target.celleditor;
            //if editing or a change was made, apply that change
            // backup onblur then remove it: it will be restored if editing could not be applied
            e.target.onblur_backup = e.target.onblur;
            e.target.onblur = null;
            if (editor.applyEditing(e.target.element, editor.getEditorValue(e.target)) === false) {
                e.target.onblur = e.target.onblur_backup;
            }
        }

        createNewTask(options);
        return false;
    });

    Mousetrap.prototype.stopCallback = function (a, b, c) {
        //this lets the shortcuts go through whenever
        return false;
    }

    $("#saver").on("click", function () {
        //save the tasklist object
        //TODO update the recent places with this new saved path
        if (mainTaskList.path == "") {
            dialog.showSaveDialog(function (fileName) {

                if (fileName === undefined) {
                    console.log("dialog was cancelled");
                    return false;
                }

                console.log(fileName);
                mainTaskList.path = fileName;

                mainTaskList.save();

                addFileToRecentFileList(fileName);
            })
        }

        mainTaskList.save();
    })

    $("#newTask").on("click", function () {
        //create a new task, stick at the end, and engage the editor
        createNewTask();
    })

    $("#newTasklist").on("click", function () {
        //create a new task, stick at the end, and engage the editor
        mainTaskList = new TaskList();
        createNewTask();
    })

    //bind events for the sort button click
    $("#isSortEnabled").on("click", function (ev) {

        //TODO determine why bootstrap states are reversed in events... too early detection?
        //the button states are reversed when coming through
        var isSortEnabled = !($(this).attr("aria-pressed") === 'true');
        mainTaskList.isSortEnabled = isSortEnabled;

        renderGrid();
    });

    //bind events for the sort button click
    $("#btnSortNow").on("click", function (ev) {

        //TODO determine why bootstrap states are reversed in events... too early detection?
        var currentSetting = mainTaskList.isSortEnabled;
        mainTaskList.isSortEnabled = true;
        renderGrid();
        mainTaskList.isSortEnabled = currentSetting;
    });

    function createNewTask(options = {}) {
        var newTask = mainTaskList.getNew();
        newTask.description = "new task";

        _.assign(newTask, options);

        //assign child for the parent
        if (newTask.parentTask != null) {
            mainTaskList.tasks[newTask.parentTask].childTasks.push(newTask.ID);
        }

        renderGrid();
        grid.editCell(grid.getRowIndex(newTask.ID), 0)
    }

    createNewTask();
}