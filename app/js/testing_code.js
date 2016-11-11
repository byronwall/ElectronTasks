//these requires are needed in order to load objects on the Browser side of things
var Task = require("./js/Task.js");
var TaskList = require("./js/TaskList.js");
var DriveStorage = require("./js/DriveStorage.js");

var app = require('electron').remote;
var dialog = app.dialog;

var _ = require("lodash");
var jQuery = require("jquery");
var $ = jQuery;

//TODO clean this section up to hide these variables
//delcare any local/global variables
var grid;
var shouldAddTaskWhenDoneEditing = false;
var shouldDeleteTaskWhenDoneEditing = false;

var localDrive = undefined;

var mainTaskList = undefined;

var KEYBOARD_CANCEL = ["INPUT", "TEXTAREA"];

function entryPoint() {
    //this is equal to the onLoad event for the body
    setupMainPageTasks();

    mainTaskList = new TaskList();
}

function showAlert(message, type = "info") {
    console.log(message);

    require("bootstrap-notify");

    $.notify({
        message: message
    }, {
        // settings
        type: type,
        placement: {
            from: "bottom"
        },
        delay: 1000
    });
}

function showSavePrompt(yesNoCallback) {
    $("<div/>").text("Do you want to save first?").dialog({
        resizable: false,
        height: "auto",
        width: 400,
        modal: true,
        title: "Save before leaving?",
        buttons: {
            "Yes": function () {
                $(this).dialog("close");
                saveTaskList(true);
                //need to do some saving

                yesNoCallback();
            },
            "No": function () {
                $(this).dialog("close");

                //continue with whatever
                yesNoCallback();
            }
        }
    });
}

function updateSelectionMenu() {
    //determine if anything is selected
    var selected = _.some(mainTaskList.tasks, function (item) {
        return item.isSelected
    });

    if (selected) {
        $("#selectionMenu").show();
    } else {
        $("#selectionMenu").hide();
    }
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

    updateSelectionMenu();

    //update the project title
    $("#projectTitle").text(mainTaskList.title);
}

function updateBreadcrumbs() {
    //TODO need to fix variable names
    var breadcrumbs = mainTaskList.getCrumbs();

    var clearItem = $("#btnClearIsolation");
    $("#hidden").append(clearItem);

    //clear out the tag bucket
    var breadcrumbBucket = $("#breadcumbs")
    breadcrumbBucket.empty();

    //this will hide the breadbrumbs if isolatiojn is just a project (or nothing)
    if (mainTaskList.idForIsolatedTask == undefined || mainTaskList.tasks[mainTaskList.idForIsolatedTask].isProjectRoot) {
        breadcrumbBucket.hide()
        return;
    } else {
        breadcrumbBucket.show();
    }

    //create the clear isolation button
    console.log(clearItem)
    breadcrumbBucket.append(clearItem);

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

function updateSearch(searchTerm = "", shouldFocus = true) {

    //when called on a "bare" event handler, the parameter coming in is an event object
    if (typeof searchTerm != "string") {
        searchTerm = "";
    }

    var curVal = $("#txtSearch").val();

    //don't search if no change
    if (curVal == searchTerm) {
        return;
    }

    $("#txtSearch").val(searchTerm).keyup()

    if (shouldFocus) {
        $("#txtSearch").focus();
    }
}

function updateTagBucket() {
    var tags = mainTaskList.getAllTags().sort();

    //clear out the tag bucket
    var tagBucket = $("#tagBucket")
    tagBucket.empty();

    //add a new span for each one
    _.each(tags, function (tag) {
        var label = $("<li/>").appendTo(tagBucket).attr("class", "label-search").attr("data-type", "tags")
        var aDom = $("<a/>").attr("href", "#").text(tag).appendTo(label);
    })
}

function updateStatusBucket() {
    var tags = mainTaskList.getAllStatus().sort();

    //clear out the tag bucket
    var tagBucket = $("#statusBucket")
    tagBucket.empty();

    //add a new span for each one
    _.each(tags, function (tag) {
        var label = $("<li/>").appendTo(tagBucket).attr("class", "label-search").attr("data-type", "status")
        var aDom = $("<a/>").attr("href", "#").text(tag).appendTo(label);
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
        var label = $("<li/>").appendTo(tagBucket).attr("class", "label-search").attr("data-type", "milestone")
        var aDom = $("<a/>").attr("href", "#").text(tag).appendTo(label);
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
        $("#recentFileGroup").empty();
    }

    _.each(recentFiles, function (fileName) {
        var label = $("<li/>").appendTo("#recentFileGroup")
        var aDom = $("<a/>").attr("href", "#").text(fileName).appendTo(label);

        //set up a click event on the LABEL... does not work for the input
        //TODO swap this for a delegated event
        $(label).on("click", function (ev) {
            loadTaskListWithPrompt(fileName)
        })
    });
}

function loadTaskListWithPrompt(fileName, driveId) {
    if (mainTaskList.path == "") {
        showSavePrompt(function () {
            TaskList.load(fileName, loadTaskListCallback, driveId);
        })
    } else {
        TaskList.load(fileName, loadTaskListCallback, driveId);
    }
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

    var driveGroup = $("#driveFileGroup");

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
                loadTaskListWithPrompt(fileName, driveFile.id);
            })
        })
    });
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
    var editor = (element instanceof Column) ? element.cellEditor : element.celleditor;
    //if editing or a change was made, apply that change
    // backup onblur then remove it: it will be restored if editing could not be applied
    element.onblur_backup = element.onblur;
    element.onblur = null;
    if (editor.applyEditing(element.element, editor.getEditorValue(element)) === false) {
        element.onblur = element.onblur_backup;
    }
}

