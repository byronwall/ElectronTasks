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

var localDrive = undefined;

var mainTaskList = undefined;

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
    updateMilestoneBucket();

    //update the project title
    $("#projectTitle").text(mainTaskList.title);
}

function updateBreadcrumbs() {
    //TODO need to fix variable names
    var breadcrumbs = mainTaskList.getCrumbs();

    //clear out the tag bucket
    var breadcrumbBucket = $("#breadcumbs")
    breadcrumbBucket.empty();

    //this will hide the breadbrumbs if isolatiojn is just a project (or nothing)
    if (mainTaskList.idForIsolatedTask == undefined || mainTaskList.tasks[mainTaskList.idForIsolatedTask].isProjectRoot) {
        breadcrumbBucket.hide()
        return;
    }
    else {
        breadcrumbBucket.show();
    }

    //add a new span for each one
    _.each(breadcrumbs, function (breadcrumb) {
        var label = $("<li/>").appendTo(breadcrumbBucket)
        var aDom = $("<a/>").attr("href", "#").text(breadcrumb.description).appendTo(label);

        //set up a click event on the LABEL... does not work for the input
        //TODO swap this for a delegated event
        $(label).on("click", function (ev) {
            mainTaskList.idForIsolatedTask = breadcrumb.ID;
            renderGrid();
        });
    })
}

function updateProjectBucket() {
    var projects = mainTaskList.getProjectsInList();

    //clear out the tag bucket
    var projectBucket = $("#projectBucket")
    projectBucket.empty();

    if (projects.length == 1) {
        projectBucket.hide();
        return;
    } else {
        projectBucket.show();
    }

    //add the buttons to move the task
    _.each(projects, function (project) {
        var label = $("<li/>").attr("data-project", project.ID);
        var aDom = $("<a/>").attr("href", "#").text(project.description).appendTo(label);

        if (project.ID == mainTaskList.idForIsolatedTask) {
            //skip current project
            return;
        }

        //add the mover to all buttons
        $(".gridMove").empty().append(label);
    })

    var dummyTask = new Task(null, false);
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
        //TODO swap this for a delegated event
        $(label).on("click", function (ev) {
            mainTaskList.idForIsolatedTask = project.ID;
            renderGrid();
        });
    })
}

function updateMilestoneBucket() {
    var tags = mainTaskList.getMilestones().sort();

    //TODO update variable names

    //clear out the tag bucket
    var tagBucket = $("#milestoneBucket")
    tagBucket.empty();

    //add a new span for each one
    _.each(tags, function (tag) {
        var span = $("<span/>").text(tag).appendTo(tagBucket).attr("class", "label label-warning label-search");
        span.attr("data-type", "milestone");
    })
}

function updateSearch(searchTerm = "") {

    var curVal = $("#txtSearch").val();

    //don't search if no change
    if (curVal == searchTerm) {
        return;
    }

    $("#txtSearch").val(searchTerm).keyup();
    renderGrid();
    $("#txtSearch").focus();
}

function updateTagBucket() {
    var tags = mainTaskList.getAllTags().sort();

    //clear out the tag bucket
    var tagBucket = $("#tagBucket")
    tagBucket.empty();

    //add a new span for each one
    _.each(tags, function (tag) {
        var span = $("<span/>").text(tag).appendTo(tagBucket).attr("class", "label label-primary label-search");
        span.attr("data-type", "tags");
    })
}

