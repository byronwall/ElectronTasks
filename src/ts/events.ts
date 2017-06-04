var taskToDelete: Task;

var setupEvents = function () {

    setupAutocompleteEvents();
    setupMousetrapEvents();
    setupActionPanelButtonEvents();
    setupBulkEditEvents();
    setupSettingsRelatedEvents();
    setupGoogleDriveEvents();
    setupSearchEvents();
    setupFileManagementEvents();
    setupKeydownEvents();
    setupTaskRelatedEvents();
    setupAppRelatedEvents();
};

function setupAppRelatedEvents() {

    $("#btnPrint").on("click", function () {
        console.log("print clicked");

        window.print();
    });

    $("#btnClearLocalStorage").on("click", function () {
        console.log("clear local storage");

        localStorage.clear();
    });

    $(window).on("resize", resizeBasedOnNavbar);

    $('#projectTitle').editable({
        type: 'text',
        title: 'Enter title',
        success: function (response, newValue) {
            mainTaskList.title = newValue;
        }
    });
}

function isKeyboardInEditor(element) {
    return _.includes(KEYBOARD_CANCEL, element.tagName);
}

function setupTaskRelatedEvents() {

    $("#newTask").on("click", createNewTask);
    $("#newTasklist").on("click", createNewTasklist);

    //bind events for the sort button click
    $("#btnSortNow").on("click", sortNow);
    $("#btnClearIsolation").on("click", function (ev) {
        //this will remove the isolation
        clearIsolation();
    });

    $("#btnCreateProject").on("click", createNewProject);

    $("#btnMoveStranded").on("click", function (ev) {
        mainTaskList.assignStrandedTasksToCurrentIsolationLevel();
        renderGrid();
    });

}

function setupKeydownEvents() {

    //this sets up an event to capture the keydown (before anything else runs)
    $("body").get(0).addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" && shouldDeleteTaskWhenDoneEditing) {
            console.log("bubble keydown to delete", ev.key);
            taskToDelete.removeTask();
            renderGrid();

            shouldDeleteTaskWhenDoneEditing = false;
        }
    });

    //this event is being captured (not bubbled) with the true down below
    $("body").get(0).addEventListener("keydown", function (ev) {

        //ensures that the element is within the table
        //TODO make this more specific
        if (!$(ev.target).parents("tr").length) {
            return;
        }

        var input = ev.target;

        //check for auto completing ensures that a new task is not created because of selecting a choice there
        //this was creating a problem where hitting TAB again would create new task
        var isAutoCompleting = $(input).data("autocompleting");
        if (ev.key === "Enter" && !isAutoCompleting) {

            var currentTask = getCurrentTask(ev.target);
            var currentID = currentTask.ID;

            if (currentTask.isFirstEdit) {
                if ($(input).val() === "new task") {
                    shouldDeleteTaskWhenDoneEditing = true;
                    taskToDelete = currentTask;
                } else {
                    shouldAddTaskWhenDoneEditing = true;
                }
            }
        }

    }, true);

}

function setupFileManagementEvents() {

    $("#loader").on("click", function () {
        //set the list object
        dialog.showOpenDialog(function (fileName) {
            if (fileName === undefined) {
                //TODO use an actual output box for this
                console.log("no file chosen");
                return false;
            }

            fileName = fileName[0];

            loadTaskListWithPrompt(fileName, "");

            addFileToRecentFileList(fileName);
        });
    });

    $("#saver").on("click", saveTaskList);

}

