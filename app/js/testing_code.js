//these requires are needed in order to load objects on the Browser side of things
var Task = require("./js/Task.js");
var TaskList = require("./js/TaskList.js");
var DriveStorage = require("./js/DriveStorage.js");

var app = require('electron').remote;
var dialog = app.dialog;

var _ = require("lodash");
var $ = require("jquery");

//TODO clean this section up to hide these variables
//delcare any local/global variables
var grid;
var shouldAddTaskWhenDoneEditing = false;
var shouldDeleteTaskWhenDoneEditing = false;

function entryPoint() {
    //this is equal to the onLoad event for the body
    setupMainPageTasks();

    mainTaskList = new TaskList();
}

function renderGrid() {
    grid.load(mainTaskList.getGridDataObject());
    grid.renderGrid("gridList", "testgrid");

    //add a call to update the "tag" bucket"
    updateTagBucket();
    updateProjectBucket();
    updateStatusBucket();
    updateBreadcrumbs();

    //update the project title
    $("#projectTitle").text(mainTaskList.title);

    //this needs to wire up some button click events
    $(".btnComplete").on("click", function (ev) {
        console.log("task complete button hit");

        //this gets the TR which has the ID in it
        var trElement = $(this).parents("tr")[0];
        //this gets the element, now need to process the button

        var currentID = trElement.id;
        currentID = currentID.split("task-list_")[1];
        currentID = parseInt(currentID);

        //now holds the current ID
        var currentTask = mainTaskList.tasks[currentID];

        //complete the task and update the display
        currentTask.completeTask();
        renderGrid();
        saveTaskList();
    });

    $(".btnDelete").on("click", function (ev) {
        console.log("task delete button hit");

        //this gets the TR which has the ID in it
        var trElement = $(this).parents("tr")[0];
        //this gets the element, now need to process the button

        var currentID = trElement.id;
        currentID = currentID.split("task-list_")[1];
        currentID = parseInt(currentID);

        //now holds the current ID
        var currentTask = mainTaskList.tasks[currentID];
        currentTask.removeTask()
        renderGrid();
        saveTaskList();
        //delete the task and rerender
    })
}

function updateBreadcrumbs() {
    //TODO need to fix variable names
    var projects = mainTaskList.getCrumbs();

    //clear out the tag bucket
    var projectBucket = $("#breadcumbs")
    projectBucket.empty();

    //add a new span for each one
    _.each(projects, function (project) {
        var label = $("<li/>").appendTo(projectBucket)
        var aDom = $("<a/>").attr("href", "#").text(project.description).appendTo(label);

        //set up a click event on the LABEL... does not work for the input
        $(label).on("click", function (ev) {
            mainTaskList.idForIsolatedTask = project.ID;
            renderGrid();
        });
    })
}

function updateProjectBucket() {
    var projects = mainTaskList.getProjectsInList();

    //clear out the tag bucket
    var projectBucket = $("#projectBucket")
    projectBucket.empty();

    var dummyTask = new Task();
    dummyTask.description = "all projects"
    dummyTask.ID = null;
    projects.unshift(dummyTask);

    //add a new span for each one
    _.each(projects, function (project) {
        var label = $("<li/>").appendTo(projectBucket)
        var aDom = $("<a/>").attr("href", "#").text(project.description).appendTo(label);

        if (project.ID == mainTaskList.idForIsolatedTask) {
            label.addClass("active");
        }

        //set up a click event on the LABEL... does not work for the input
        $(label).on("click", function (ev) {
            mainTaskList.idForIsolatedTask = project.ID;
            renderGrid();
        });
    })
}

function updateTagBucket() {
    var tags = mainTaskList.getAllTags().sort();

    //clear out the tag bucket
    var tagBucket = $("#tagBucket")
    tagBucket.empty();

    //add a new span for each one
    _.each(tags, function (tag) {
        var span = $("<span/>").text(tag).appendTo(tagBucket).attr("class", "label label-primary");

        span.on("click", function (ev) {
            //set the search box and call its event handler
            $("#txtSearch").val("tags:" + tag).keyup();

            renderGrid();
            $("#txtSearch").focus();
        });
    })
}