function updateStatusBucket() {
    var tags = mainTaskList.getAllStatus().sort();

    //clear out the tag bucket
    var tagBucket = $("#statusBucket")
    tagBucket.empty();

    //add a new span for each one
    _.each(tags, function (tag) {
        var span = $("<span/>").text(tag).appendTo(tagBucket).attr("class", "label label-info label-search");
        span.attr("data-type", "status");
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
        //TODO swap this for a delegated event
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

function listGoogleDriveFiles() {
    localDrive.listFiles(function (files) {
        //once the files are here, update the button
        updateDriveFileButton(files);
    });
}

function saveFileInDrive() {
    localDrive.storeFile(mainTaskList.getJSONString(), mainTaskList.title, mainTaskList.googleDriveId, function (fileId) {
        console.log("saved/updated tasklist to Drive");
        mainTaskList.googleDriveId = fileId;
    });
}

function authorizeGoogleDrive(callback) {
    localDrive = new DriveStorage()
    localDrive.startAuth(callback);
}

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

function sortNow() {
    var isSortEnabled = mainTaskList.isSortEnabled;

    mainTaskList.isSortEnabled = true;
    renderGrid();
    mainTaskList.isSortEnabled = isSortEnabled;

    mainTaskList.save();
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

function getCurrentTask(element) {
    //find the element above that is the tr (contains the ID)
    var currentID = $(element).parents("tr")[0].id;
    currentID = currentID.split("task-list_")[1];
    currentID = parseInt(currentID);

    //now holds the current ID
    var currentTask = mainTaskList.tasks[currentID];

    return currentTask;
}

function getTaskAbove(currentTask) {
    console.log("getAbove, currentTask", currentTask)
    var currentRow = grid.getRowIndex(currentTask.ID);

    //TODO add some error checking

    //get the task above the current
    var aboveId = grid.getRowId(currentRow - 1);
    var aboveTask = mainTaskList.tasks[aboveId];

    return aboveTask;
}

function applyEdit(element) {
    var editor = element.celleditor;
    //if editing or a change was made, apply that change
    // backup onblur then remove it: it will be restored if editing could not be applied
    element.onblur_backup = element.onblur;
    element.onblur = null;
    if (editor.applyEditing(element.element, editor.getEditorValue(element)) === false) {
        element.onblur = element.onblur_backup;
    }
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
        renderGrid();
        grid.editCell(grid.getRowIndex(newTask.ID), grid.getColumnIndex("description"))
    }
    else {
        //this will prevent the task from being added if it has no parent
        console.log("stranded task removed")
        //TODO add a warning that task was not created since it would have been stranded
        newTask.removeTask();
    }
}

function createNewProject() {
    var newProjectTask = mainTaskList.getNew();
    newProjectTask.isProjectRoot = true;
    newProjectTask.description = "new project";
    mainTaskList.idForIsolatedTask = newProjectTask.ID;

    renderGrid();

    grid.editCell(grid.getRowIndex(newProjectTask.ID), grid.getColumnIndex("description"))
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

        /*

<li><a href="#"><label class="btn btn-primary active">
    <input type="checkbox" autocomplete="off" checked> Checkbox 1 (pre-checked)
  </label></a></li>

        */

        if (columnName == "action") {
            //skip showing the action column
            return;
        }

        var li = $("<li/>").appendTo("#columnChooser")
        var anchor = $("<a/>").appendTo(li)
        var label = $("<label/>").appendTo(anchor).attr("class", "btn btn-primary");
        var inputEl = $("<input/>").attr("type", "checkbox").prop("checked", true).appendTo(label);

        label.text(columnName);

        if (visibleColumns.indexOf(columnName) > -1) {
            label.addClass("active");
            mainTaskList.columns[columnName].active = true;
        }

        //set up a click event on the LABEL... does not work for the input
        $(label).on("click", function (ev) {

            //this seems to be opposite of the actual value
            var isActive = !$(this).hasClass("active")
            $(this).toggleClass("active")
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
        var li = $("<li/>").appendTo("#sortChooser")
        var anchor = $("<a/>").appendTo(li)
        var label = $("<label/>").appendTo(anchor).attr("class", "btn btn-primary");
        var inputEl = $("<input/>").attr("type", "radio").appendTo(label);

        label.text(columnName)

        if (columnName == mainTaskList.sortField) {
            label.addClass("active");
        }

        //set up a click event on the LABEL... does not work for the input
        $(label).on("click", function (ev) {
            //this seems to be opposite of the actual value
            mainTaskList.sortField = columnName;
            sortNow();
            $("#sortChooser label").removeClass("active");
            $(this).toggleClass("active");
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
    $("#btnClearSearch").on("click", updateSearch);

    $("#shouldSearchChildren, #shouldSearchParents").on("click", function (ev) {
        $(ev.target).toggleClass("active")
        $("#txtSearch").keyup();

        return false;
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
        mainTaskList.searchChildren = $("#shouldSearchChildren").hasClass("active");
        mainTaskList.searchParents = $("#shouldSearchParents").hasClass("active");

        //render again
        renderGrid();
    });

    Mousetrap.bind("alt+right", function (e) {
        if (e.target.tagName == "INPUT") {

            var currentTask = getCurrentTask(e.target);
            var aboveTask = getTaskAbove(currentTask);

            //need to iterate until aboveTask is at same indent as current task
            while (aboveTask.indent > currentTask.indent) {
                aboveTask = mainTaskList.tasks[aboveTask.parentTask]
                console.log("above task new", aboveTask);
            }

            //TODO put this code somewhere else

            //remove the current parent if it exists
            if (currentTask.parentTask != null) {
                var parentTask = mainTaskList.tasks[currentTask.parentTask];
                var parentChildIndex = parentTask.childTasks.indexOf(currentTask.ID);
                parentTask.childTasks.splice(parentChildIndex, 1);
            }

            //need to set the parent for the current and the child for the above
            currentTask.parentTask = aboveTask.ID;
            aboveTask.childTasks.push(currentTask.ID);

            applyEdit(e.target);

            //the relationship is known... rerender?
            mainTaskList.save()
            renderGrid();

            //need to get the task located above the current one (0 index)
            var currentRow = grid.getRowIndex(currentTask.ID);
            grid.editCell(currentRow, grid.getColumnIndex("description"))

            return false;
        }
    })
    Mousetrap.bind("alt+left", function (e) {
        console.log("indent left requested");

        //indent left should put the current task under the level 
        //parent -> task -> current task, should be a child of parent
        //parent -> current task, should just null out the parent

        //remove this node from the childTasks of the current parent
        //check the parent of the parent and make them equal
        //add this node to the child nodes of that parent if it exists

        if (e.target.tagName == "INPUT") {

            //TODO refactor this away
            var currentTask = getCurrentTask(e.target);
            var currentID = currentTask.ID;

            if (currentTask.parentTask == null) {
                return;
            }

            var aboveId = currentTask.parentTask;
            var aboveTask = mainTaskList.tasks[aboveId];

            if (aboveTask.parentTask == null) {
                //don't allow a stranded task
                return;
            }

            //TODO all of this data code needs to go into the TaskList

            //need to set the parent for the current and the child for the above

            //get index of self in children of parent task and remove from current parent
            var parentChildIndex = aboveTask.childTasks.indexOf(currentID);
            aboveTask.childTasks.splice(parentChildIndex, 1);

            //get the new parent
            //grandparent

            var grandparentID = aboveTask.parentTask;
            currentTask.parentTask = grandparentID;
            if (grandparentID != null) {
                var grandparentTask = mainTaskList.tasks[grandparentID];
                grandparentTask.childTasks.push(currentID);

                console.log("grandparent task after adding", grandparentTask)
            }

            applyEdit(e.target);

            //the relationship is known... rerender?
            mainTaskList.save()
            renderGrid();

            var currentRow = grid.getRowIndex(currentID);
            grid.editCell(currentRow, grid.getColumnIndex("description"))
        }
    })

    Mousetrap.bind("alt+up", function (e) {
        console.log("move up requested");

        //need to change the sort order to be one less than the task above the current one but at the same indent level
        //sort orders will be corrected to be sequential, so just need to get a number between the two spots

        if (e.target.tagName == "INPUT") {

            //now holds the current ID
            var currentTask = getCurrentTask(e.target);
            var currentID = currentTask.ID

            currentTask.sortOrder -= 1.1;

            applyEdit(e.target);

            mainTaskList.save()
            renderGrid();
            grid.editCell(grid.getRowIndex(currentID), grid.getColumnIndex("description"))
        }
    })



    Mousetrap.bind("alt+down", function (e) {
        console.log("move down requested");

        if (e.target.tagName == "INPUT") {
            var currentTask = getCurrentTask(e.target);
            var currentID = currentTask.ID;

            currentTask.sortOrder += 1.1;

            applyEdit(e.target);

            mainTaskList.save()
            renderGrid();
            grid.editCell(grid.getRowIndex(currentID), grid.getColumnIndex("description"))
        }
    })

    Mousetrap.bind(["ctrl+alt+right", "ctrl+alt+left", "ctrl+alt+up", "ctrl+alt+down"], function (ev, combo) {

        if (ev.target.tagName === "INPUT" && $(ev.target).parents("#gridList").length) {
            console.log("move cell selector shortcut")

            //if this is a tasklist input, there should be an element, and then rowIndex and columnIndex
            var element = ev.target.element;
            var rowIndex = element.rowIndex;
            var columnIndex = element.columnIndex;

            var colChange = 0;

            //depending on combo
            switch (combo) {
                case "ctrl+alt+right":
                    colChange = 1;
                    break;
                case "ctrl+alt+left":
                    colChange = -1;
                    break;
                case "ctrl+alt+up":
                    rowIndex--;
                    break;
                case "ctrl+alt+down":
                    rowIndex++;
                    break;
            }

            //need to deal with non-editable columns
            //this must terminate because we started in a INPUT cell
            do {
                columnIndex = (columnIndex + colChange + grid.getColumnCount()) % grid.getColumnCount();
            } while (!grid.columns[columnIndex].editable);

            //do some bounds checking and wrap around if needed
            rowIndex = (rowIndex + grid.getRowCount()) % grid.getRowCount();

            applyEdit(ev.target);
            grid.editCell(rowIndex, columnIndex);

            return false;
        }

    });

    Mousetrap.bind("a", function (e) {
        if (e.target.tagName != "INPUT") {
            console.log("new task requested from A");
            createNewTask();
            return false;
        }
    });

    Mousetrap.bind("p", function (e) {
        if (e.target.tagName != "INPUT") {
            console.log("new project requested from P");

            createNewProject();
            return false;
        }
    });

    Mousetrap.bind("escape escape", function (e) {
        if (e.target.tagName != "INPUT") {
            console.log("escape hit twice");

            updateSearch("");
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

    Mousetrap.bind("alt+a", function (e) {

        var options = {}

        if (e.target.tagName == "INPUT") {

            //now holds the current ID
            var currentTask = getCurrentTask(e.target);
            var currentID = currentTask.ID;

            if (currentTask.isProjectRoot) {
                options.parentTask = currentTask.ID;
            }
            else {
                //have the task be below the current one
                options.sortOrder = currentTask.sortOrder + 0.5;
                options.parentTask = currentTask.parentTask;
            }

            applyEdit(e.target);
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
    Mousetrap.bind("alt+q", function (e, combo) {
        console.log("task isolation requested");

        if (e.target.tagName == "INPUT") {
            //we have a text box
            var currentTask = getCurrentTask(e.target);
            var currentID = currentTask.ID;

            applyEdit(e.target);

            mainTaskList.idForIsolatedTask = currentID;
            renderGrid();
        }
        else {
            //cancel the isolation if nothing is selected
            mainTaskList.idForIsolatedTask = undefined;
            renderGrid();
        }

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

        if (ev.key === "Enter") {
            console.log("Enter was hit")

            var currentTask = getCurrentTask(ev.target);
            var currentID = currentTask.ID;

            if (currentTask.isFirstEdit) {
                shouldAddTaskWhenDoneEditing = true;
            }
        }

        if (ev.key === "Escape") {
            console.log("escape was hit");

            var currentTask = getCurrentTask(ev.target);
            var currentID = currentTask.ID;

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

    $("#btnCreateProject").on("click", createNewProject);

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

        authorizeGoogleDrive(listGoogleDriveFiles);
    })

    
    $("#btnPrint").on("click", function () {
        console.log("print clicked")

        window.print();
    })

    $("#btnClearLocalStorage").on("click", function () {
        console.log("clear local storage")

        localStorage.clear();
    })

    $("#btnDriveStore").on("click", function () {
        console.log("drive store click")

        if (localDrive === undefined) {
            authorizeGoogleDrive(saveFileInDrive);
            return;
        }

        saveFileInDrive();
    })

    $("#gridList, .label-bucket").on("click", ".label-search", function (ev) {
        console.log("click", ev);

        //get the target
        var target = ev.target;
        var type = target.dataset.type;

        console.log("type", type);
        //get its dataset.type

        updateSearch(type + ":" + $(target).text())
        return false;

        //update the search field

    })

    //this needs to wire up some button click events
    $("#gridList").on("click", ".btnComplete", function (ev) {
        console.log("task complete button hit");

        var currentTask = getCurrentTask(ev.target);
        var currentID = currentTask.ID;

        //complete the task and update the display
        currentTask.completeTask();

        renderGrid();
        mainTaskList.save();
    });

    $("#gridList").on("click", ".btnDelete", function (ev) {
        console.log("task delete button hit");

        var currentTask = getCurrentTask(ev.target);
        var currentID = currentTask.ID;

        currentTask.removeTask()

        renderGrid();
        mainTaskList.save();
        //delete the task and rerender
    })

    $("#gridList").on("click", ".gridMove li", function (ev) {
        console.log("task move button hit");

        var currentTask = getCurrentTask(ev.target);

        var newProjectId = this.dataset.project;
        var newProject = mainTaskList.tasks[newProjectId];

        if (currentTask.parentTask != null) {
            var parentTask = mainTaskList.tasks[currentTask.parentTask];
            var parentChildIndex = parentTask.childTasks.indexOf(currentTask.ID);
            parentTask.childTasks.splice(parentChildIndex, 1);
        }

        //need to set the parent for the current and the child for the above
        currentTask.parentTask = newProjectId;
        newProject.childTasks.push(currentTask.ID);

        renderGrid();
        mainTaskList.save();
        //delete the task and rerender
    })

    createNewTasklist();
}

$(document).ready(setupMainPageTasks);