function setupSearchEvents() {

    $("#btnClearSearch").on("click", updateSearch);

    $("body").on("click", ".label-search", function (ev) {
        console.log("label-search click", this, "shift", ev.shiftKey);

        //get the target
        var target = this;
        var type = target.dataset.type;

        //get the column item to cancel the editing
        var column = grid.columns[grid.getColumnIndex("description")];

        //this click is happening after the editor appears
        //need to end the editor and then render
        //not sure why a render call is required?
        applyEdit(column, true);
        renderGrid();

        console.log("type", type);
        //get its dataset.type

        var searchTerm = type + ":" + $(target).text();

        if (ev.shiftKey) {
            searchTerm = $("#txtSearch").val() + " " + searchTerm;
        }

        updateSearch(searchTerm, false);

        //close any dropdown menus used
        $('.btn-group.open .dropdown-toggle').dropdown('toggle');

        //update the search field
        return false;
    });

    $("#txtSearch").on("keyup", function (ev) {
        //this needs to do the active search
        //set a filter
        //find the ESC key
        if (ev.keyCode === 27) {
            $(this).val("");
            $("#txtSearch").blur();
        }

        mainTaskList.searchTerm = $(this).val();
        mainTaskList.searchChildren = $("#shouldSearchChildren").hasClass("active");
        mainTaskList.searchParents = $("#shouldSearchParents").hasClass("active");

        //render again
        renderGrid();
    });

}

function setupGoogleDriveEvents() {
    $("#btnAuthDrive").on("click", function () {
        console.log("auth click");

        authorizeGoogleDrive(listGoogleDriveFiles);
    });

    $("#btnDriveStore").on("click", function () {
        console.log("drive store click");

        if (localDrive === undefined) {
            authorizeGoogleDrive(saveFileInDrive);
            return;
        }

        saveFileInDrive();
    });
}

function setupSettingsRelatedEvents() {

    //bind events for the sort button click
    $("#isSortEnabled").on("click", function (ev) {

        //TODO determine why bootstrap states are reversed in events... too early detection?
        //the button states are reversed when coming through
        var isSortEnabled = !($(this).attr("aria-pressed") === 'true');
        mainTaskList.isSortEnabled = isSortEnabled;

        renderGrid();
    });

    $("#shouldHideRoot").on("click", function (ev) {
        //flip the current value
        mainTaskList.hideRootIfIsolated = !mainTaskList.hideRootIfIsolated;
        renderGrid();
    });

    $("#shouldSearchChildren, #shouldSearchParents").on("click", function (ev) {
        $(ev.target).toggleClass("active");
        $("#txtSearch").keyup();

        return false;
    });

    $("#btnShouldShowComplete").on("click", function (ev) {
        $(ev.target).toggleClass("active");

        var shouldShowComplete = $("#btnShouldShowComplete").hasClass("active");

        mainTaskList.shouldHideComplete = !shouldShowComplete;
        renderGrid();

        return false;
    });

    $("#btnShouldShowTagsForComplete").on("click", function (ev) {
        $(ev.target).toggleClass("active");

        var shouldShowComplete = $("#btnShouldShowTagsForComplete").hasClass("active");

        mainTaskList.shouldExcludeCompleteTasksForBuckets = !shouldShowComplete;
        renderGrid();

        return false;
    });

    $("#btnShowCommentsWithDesc").on("click", function (ev) {
        $(ev.target).toggleClass("active");

        var shouldShowComplete = $("#btnShowCommentsWithDesc").hasClass("active");

        mainTaskList.shouldShowCommentsWithDesc = shouldShowComplete;
        renderGrid();

        return false;
    });
}