function saveTaskList(shouldPromptForFilename = false) {
    if (shouldPromptForFilename && mainTaskList.path == "") {
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

    var didSave = mainTaskList.save();
    if (didSave) {
        showAlert("tasklist was saved", "success")
    }
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
    } else {
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

function createSortAscDescButtons() {
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
}

function setupGrid() {
    grid = new EditableGrid("task-list");
    grid.enableSort = false;
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
            }
            createNewTask(options);
            shouldAddTaskWhenDoneEditing = false;
        }
    };
}

function setupLocalStorage() {
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
}

function createColumnShowAndSort() {
    //set up the column chooser
    _.each(mainTaskList.getListOfColumns(), function (columnName) {
        //create the label and the actual input element
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
            } else {
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
}

function setupEvents() {

    $("#loader").on("click", function () {
        //set the list object
        dialog.showOpenDialog(function (fileName) {
            if (fileName === undefined) {
                //TODO use an actual output box for this
                console.log("no file chosen")
                return false;
            }

            fileName = fileName[0];

            loadTaskListWithPrompt(fileName)

            addFileToRecentFileList(fileName);
        });
    });

    //set up events for the search box
    $("#btnClearSearch").on("click", updateSearch);

    $("#shouldSearchChildren, #shouldSearchParents").on("click", function (ev) {
        $(ev.target).toggleClass("active")
        $("#txtSearch").keyup();

        return false;
    });

    $("#btnShouldShowComplete").on("click", function (ev) {
        $(ev.target).toggleClass("active")

        var shouldShowComplete = $("#btnShouldShowComplete").hasClass("active");

        mainTaskList.shouldHideComplete = !shouldShowComplete;
        renderGrid();

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
            saveTaskList();
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
            saveTaskList();
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

            saveTaskList();
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

            saveTaskList();
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
        if (!_.includes(KEYBOARD_CANCEL, e.target.tagName)) {
            console.log("new task requested from A");
            createNewTask();
            return false;
        }
    });

    Mousetrap.bind("p", function (e) {
        if (!_.includes(KEYBOARD_CANCEL, e.target.tagName)) {
            console.log("new project requested from P");

            createNewProject();
            return false;
        }
    });

    Mousetrap.bind("escape escape", function (e) {
        if (!_.includes(KEYBOARD_CANCEL, e.target.tagName)) {
            console.log("escape hit twice");

            updateSearch("");
            return false;
        }
    });

    Mousetrap.bind("s", function (e) {
        if (!_.includes(KEYBOARD_CANCEL, e.target.tagName)) {
            $("#txtSearch").focus();
            return false;
        }
    });

    Mousetrap.bind("q", function (e) {
        if (!_.includes(KEYBOARD_CANCEL, e.target.tagName)) {
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
            } else {
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
            //clear the search when changing isolation
            updateSearch("");
        } else {
            //cancel the isolation if nothing is selected
            mainTaskList.idForIsolatedTask = undefined;
        }
        renderGrid();

        return false;
    });

    function isKeyboardInEditor(element) {
        return _.includes(KEYBOARD_CANCEL, element.tagName);
    }

    Mousetrap.bind(["shift+c", "alt+shift+c"], function (e, combo) {
        console.log("show children called", combo);

        var validShortcut = isKeyboardInEditor(e.target) ? combo.indexOf("alt") > -1 : true;
        if (validShortcut) {
            $("#shouldSearchChildren").click();
            return false;
        }
    });

    Mousetrap.bind(["shift+p", "alt+shift+p"], function (e, combo) {
        console.log("show parents called", combo);

        var validShortcut = isKeyboardInEditor(e.target) ? combo.indexOf("alt") > -1 : true;
        if (validShortcut) {
            $("#shouldSearchParents").click();
            return false;
        }
    });

    Mousetrap.bind(["shift+s", "alt+shift+s"], function (e, combo) {
        console.log("show settings called", combo);

        var validShortcut = isKeyboardInEditor(e.target) ? combo.indexOf("alt") > -1 : true;
        if (validShortcut) {
            $("#collapseExample").collapse("toggle");
            return false;
        }
    });

    Mousetrap.bind(["mod+shift+a"], function (e, combo) {
        console.log("select all visible", combo);

        //need to get all visible tasks, exclude project root
        var visibleTasks = _.filter(mainTaskList.tasks, function (task) {
            return task.isVisible && !task.isProjectRoot;
        })

        var shouldDeselect = _.every(visibleTasks, function (task) {
            return task.isSelected;
        })

        _.each(visibleTasks, function (task) {
            task.isSelected = !shouldDeselect;
        })

        renderGrid();

        return false;
    });

    Mousetrap.bind(["alt+/", "/"], function (e, combo) {
        console.log("show shortcuts called", combo);

        if (_.includes(KEYBOARD_CANCEL, e.target.tagName) && combo == "/") {
            return;
        }

        $("#modalKeyboard").modal();
        return false;

    });

    Mousetrap.bind("mod+s", function () {
        saveTaskList(true);
        return false;
    });

    Mousetrap.prototype.stopCallback = function (a, b, c) {
        //this lets the shortcuts go through whenever
        return false;
    }

    //this sets up an event to capture the keydown (before anything else runs)
    $("body").get(0).addEventListener("keydown", function (ev) {
        if ((ev.key === "Escape" || ev.key === "Enter") && shouldDeleteTaskWhenDoneEditing) {
            console.log("bubble keydown to delete", ev.key)
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

            var currentTask = getCurrentTask(ev.target);
            var currentID = currentTask.ID;

            if (currentTask.isFirstEdit) {
                console.log("Should add task set")
                shouldAddTaskWhenDoneEditing = true;
            }
        }

        if (ev.key === "Escape" || ev.key === "Enter") {
            //this code assumes that the keypress was an input in the table;
            var currentTask = getCurrentTask(ev.target);
            var currentID = currentTask.ID;

            if (currentTask.isFirstEdit && $(ev.target).val() == "new task") {
                console.log("Should delete set");
                shouldDeleteTaskWhenDoneEditing = true;
                taskToDelete = currentTask;
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

    $("#btnEditSelection").on("click", function () {
        console.log("edit multiple clicked")

        //need to get a list of those tasks which are selected

        var selected = _.filter(mainTaskList.tasks, function (task) {
            return task.isSelected;
        })

        //this is a list of tasks, now need to compare their values
        //start with just desc
        var fields = ["description", "duration", "priority"];
        var tasks = mainTaskList.tasks;

        var modalBody = $("#modalEditBody");
        modalBody.empty();

        var modalCheckInputs = [];

        _.each(fields, function (field) {
            var sameValue = _.every(selected, function (task) {
                return task[field] === selected[0][field];
            })

            //need to create the editor here (build the fields)

            //TODO change this defualt value
            var valueToShow = (sameValue) ? selected[0][field] : "various";

            var div = $("<div/>").attr("class", "input-group")
            var span = $("<span/>").attr("class", "input-group-addon")
            var input = $("<input/>").attr("type", "text").attr("class", "form-control").val(valueToShow);
            var checkbox = $("<input/>").attr("type", "checkbox");

            span.text(field).prepend(checkbox)

            //add the field to the input
            input.data("field", field);

            div.append(span).append(input);
            modalBody.append(div);

            //set up some events for this form
            input.on("keyup", function () {
                if ($(this).val() != valueToShow) {
                    checkbox.attr("checked", true);
                }
            })

            modalCheckInputs.push({
                check: checkbox,
                input: input
            })
        });

        //wire up an event for the save click
        var modalSave = $("#modalSave");
        modalSave.off();
        modalSave.on("click", function () {
            //collect all of the items with checkboxses
            _.each(modalCheckInputs, function (obj) {
                    if (obj.check.is(":checked")) {
                        //get the new value
                        //set that value for each task in the selector array
                        _.each(selected, function (task) {
                            task[obj.input.data("field")] = obj.input.val();
                        })
                    }
                })
                //clear the modal
            $("#modalEdit").modal("hide");
            renderGrid();
        })

        //this will popup with the editor
        $("#modalEdit").modal();
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

    $("#gridList").on("click", "td", function (ev) {
        if (ev.metaKey || ev.ctrlKey) {
            console.log("tr click with meta or CTRL", this, $(this).offset(), ev)
                //this needs to select the task
            var currentTask = getCurrentTask(this);
            currentTask.isSelected = !currentTask.isSelected;

            //move the selection menu to position of the row
            $("#selectionMenu").show();
            $("#selectionMenu").offset({
                top: ev.clientY,
                left: ev.clientX + 25
            });

            renderGrid();
        }
    })

    $("#btnClearSelection").on("click", function () {
        console.log("clear selection click")

        //clear selection, render grid
        _.each(mainTaskList.tasks, function (task) {
            task.isSelected = false;
        })

        renderGrid();
        return false;
    })



    $("body").on("click", ".label-search", function (ev) {
        console.log("label-search click", this);

        //get the target
        var target = this;
        var type = target.dataset.type;

        //get the column item to cancel the editing
        var column = grid.columns[grid.getColumnIndex("description")];

        //this click is happening after the editor appears
        //need to end the editor and then render
        //not sure why a render call is required?
        applyEdit(column);
        renderGrid();

        console.log("type", type);
        //get its dataset.type

        updateSearch(type + ":" + $(target).text(), false)

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
        saveTaskList();;
    });

    $("#gridList").on("click", ".btnDelete", function (ev) {
        console.log("task delete button hit");

        var currentTask = getCurrentTask(ev.target);
        var currentID = currentTask.ID;
        var parentID = currentTask.parentTask;

        //do a check to see if this is a project and the only project
        if (currentTask.isProjectRoot) {
            //clear the isolation
            mainTaskList.idForIsolatedTask = null;

            var projects = mainTaskList.getProjectsInList();
            var projectCount = projects.length;

            if (projectCount == 1) {
                console.log("task cannot be deleted, since it is the last project root");
                return false;
            }

            //delete the project
            currentTask.removeTask()

            projects = mainTaskList.getProjectsInList();
            projectCount = projects.length;

            //if there is only one project, isolate it
            if (projectCount == 1) {
                mainTaskList.idForIsolatedTask = projects[0].ID;
            }


        } else {
            currentTask.removeTask()
        }

        //check if the isolated task is the removed task
        if (mainTaskList.idForIsolatedTask == currentID) {
            mainTaskList.idForIsolatedTask = parentID;
        }

        renderGrid();
        saveTaskList();;
        //delete the task and rerender
    })

    var autosize = require("autosize");
    autosize($("#modalCommentsText"));

    $("#gridList").on("click", ".btnComment", function (ev) {
        console.log("task comments button hit");

        var currentTask = getCurrentTask(ev.target);
        var currentID = currentTask.ID;

        //need to show the comment modal, use those events for what's next
        function showCommentModal() {
            var modalComments = $("#modalComments");
            modalComments.modal();

            $("#modalCommentsText").val(currentTask.comments);
            //wire up the save button
            $("#modalSaveComments").off().on("click", function () {
                //save the task data
                var value = $("#modalCommentsText").val();
                currentTask.comments = value;
                modalComments.modal("hide");

                renderGrid();
            })
        }

        showCommentModal();

        return false;
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
        saveTaskList();;
        //delete the task and rerender
    })

    //TODO pull this put into its own funcion?
    require("jquery-textcomplete")
    $("#gridList").on("DOMNodeInserted", "input", function (ev) {
        //TODO streamline this code since it's all the same
        $(this).textcomplete([{
            match: /(\B#)(\w{0,})$/,
            search: function (term, callback) {
                var answer = _.filter(mainTaskList.getAllTags(), function (item) {
                    return item.indexOf(term) >= 0;
                })
                console.log("search")
                callback(answer);
            },
            replace: function (word) {
                return "#" + word + ' ';
            }
        }, {
            match: /(\B@)(\w{0,})$/,
            search: function (term, callback) {
                var answer = _.filter(mainTaskList.getAllStatus(), function (item) {
                    return item.indexOf(term) >= 0;
                })
                callback(answer);
            },
            replace: function (word) {
                return "@" + word + ' ';
            }
        }, {
            match: /(\B!)(\w{0,})$/,
            search: function (term, callback) {
                var answer = _.filter(mainTaskList.getMilestones(), function (item) {
                    return item.indexOf(term) >= 0;
                })
                callback(answer);
            },
            replace: function (word) {
                return "!" + word + ' ';
            }
        }]).on({
            //these are needed in order to let the editablegrid now what is going on (it will skip events)
            'textComplete:show': function (e) {
                $(this).data('autocompleting', true);
            },
            'textComplete:hide': function (e) {
                $(this).data('autocompleting', false);
            }
        });
    });

    $("#gridList").on("DOMNodeRemoved", "input", function (ev) {
        //this will remove the popup when the input is removed.
        $(this).textcomplete("destroy");
    });
}

function setupMainPageTasks() {
    //this is currently a dumping ground to get events created

    //create a blank task list to start
    mainTaskList = new TaskList();

    //set up the grid related events
    setupGrid();
    setupLocalStorage();
    createColumnShowAndSort();
    createSortAscDescButtons();

    setupEvents();

    createNewTasklist();
}

$(document).ready(setupMainPageTasks);