function updateStatusBucket() {
    var tags = mainTaskList.getAllStatus().sort();

    //clear out the tag bucket
    var tagBucket = $("#statusBucket")
    tagBucket.empty();

    //add a new span for each one
    _.each(tags, function (tag) {
        var span = $("<span/>").text(tag).appendTo(tagBucket).attr("class", "label label-info");

        span.on("click", function (ev) {
            //set the search box and call its event handler
            $("#txtSearch").val("status:" + tag).keyup();

            renderGrid();
            $("#txtSearch").focus();
        });
    })
}

//check if the filename is already in the list
function addFileToRecentFileList(fileName) {
    _.remove(recentFiles, function (item) {
        return (item == fileName);
    })
    recentFiles.unshift(fileName);
    //if not, add to the top of the list

    localStorage.setItem("recentFiles", JSON.stringify(recentFiles));
    updateRecentFileButton();
}

function updateRecentFileButton() {

    if (recentFiles.length > 0) {
        $("#recentFileGroup ul").empty();
    }

    _.each(recentFiles, function (fileName) {
        var label = $("<li/>").appendTo("#recentFileGroup ul")
        var aDom = $("<a/>").attr("href", "#").text(fileName).appendTo(label);

        //set up a click event on the LABEL... does not work for the input
        $(label).on("click", function (ev) {
            TaskList.load(fileName, loadTaskListCallback);
        })
    });
}

function loadTaskListCallback(loadedTaskList) {
    mainTaskList = loadedTaskList;
    _.each(visibleColumns, function (columnName) {
        mainTaskList.columns[columnName].active = true;
    })

    //get first project in file and isolate on it
    var projects = mainTaskList.getProjectsInList();
    console.log("loader proj", projects)
    mainTaskList.idForIsolatedTask = projects[0].ID;

    renderGrid();
}

function sortNow() {
    var isSortEnabled = mainTaskList.isSortEnabled;

    mainTaskList.isSortEnabled = true;
    renderGrid();
    mainTaskList.isSortEnabled = isSortEnabled;

    saveTaskList();
}

function createNewTask(options = {}) {
    var newTask = mainTaskList.getNew();
    newTask.description = "new task";

    _.assign(newTask, options);

    //assign child for the parent
    if (newTask.parentTask != null) {
        mainTaskList.tasks[newTask.parentTask].childTasks.push(newTask.ID);
    }

    renderGrid();
    grid.editCell(grid.getRowIndex(newTask.ID), grid.getColumnIndex("description"))
}

function saveTaskList() {
    if (mainTaskList.path == "") {
        dialog.showSaveDialog(function (fileName) {

            if (fileName === undefined) {
                //TODO put this in a real output box
                console.log("dialog was cancelled");
                return false;
            }

            mainTaskList.path = fileName;
            //TODO this is a duplicate piece of code
            mainTaskList.save();
            addFileToRecentFileList(fileName);
        })
    }

    mainTaskList.save();
}

function createNewTasklist() {
    loadTaskListCallback(new TaskList());
    createNewTask();
}

function createNewTask(options = {}) {
    var newTask = mainTaskList.getNew();
    newTask.description = "new task";
    newTask.isFirstEdit = true;

    _.assign(newTask, options);

    //assign child for the parent
    if (newTask.parentTask == null) {
        newTask.parentTask = mainTaskList.idForIsolatedTask;
    }

    if (newTask.parentTask != null) {
        mainTaskList.tasks[newTask.parentTask].childTasks.push(newTask.ID);
    }

    renderGrid();
    grid.editCell(grid.getRowIndex(newTask.ID), grid.getColumnIndex("description"))
}

function createNewTasklist() {
    var newList = TaskList.createNewTaskList();
    loadTaskListCallback(newList);
    createNewTask();
}