function setupBulkEditEvents() {

    $("#gridList").on("click", "td", function (ev) {
        if (ev.metaKey || ev.ctrlKey) {
            console.log("tr click with meta or CTRL", this, $(this).offset(), ev);
            //this needs to select the task
            var currentTask = getCurrentTask(this);
            currentTask.isSelected = !currentTask.isSelected;

            //move the selection menu to position of the row
            $("#selectionMenu").show();

            renderGrid();
        }
    });

    $("#btnEditSelection").on("click", function () {
        console.log("edit multiple clicked");

        //need to get a list of those tasks which are selected

        var selected = _.filter(mainTaskList.tasks, function (task) {
            return task.isSelected;
        });

        //this is a list of tasks, now need to compare their values
        //start with just desc
        var fields = ["description", "duration", "priority", "status", "milestone", "tags"];
        var tasks = mainTaskList.tasks;

        var modalBody = $("#modalEditBody");
        modalBody.empty();

        var modalCheckInputs = [];

        _.each(fields, function (field) {
            var sameValue = _.every(selected, function (task) {
                return task[field] === selected[0][field];
            });

            //need to create the editor here (build the fields)

            //TODO change this defualt value
            var valueToShow = (sameValue) ? selected[0][field] : "various";

            var div = $("<div/>").attr("class", "input-group");
            var span = $("<span/>").attr("class", "input-group-addon");
            var input = $("<input/>").attr("type", "text").attr("class", "form-control").val(valueToShow);
            var checkbox = $("<input/>").attr("type", "checkbox");

            span.text(field).prepend(checkbox);

            //add the field to the input
            input.data("field", field);

            div.append(span).append(input);
            modalBody.append(div);

            //set up some events for this form
            input.on("keyup", function () {
                if ($(this).val() !== valueToShow) {
                    checkbox.attr("checked", true);
                }
            });

            modalCheckInputs.push({
                check: checkbox,
                input: input
            });
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
                        task.setDataValue(obj.input.data("field"), obj.input.val());
                    });
                }
            });
            //clear the modal
            $("#modalEdit").modal("hide");
            renderGrid();
        });

        //this will popup with the editor
        $("#modalEdit").modal();
    });

    $("#btnClearSelection").on("click", function () {
        console.log("clear selection click");
        clearSelection();
        return false;
    });
}

function setupActionPanelButtonEvents() {
    //this needs to wire up some button click events
    $("#gridList").on("click", ".btnComplete", function (ev) {
        console.log("task complete button hit");

        var currentTask = getCurrentTask(ev.target);
        var currentID = currentTask.ID;

        //complete the task and update the display
        currentTask.completeTask();

        renderGrid();
        saveTaskList();
    });

    //this needs to wire up some button click events
    $("#gridList").on("click", ".btnIsolate", function (ev) {
        console.log("task isolate button hit");

        var currentTask = getCurrentTask(ev.target);
        var currentID = currentTask.ID;

        //complete the task and update the display
        mainTaskList.idForIsolatedTask = currentID;

        updateSearch("");

        renderGrid();
        saveTaskList();
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

            if (projectCount === 1) {
                console.log("task cannot be deleted, since it is the last project root");
                return false;
            }

            //delete the project
            currentTask.removeTask();

            projects = mainTaskList.getProjectsInList();
            projectCount = projects.length;

            //if there is only one project, isolate it
            if (projectCount === 1) {
                mainTaskList.idForIsolatedTask = projects[0].ID;
            }


        } else {
            currentTask.removeTask();
        }

        //check if the isolated task is the removed task
        if (mainTaskList.idForIsolatedTask === currentID) {
            mainTaskList.idForIsolatedTask = parentID;
        }

        renderGrid();
        saveTaskList();
        //delete the task and rerender
    });

    var autosize = require("autosize");
    autosize($("#modalCommentsText"));

    $("#gridList").on("click", ".btnComment", function (ev) {
        console.log("task comments button hit");

        var currentTask = getCurrentTask(ev.target);
        var currentID = currentTask.ID;

        //need to show the comment modal, use those events for what's next
        function showCommentModal() {
            var modalComments = $("#modalComments");

            $("#modalCommentsText").val(currentTask.comments);
            $("#modalCommentsTask").text("#" + currentTask.ID + " " + currentTask.description);


            modalComments.on('shown.bs.modal', function () {
                $("#modalCommentsText").focus();
            });

            modalComments.modal();

            function saveModalComments() {
                var value = $("#modalCommentsText").val();
                currentTask.comments = value;
                modalComments.modal("hide");

                renderGrid();
                saveTaskList(false);
            }

            $("#modalCommentsText").off().on("keydown", function (ev) {
                if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) {
                    saveModalComments();
                }
            });

            //wire up the save button
            $("#modalSaveComments").off().on("click", function () {
                //save the task data
                saveModalComments();
            });
        }

        showCommentModal();

        return false;
    });

    $("#gridList").on("click", ".gridMove li", function (ev) {
        console.log("task move button hit");

        var currentTask = getCurrentTask(ev.target);
        var newProjectId = this.dataset.project;
        currentTask.moveTaskToProject(newProjectId);

        renderGrid();
        saveTaskList();
    });
}

function setupMousetrapEvents() {
    Mousetrap.bind("alt+right", function (e: KeyboardEvent) {

        var target = e.target as HTMLElement;
        if (target.tagName === "INPUT") {

            var currentTask = getCurrentTask(e.target);
            currentTask.indentRight();

            applyEdit(e.target);

            //the relationship is known... rerender?
            saveTaskList();
            renderGrid();

            //need to get the task located above the current one (0 index)
            var currentRow = grid.getRowIndex(currentTask.ID);
            grid.editCell(currentRow, grid.getColumnIndex("description"));

            return false;
        }
    });

    Mousetrap.bind("alt+left", function (e: KeyboardEvent) {

        var target = e.target as HTMLElement;
        if (target.tagName === "INPUT") {

            //TODO refactor this away
            var currentTask = getCurrentTask(e.target);
            currentTask.indentLeft();

            applyEdit(e.target);

            //the relationship is known... rerender?
            saveTaskList();
            renderGrid();

            var currentRow = grid.getRowIndex(currentTask.ID);
            grid.editCell(currentRow, grid.getColumnIndex("description"));
        }
    });

    Mousetrap.bind(["alt+up", "alt+down"], function (e: KeyboardEvent, combo) {

        var target = e.target as HTMLElement;
        if (target.tagName === "INPUT") {

            //now holds the current ID
            var currentTask = getCurrentTask(e.target);

            var shouldMoveUp = combo === "alt+up";
            currentTask.changeTaskOrder(shouldMoveUp);

            applyEdit(e.target);

            saveTaskList();
            renderGrid();
            grid.editCell(grid.getRowIndex(currentTask.ID), grid.getColumnIndex("description"));
        }
    });

    Mousetrap.bind(["ctrl+alt+right", "ctrl+alt+left", "ctrl+alt+up", "ctrl+alt+down"], function (ev: KeyboardEvent, combo) {

        var target = ev.target as HTMLElement;
        if (target.tagName === "INPUT" && $(ev.target).parents("#gridList").length) {
            console.log("move cell selector shortcut");

            //if this is a tasklist input, there should be an element, and then rowIndex and columnIndex
            //TODO figure out how to get this element to come through
            var element = target["element"];
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

    Mousetrap.bind("a", function (e: KeyboardEvent) {

        var target = e.target as HTMLElement;
        if (!_.includes(KEYBOARD_CANCEL, target.tagName)) {
            console.log("new task requested from A");
            createNewTask();
            return false;
        }
    });

    Mousetrap.bind("p", function (e: KeyboardEvent) {

        var target = e.target as HTMLElement;
        if (!_.includes(KEYBOARD_CANCEL, target.tagName)) {
            console.log("new project requested from P");

            createNewProject();
            return false;
        }
    });

    Mousetrap.bind("escape escape", function (e: KeyboardEvent) {

        var target = e.target as HTMLElement;
        if (!_.includes(KEYBOARD_CANCEL, target.tagName)) {
            console.log("escape hit x2");

            //clear search
            //TODO make this not do a render
            updateSearch("");

            //clear isolation
            clearIsolation(false);

            //clear selection
            clearSelection(false);

            //this is needed since it is avoided in the other calls
            renderGrid();

            return false;
        }
    });

    Mousetrap.bind("s", function (e: KeyboardEvent) {

        var target = e.target as HTMLElement;
        if (!_.includes(KEYBOARD_CANCEL, target.tagName)) {
            $("#txtSearch").focus();
            return false;
        }
    });

    Mousetrap.bind("q", function (e: KeyboardEvent) {

        var target = e.target as HTMLElement;
        if (!_.includes(KEYBOARD_CANCEL, target.tagName)) {
            sortNow();
            return false;
        }
    });

    Mousetrap.bind("alt+a", function (e: KeyboardEvent) {

        var target = e.target as HTMLElement;

        //TODO these options need to be a real object
        var options = {};

        if (target.tagName === "INPUT") {

            //now holds the current ID
            var currentTask = getCurrentTask(e.target);
            var currentID = currentTask.ID;

            if (currentTask.isProjectRoot) {
                options["parentTask"] = currentTask.ID;
            } else {
                //have the task be below the current one
                options["sortOrder"] = currentTask.sortOrder + 0.5;
                options["parentTask"] = currentTask.parentTask;
            }

            applyEdit(e.target);
        }

        createNewTask(options);
        return false;
    });

    //these events handle the task isolation business
    Mousetrap.bind("alt+q", function (e: KeyboardEvent, combo) {
        console.log("task isolation requested");

        var target = e.target as HTMLElement;

        if (target.tagName === "INPUT") {
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
        });

        var shouldDeselect = _.every(visibleTasks, function (task) {
            return task.isSelected;
        });

        _.each(visibleTasks, function (task) {
            task.isSelected = !shouldDeselect;
        });

        renderGrid();

        return false;
    });

    Mousetrap.bind(["alt+/", "/", "shift+/", "alt+shift+/"], function (e: KeyboardEvent, combo) {
        console.log("show shortcuts called", combo);

        var target = e.target as HTMLElement;

        if (_.includes(KEYBOARD_CANCEL, target.tagName) && !combo.includes("alt")) {
            return;
        }

        $("#modalKeyboard").modal();
        return false;

    });

    Mousetrap.bind("mod+s", function () {
        saveTaskList(true);
        return false;
    });

    Mousetrap.bind("mod+p", function () {
        window.print();
        return false;
    });

    Mousetrap.prototype.stopCallback = function (a, b, c) {
        //this lets the shortcuts go through whenever
        return false;
    };
}

function setupAutocompleteEvents() {
    //TODO pull this put into its own funcion?
    require("jquery-textcomplete");
    $("#gridList").on("DOMNodeInserted", "input", function (ev) {
        //TODO streamline this code since it's all the same
        $(this).textcomplete([{
            match: /(^|\s)#(\w{0,})$/,
            search: function (term, callback) {
                var answer = _.filter(mainTaskList.getAllTags(), function (item) {
                    return item.indexOf(term) >= 0;
                });
                console.log("search");
                callback(answer);
            },
            replace: function (word) {
                return " #" + word + ' ';
            }
        }, {
            match: /(^|\s)@(\w{0,})$/,
            search: function (term, callback) {
                var answer = _.filter(mainTaskList.getAllStatus(), function (item) {
                    return item.indexOf(term) >= 0;
                });
                callback(answer);
            },
            replace: function (word) {
                return " @" + word + ' ';
            }
        }, {
            match: /(^|\s)!(\w{0,})$/,
            search: function (term, callback) {
                var answer = _.filter(mainTaskList.getMilestones(), function (item) {
                    return item.indexOf(term) >= 0;
                });
                callback(answer);
            },
            replace: function (word) {
                return " !" + word + ' ';
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

    $("body").on("DOMNodeRemoved", "input", function (ev) {
        //this will remove the popup when the input is removed.

        var input = ev.target;

        if ($(input).parents("#gridList").length > 0) {
            console.log("inside the gridlist");
        }

        $(this).textcomplete("destroy");
    });
}

//TODO find a better spot for these event related functions

function getCurrentTask(element) {
    //find the element above that is the tr (contains the ID)
    var currentID = $(element).parents("tr")[0].id;
    currentID = currentID.split("task-list_")[1];
    currentID = parseInt(currentID);

    //now holds the current ID
    var currentTask = mainTaskList.tasks[currentID];

    return currentTask;
}

function applyEdit(element, shouldCancel = false) {
    var editor = (element instanceof Column) ? element.cellEditor : element.celleditor;
    //if editing or a change was made, apply that change
    // backup onblur then remove it: it will be restored if editing could not be applied
    element.onblur_backup = element.onblur;
    element.onblur = null;

    if (shouldCancel) {
        editor.cancelEditing(element.element);
    } else {

        if (editor.applyEditing(element.element, editor.getEditorValue(element)) === false) {
            element.onblur = element.onblur_backup;
        }
    }
}