function setupMainPageTasks() {
    //this is currently a dumping ground to get events created

    //create a blank task list to start
    mainTaskList = new TaskList();

    //set up the grid related events
    grid = new EditableGrid("task-list");
    grid.modelChanged = function (rowIndex, columnIndex, oldValue, newValue, row) {
        //TODO update this call to handle validation

        //convert to rowId to get the correct ID in the task list
        var rowId = grid.getRowId(rowIndex);
        var columnName = this.getColumnName(columnIndex);
        var currentTask = mainTaskList.tasks[rowId];

        //TODO add this code back in at some point if desired
        if (false && columnIndex == grid.getColumnIndex("description") && newValue == "") {
            //delete the current item, it has been blanked

            //mainTaskList.removeTask(rowId);
            //grid.remove(rowIndex);
        }
        else {
            //this will update the underlying data


            currentTask[columnName] = newValue;
            currentTask.isFirstEdit = false;

            //need to add a check here for hash tags
            if (columnName === "description") {
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
                    }
                });

                currentTask.tags = tags;
            }
        }

        mainTaskList.save()
        renderGrid();

        if (shouldAddTaskWhenDoneEditing && columnName === "description") {
            var options = {
                parentTask: currentTask.parentTask,
                sortOrder: currentTask.sortOrder + 0.5
            }
            createNewTask(options);
            shouldAddTaskWhenDoneEditing = false;
        }
    };

    $("#loader").on("click", function () {
        //set the list object
        dialog.showOpenDialog(function (fileName) {
            if (fileName === undefined) {
                //TODO use an actual output box for this
                console.log("no file chosen")
                return false;
            }

            fileName = fileName[0];

            TaskList.load(fileName, loadTaskListCallback);

            addFileToRecentFileList(fileName);
        });
    });

    //load the recentfile list from localStorage
    recentFiles = JSON.parse(localStorage.getItem("recentFiles"));
    if (recentFiles == null) {
        recentFiles = [];
    }
    updateRecentFileButton();

    visibleColumns = JSON.parse(localStorage.getItem("visibleColumns"));
    if (visibleColumns == null) {
        visibleColumns = ["description"];
    }

    //TODO extract this code to a new function call
    //set up the column chooser
    _.each(mainTaskList.getListOfColumns(), function (columnName) {
        //create the label and the actual input element
        var label = $("<label/>").appendTo("#columnChooser").text(columnName).attr("class", "btn btn-primary");
        var inputEl = $("<input/>").attr("type", "checkbox").prop("checked", true).appendTo(label);

        if (visibleColumns.indexOf(columnName) > -1) {
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

        if (columnName == mainTaskList.sortField) {
            label.addClass("active");
        }

        //set up a click event on the LABEL... does not work for the input
        $(label).on("click", function (ev) {
            //this seems to be opposite of the actual value
            mainTaskList.sortField = columnName;
            sortNow();
        })
    });

    //create the asc/desc buttons
    var sortDirs = ["asc", "desc"];
    _.each(sortDirs, function (sortDir) {
        var label = $("<label/>").appendTo("#sortDirChooser").text(sortDir).attr("class", "btn btn-info");
        var inputEl = $("<input/>").attr("type", "radio").appendTo(label);

        if (sortDir == mainTaskList.sortDir) {
            label.addClass("active");
        }

        //set up a click event on the LABEL... does not work for the input
        $(label).on("click", function (ev) {
            //this seems to be opposite of the actual value
            mainTaskList.sortDir = sortDir;
            sortNow();
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
            $("#txtSearch").blur();
        }

        mainTaskList.searchTerm = $(this).val();

        //render again
        renderGrid();

        //possibly put in a delay so it doesnt rip around
    });

    Mousetrap.bind("mod+right", function (e) {
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
            grid.editCell(currentRow, grid.getColumnIndex("description"))

            return false;
        }
    })
    Mousetrap.bind("mod+left", function (e) {
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
            grid.editCell(currentRow, grid.getColumnIndex("description"))
        }
    })

    Mousetrap.bind("mod+up", function (e) {
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
            grid.editCell(grid.getRowIndex(currentID), grid.getColumnIndex("description"))
        }
    })

    Mousetrap.bind("mod+down", function (e) {
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
            grid.editCell(grid.getRowIndex(currentID), grid.getColumnIndex("description"))
        }
    })

    Mousetrap.bind("a", function (e) {
        if (e.target.tagName != "INPUT") {
            console.log("new task requested from A");
            createNewTask();
            return false;
        }
    });

    Mousetrap.bind("s", function (e) {
        if (e.target.tagName != "INPUT") {
            $("#txtSearch").focus();
            return false;
        }
    });

    Mousetrap.bind("q", function (e) {
        if (e.target.tagName != "INPUT") {
            sortNow();
            return false;
        }
    });

    Mousetrap.bind("mod+a", function (e) {

        var options = {}

        if (e.target.tagName == "INPUT") {
            //this contains "task-list_13"
            var currentID = e.target.parentElement.parentElement.id;
            currentID = currentID.split("task-list_")[1];
            currentID = parseInt(currentID);

            //now holds the current ID
            var currentTask = mainTaskList.tasks[currentID];

            if (currentTask.isProjectRoot) {
                options.parentTask = currentTask.ID;
            }
            else {
                //have the task be below the current one
                options.sortOrder = currentTask.sortOrder + 0.5;
                options.parentTask = currentTask.parentTask;
            }

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

    $("#saver").on("click", saveTaskList);

    $("#newTask").on("click", createNewTask)
    $("#newTasklist").on("click", createNewTasklist);

    //bind events for the sort button click
    $("#isSortEnabled").on("click", function (ev) {

        //TODO determine why bootstrap states are reversed in events... too early detection?
        //the button states are reversed when coming through
        var isSortEnabled = !($(this).attr("aria-pressed") === 'true');
        mainTaskList.isSortEnabled = isSortEnabled;

        renderGrid();
    });

    //bind events for the sort button click
    $("#btnSortNow").on("click", sortNow);

    //these events handle the task isolation business
    //TODO figure out why ALT+I does not work on Mac
    Mousetrap.bind("mod+q", function (e, combo) {
        console.log("task isolation requested");
        console.log(combo);

        if (e.target.tagName == "INPUT") {
            //we have a text box
            console.log("is input")
            console.log("id", e.target.parentElement.parentElement.id)
            //this contains "task-list_13"


            var currentID = e.target.parentElement.parentElement.id;
            currentID = currentID.split("task-list_")[1];
            currentID = parseInt(currentID);

            var editor = e.target.celleditor;
            //if editing or a change was made, apply that change
            // backup onblur then remove it: it will be restored if editing could not be applied
            e.target.onblur_backup = e.target.onblur;
            e.target.onblur = null;
            if (editor.applyEditing(e.target.element, editor.getEditorValue(e.target)) === false) {
                e.target.onblur = e.target.onblur_backup;
            }

            mainTaskList.idForIsolatedTask = currentID;
            renderGrid();
        }
        else {
            //cancel the isolation if nothing is selected
            console.log("no input, clear isolation")
            mainTaskList.idForIsolatedTask = undefined;
            renderGrid();
        }

        console.log("done with isolation event")

        return false;
    });

    Mousetrap.bind("mod+s", saveTaskList);

    Mousetrap.prototype.stopCallback = function (a, b, c) {
        //this lets the shortcuts go through whenever
        return false;
    }

    //this sets up an event to capture the keydown (before anything else runs)
    $("body").get(0).addEventListener("keydown", function (ev) {
        if (ev.key === "Escape" && shouldDeleteTaskWhenDoneEditing) {
            console.log("bubble keydown", ev.key)
            taskToDelete.removeTask();
            renderGrid();

            shouldDeleteTaskWhenDoneEditing = false;
        }
    });

    $("body").get(0).addEventListener("keydown", function (ev) {

        //ensures that the element is within the table
        //TODO make this more specific
        if (!$(ev.target).parents("tr").length) return;

        //TODO add another one for ESCAPE to delete the task if needed
        if (ev.key === "Enter") {
            console.log("Enter was hit")

            //this gets the TR which has the ID in it
            var trElement = $(ev.target).parents("tr")[0];

            //this gets the element, now need to process the button
            var currentID = trElement.id;
            currentID = currentID.split("task-list_")[1];
            currentID = parseInt(currentID);

            //now holds the current ID
            var currentTask = mainTaskList.tasks[currentID];

            if (currentTask.isFirstEdit) {
                shouldAddTaskWhenDoneEditing = true;
            }
        }

        if (ev.key === "Escape") {
            console.log("escape was hit");

            //this gets the TR which has the ID in it
            var trElement = $(ev.target).parents("tr")[0];

            //this gets the element, now need to process the button
            var currentID = trElement.id;
            currentID = currentID.split("task-list_")[1];
            currentID = parseInt(currentID);

            //now holds the current ID
            var currentTask = mainTaskList.tasks[currentID];

            if (currentTask.isFirstEdit && currentTask.description == "new task") {
                shouldDeleteTaskWhenDoneEditing = true;
                taskToDelete = currentTask;
                console.log("should delete task")
            }
        }

    }, true);

    $("#btnClearIsolation").on("click", function (ev) {
        //this will remove the isolation
        mainTaskList.idForIsolatedTask = null;
        renderGrid();
    });

    $("#btnCreateProject").on("click", function (ev) {
        //this will remove the isolation

        var newProjectTask = mainTaskList.getNew();
        newProjectTask.isProjectRoot = true;
        newProjectTask.description = "new project";
        mainTaskList.idForIsolatedTask = newProjectTask.ID;

        renderGrid();

        grid.editCell(grid.getRowIndex(newProjectTask.ID), grid.getColumnIndex("description"))
    });

    $("#btnMoveStranded").on("click", function (ev) {
        mainTaskList.assignStrandedTasksToCurrentIsolationLevel();
        renderGrid();
    });

    $("#shouldHideRoot").on("click", function (ev) {
        //flip the current value
        mainTaskList.hideRootIfIsolated = !mainTaskList.hideRootIfIsolated
        renderGrid();
    });

    $('#projectTitle').editable({
        type: 'text',
        title: 'Enter title',
        success: function (response, newValue) {
            mainTaskList.title = newValue;
        }
    });

    $("#btnAuthDrive").on("click", function () {
        console.log("auth click")
        localDrive = new DriveStorage()
        localDrive.startAuth(function () {
            //when authorized, get the file list
            localDrive.listFiles(function (files) {
                //once the files are here, update the button
                updateDriveFileButton(files);
            });
        });

        //load the files
        function updateDriveFileButton(fileList) {
            console.log("files inside func", fileList)

            var driveGroup = $("#driveFileGroup ul");

            if (fileList.length > 0) {
                driveGroup.empty();
            }

            _.each(fileList, function (driveFile) {
                var label = $("<li/>").appendTo(driveGroup)
                var aDom = $("<a/>").attr("href", "#").text(driveFile.name).appendTo(label);

                //set up a click event on the LABEL... does not work for the input
                $(label).on("click", function (ev) {
                    //TODO need to wire this up
                    console.log("load the file from drive", driveFile.id)
                    localDrive.downloadFile(driveFile, function (path) {
                        console.log("downloaded file to ", path)
                        TaskList.load(path, loadTaskListCallback, driveFile.id);
                    })
                })
            });
        }
    })

    $("#btnDriveStore").on("click", function () {
        console.log("drive sotre click")
        //function (contents, fileName, fileId, callback) {
        localDrive.storeFile(mainTaskList.getJSONString(), mainTaskList.title, mainTaskList.googleDriveId, function (fileId) {
            console.log("saved/updated tasklist to Drive");
            mainTaskList.googleDriveId = fileId;
        });
    })

    createNewTasklist();
}

$(document).ready(setupMainPageTasks);