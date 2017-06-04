var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var SCOPES = ['https://www.googleapis.com/auth/drive'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'drive-nodejs-quickstart.json';
//TODO clean this up into an actual class
function DriveStorage() {
    // If modifying these scopes, delete your previously saved credentials
    // at ~/.credentials/drive-nodejs-quickstart.json
}
// Load client secrets from a local file.
DriveStorage.prototype.startAuth = function (callback) {
    var self = this;
    //pull the secret in instead of reading the file
    var content = require("./client_secret.json");
    // Authorize a client with the loaded credentials, then call the
    // Drive API.
    self.authorize(content, function (oauth2Client) {
        console.log("authorization was good!", oauth2Client);
        self.auth = oauth2Client;
        callback();
    });
};
/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
DriveStorage.prototype.authorize = function (credentials, callback) {
    var clientSecret = credentials.installed.client_secret;
    var clientId = credentials.installed.client_id;
    var auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(clientId, clientSecret, "http://localhost:9004");
    // Check if we have previously stored a token.
    var self = this;
    fs.readFile(TOKEN_PATH, function (err, token) {
        if (err) {
            self.getNewToken(oauth2Client, callback);
        }
        else {
            oauth2Client.credentials = JSON.parse(token);
            callback(oauth2Client);
        }
    });
};
/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
DriveStorage.prototype.getNewToken = function (oauth2Client, callback) {
    var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });
    //opens the desired auth page
    var open = require("open");
    open(authUrl);
    var self = this;
    //need to spin up a server quickly here to accept the call back
    var http = require("http");
    var server = http.createServer(function (request, response) {
        response.end("You can close this window now.");
        //process the code that is sent in
        var url = require("url");
        oauth2Client.getToken(url.parse(request.url, true).query.code, function (err, token) {
            if (err) {
                console.log('Error while trying to retrieve access token', err);
                return;
            }
            oauth2Client.credentials = token;
            self.storeToken(token);
            server.close(function () {
                console.log("server closed");
            });
            //TODO clean this up
            callback(oauth2Client);
        });
    });
    server.listen(9004);
    console.log("Server is listening");
    //TODO need a check down here to make sure that things don't stay open too long
};
/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
DriveStorage.prototype.storeToken = function (token) {
    try {
        fs.mkdirSync(TOKEN_DIR);
    }
    catch (err) {
        if (err.code !== 'EEXIST') {
            throw err;
        }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log('Token stored to ' + TOKEN_PATH);
};
/**
 * Lists the names and IDs of up to 10 files.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
DriveStorage.prototype.listFiles = function (callback) {
    var self = this;
    var service = google.drive({
        version: 'v3',
        auth: self.auth
    });
    service.files.list({
        pageSize: 10,
        q: "mimeType='text/tasklist'",
        fields: "nextPageToken, files(id, name)"
    }, function (err, response) {
        if (err) {
            console.log('The API returned an error: ' + err);
            return;
        }
        var files = response.files;
        if (files.length === 0) {
            console.log('No files found.');
        }
        else {
            console.log('Files', files);
            //fire back control
            callback(files);
        }
    });
};
DriveStorage.prototype.storeFile = function (contents, fileName, fileId, callback) {
    var self = this;
    var drive = google.drive({
        version: 'v3',
        auth: self.auth
    });
    fileName = fileName + ".json";
    if (fileId === undefined) {
        //new file to create
        drive.files.create({
            resource: {
                name: fileName,
                mimeType: 'text/tasklist'
            },
            media: {
                mimeType: 'text/plain',
                body: contents
            }
        }, function (err, file) {
            if (err) {
                // Handle error
                console.log(err);
            }
            else {
                console.log('File Id:', file.id);
                callback(file.id);
                //TODO need to return this back to the TaskList
            }
        });
    }
    else {
        drive.files.update({
            resource: {
                name: fileName,
                mimeType: 'text/tasklist'
            },
            fileId: fileId,
            media: {
                mimeType: 'text/plain',
                body: contents
            }
        }, function (err, file) {
            if (err) {
                // Handle error
                console.log(err);
            }
            else {
                console.log('File Id:', file.id);
                callback(fileId);
                //TODO need to return this back to the TaskList
            }
        });
    }
};
DriveStorage.prototype.downloadFile = function (file, callback) {
    var fileId = file.id;
    var fileName = file.name;
    var path = './tmp/' + fileName;
    var self = this;
    console.log("try to download", fileId);
    var drive = google.drive({
        version: 'v3',
        auth: self.auth
    });
    var dest = fs.createWriteStream(path);
    drive.files.get({
        fileId: fileId,
        alt: "media"
    })
        .on('end', function () {
        console.log('Done');
        callback(path);
    })
        .on('error', function (err) {
        console.log('Error during download', err);
    })
        .pipe(dest);
};
var taskToDelete;
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
                }
                else {
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
        }
        else {
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
    Mousetrap.bind("alt+right", function (e) {
        var target = e.target;
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
    Mousetrap.bind("alt+left", function (e) {
        var target = e.target;
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
    Mousetrap.bind(["alt+up", "alt+down"], function (e, combo) {
        var target = e.target;
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
    Mousetrap.bind(["ctrl+alt+right", "ctrl+alt+left", "ctrl+alt+up", "ctrl+alt+down"], function (ev, combo) {
        var target = ev.target;
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
    Mousetrap.bind("a", function (e) {
        var target = e.target;
        if (!_.includes(KEYBOARD_CANCEL, target.tagName)) {
            console.log("new task requested from A");
            createNewTask();
            return false;
        }
    });
    Mousetrap.bind("p", function (e) {
        var target = e.target;
        if (!_.includes(KEYBOARD_CANCEL, target.tagName)) {
            console.log("new project requested from P");
            createNewProject();
            return false;
        }
    });
    Mousetrap.bind("escape escape", function (e) {
        var target = e.target;
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
    Mousetrap.bind("s", function (e) {
        var target = e.target;
        if (!_.includes(KEYBOARD_CANCEL, target.tagName)) {
            $("#txtSearch").focus();
            return false;
        }
    });
    Mousetrap.bind("q", function (e) {
        var target = e.target;
        if (!_.includes(KEYBOARD_CANCEL, target.tagName)) {
            sortNow();
            return false;
        }
    });
    Mousetrap.bind("alt+a", function (e) {
        var target = e.target;
        //TODO these options need to be a real object
        var options = {};
        if (target.tagName === "INPUT") {
            //now holds the current ID
            var currentTask = getCurrentTask(e.target);
            var currentID = currentTask.ID;
            if (currentTask.isProjectRoot) {
                options["parentTask"] = currentTask.ID;
            }
            else {
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
    Mousetrap.bind("alt+q", function (e, combo) {
        console.log("task isolation requested");
        var target = e.target;
        if (target.tagName === "INPUT") {
            //we have a text box
            var currentTask = getCurrentTask(e.target);
            var currentID = currentTask.ID;
            applyEdit(e.target);
            mainTaskList.idForIsolatedTask = currentID;
            //clear the search when changing isolation
            updateSearch("");
        }
        else {
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
    Mousetrap.bind(["alt+/", "/", "shift+/", "alt+shift+/"], function (e, combo) {
        console.log("show shortcuts called", combo);
        var target = e.target;
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
    }
    else {
        if (editor.applyEditing(element.element, editor.getEditorValue(element)) === false) {
            element.onblur = element.onblur_backup;
        }
    }
}
var renderGrid = function () {
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
};
function updateBreadcrumbs() {
    //TODO need to fix variable names
    var breadcrumbs = mainTaskList.getCrumbs();
    var clearItem = $("#btnClearIsolation");
    $("#hidden").append(clearItem);
    //clear out the tag bucket
    var breadcrumbBucket = $("#breadcumbs");
    breadcrumbBucket.empty();
    //this will hide the breadbrumbs if isolatiojn is just a project (or nothing)
    if (mainTaskList.idForIsolatedTask === undefined || mainTaskList.tasks[mainTaskList.idForIsolatedTask].isProjectRoot) {
        breadcrumbBucket.hide();
        return;
    }
    else {
        breadcrumbBucket.show();
    }
    //create the clear isolation button
    console.log(clearItem);
    breadcrumbBucket.append(clearItem);
    //add a new span for each one
    _.each(breadcrumbs, function (breadcrumb) {
        var label = $("<li/>").appendTo(breadcrumbBucket);
        var aDom = $("<a/>").attr("href", "#").text(breadcrumb.description).appendTo(label);
        //set up a click event on the LABEL... does not work for the input
        //TODO swap this for a delegated event
        $(label).on("click", function (ev) {
            mainTaskList.idForIsolatedTask = breadcrumb.ID;
            renderGrid();
        });
    });
}
function updateProjectBucket() {
    var projects = mainTaskList.getProjectsInList();
    //clear out the tag bucket
    var projectBucket = $("#projectBucket");
    projectBucket.empty();
    if (projects.length === 1) {
        projectBucket.hide();
        return;
    }
    else {
        projectBucket.show();
    }
    $(".gridMove").empty();
    //add the buttons to move the task
    _.each(projects, function (project) {
        var label = $("<li/>").attr("data-project", project.ID);
        var aDom = $("<a/>").attr("href", "#").text(project.description).appendTo(label);
        if (project.ID === mainTaskList.idForIsolatedTask) {
            //skip current project
            return;
        }
        //add the mover to all buttons
        $(".gridMove").append(label);
    });
    var dummyTask = new Task(null, false);
    dummyTask.description = "all projects";
    dummyTask.ID = null;
    projects.unshift(dummyTask);
    //add a new span for each one
    _.each(projects, function (project) {
        var label = $("<li/>").appendTo(projectBucket);
        var aDom = $("<a/>").attr("href", "#").text(project.description).appendTo(label);
        if (project.ID === mainTaskList.idForIsolatedTask) {
            label.addClass("active");
        }
        //set up a click event on the LABEL... does not work for the input
        //TODO swap this for a delegated event
        $(label).on("click", function (ev) {
            mainTaskList.idForIsolatedTask = project.ID;
            renderGrid();
        });
    });
}
function updateTagBucket() {
    var tags = mainTaskList.getAllTags().sort();
    tags.push("<none>");
    //clear out the tag bucket
    var tagBucket = $("#tagBucket");
    tagBucket.empty();
    //add a new span for each one
    _.each(tags, function (tag) {
        var label = $("<li/>").appendTo(tagBucket).attr("class", "label-search").attr("data-type", "tags");
        var aDom = $("<a/>").attr("href", "#").text(tag).appendTo(label);
    });
}
function updateStatusBucket() {
    var tags = mainTaskList.getAllStatus().sort();
    tags.push("<none>");
    //clear out the tag bucket
    var tagBucket = $("#statusBucket");
    tagBucket.empty();
    //add a new span for each one
    _.each(tags, function (tag) {
        var label = $("<li/>").appendTo(tagBucket).attr("class", "label-search").attr("data-type", "status");
        var aDom = $("<a/>").attr("href", "#").text(tag).appendTo(label);
    });
}
function updateMilestoneBucket() {
    var tags = mainTaskList.getMilestones().sort();
    tags.push("<none>");
    //TODO update variable names
    //clear out the tag bucket
    var tagBucket = $("#milestoneBucket");
    tagBucket.empty();
    //add a new span for each one
    _.each(tags, function (tag) {
        var label = $("<li/>").appendTo(tagBucket).attr("class", "label-search").attr("data-type", "milestone");
        var aDom = $("<a/>").attr("href", "#").text(tag).appendTo(label);
    });
}
function updateSelectionMenu() {
    //determine if anything is selected
    var selected = _.some(mainTaskList.tasks, function (item) {
        return item.isSelected;
    });
    if (selected) {
        $("#selectionMenu").show();
    }
    else {
        $("#selectionMenu").hide();
    }
}
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
//these requires are needed in order to load objects on the Browser side of things
var app = require('electron').remote;
var dialog = app.dialog;
var _ = require("lodash");
var jQuery = require("jquery");
var $ = jQuery;
//these requires were added to split up code.... hopefully
var grid;
//TODO clean this section up to hide these variables
//declare any local/global variables
var shouldAddTaskWhenDoneEditing = false;
var shouldDeleteTaskWhenDoneEditing = false;
var localDrive;
var mainTaskList;
var KEYBOARD_CANCEL = ["INPUT", "TEXTAREA"];
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
function updateSearch(searchTerm = "", shouldFocus = true, shouldRender = true) {
    //when called on a "bare" event handler, the parameter coming in is an event object
    if (typeof searchTerm !== "string") {
        searchTerm = "";
    }
    var curVal = $("#txtSearch").val();
    //don't search if no change
    if (curVal === searchTerm) {
        return;
    }
    $("#txtSearch").val(searchTerm).keyup();
    if (shouldFocus) {
        $("#txtSearch").focus();
    }
}
//check if the filename is already in the list
function addFileToRecentFileList(fileName) {
    _.remove(LocalStorageManager.recentFiles, function (item) {
        return (item === fileName);
    });
    LocalStorageManager.recentFiles.unshift(fileName);
    //if not, add to the top of the list
    localStorage.setItem("recentFiles", JSON.stringify(LocalStorageManager.recentFiles));
    updateRecentFileButton();
}
function updateRecentFileButton() {
    if (LocalStorageManager.recentFiles.length > 0) {
        $("#recentFileGroup").empty();
    }
    _.each(LocalStorageManager.recentFiles, function (fileName) {
        var label = $("<li/>").appendTo("#recentFileGroup");
        var aDom = $("<a/>").attr("href", "#").text(fileName).appendTo(label);
        //set up a click event on the LABEL... does not work for the input
        //TODO swap this for a delegated event
        $(label).on("click", function (ev) {
            loadTaskListWithPrompt(fileName, "");
        });
    });
}
function resizeBasedOnNavbar() {
    //get the height of the navbar
    var navbar = $("#navbar");
    //update the padding on the main element
    var height = navbar.height() + 5;
    $("body").css("padding-top", height + "px");
}
function loadTaskListWithPrompt(fileName, driveId) {
    if (mainTaskList.path === "" && !mainTaskList.isDefaultList()) {
        showSavePrompt(function () {
            TaskList.load(fileName, loadTaskListCallback, driveId);
        });
    }
    else {
        TaskList.load(fileName, loadTaskListCallback, driveId);
    }
}
function loadTaskListCallback(loadedTaskList) {
    mainTaskList = loadedTaskList;
    _.each(LocalStorageManager.visibleColumns, function (columnName) {
        mainTaskList.columns[columnName].active = true;
    });
    //get first project in file and isolate on it
    var projects = mainTaskList.getProjectsInList();
    console.log("loader proj", projects);
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
        showAlert("File stored on Google Drive");
        mainTaskList.googleDriveId = fileId;
    });
}
function authorizeGoogleDrive(callback) {
    localDrive = new DriveStorage();
    localDrive.startAuth(function () {
        showAlert("Google Drive has been authorized.  Check Google Drive -> Load menu to see files.");
        callback();
    });
}
function updateDriveFileButton(fileList) {
    console.log("files inside func", fileList);
    var driveGroup = $("#driveFileGroup");
    if (fileList.length > 0) {
        driveGroup.empty();
    }
    _.each(fileList, function (driveFile) {
        var label = $("<li/>").appendTo(driveGroup);
        var aDom = $("<a/>").attr("href", "#").text(driveFile.name).appendTo(label);
        //set up a click event on the LABEL... does not work for the input
        $(label).on("click", function (ev) {
            //TODO need to wire this up
            console.log("load the file from drive", driveFile.id);
            localDrive.downloadFile(driveFile, function (path) {
                console.log("downloaded file to ", path);
                loadTaskListWithPrompt(path, driveFile.id);
            });
        });
    });
}
function sortNow() {
    var isSortEnabled = mainTaskList.isSortEnabled;
    mainTaskList.isSortEnabled = true;
    renderGrid();
    mainTaskList.isSortEnabled = isSortEnabled;
    showAlert("Tasklist sorted");
    saveTaskList();
}
function saveTaskList(shouldPromptForFilename = false) {
    if (shouldPromptForFilename && mainTaskList.path === "") {
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
        });
    }
    var didSave = mainTaskList.save();
    if (didSave) {
        showAlert("tasklist was saved", "success");
    }
}
function createNewTask(options = {}) {
    var newTask = mainTaskList.getNew();
    newTask.description = "new task";
    newTask.isFirstEdit = true;
    _.assign(newTask, options);
    //assign child for the parent
    if (newTask.parentTask === null) {
        newTask.parentTask = mainTaskList.idForIsolatedTask;
    }
    if (newTask.parentTask !== null) {
        mainTaskList.tasks[newTask.parentTask].childTasks.push(newTask.ID);
        renderGrid();
        grid.editCell(grid.getRowIndex(newTask.ID), grid.getColumnIndex("description"));
    }
    else {
        //this will prevent the task from being added if it has no parent
        console.log("stranded task removed");
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
    grid.editCell(grid.getRowIndex(newProjectTask.ID), grid.getColumnIndex("description"));
}
function createNewTasklist() {
    var newList = TaskList.createNewTaskList();
    loadTaskListCallback(newList);
    createNewTask();
}
function clearIsolation(shouldRender = true) {
    var projects = mainTaskList.getProjectsInList();
    var projectCount = projects.length;
    //if there is only one project, isolate it
    mainTaskList.idForIsolatedTask = (projectCount === 1) ? projects[0].ID : null;
    if (shouldRender) {
        renderGrid();
    }
}
function activateTooltipPlugin() {
    //this will allow Bootstrap to drive the tooltips
    console.log("init the tooltips");
    $("button").tooltip({ trigger: "hover" });
    $(".dropdown-toggle").on("click", function () {
        //hide all tooltips
        $("button").tooltip("hide");
    });
}
//clear selection, render grid
function clearSelection(shouldRender = true) {
    _.each(mainTaskList.tasks, function (task) {
        task.isSelected = false;
    });
    if (shouldRender) {
        renderGrid();
    }
}
function createColumnShowAndSort() {
    //set up the column chooser
    _.each(mainTaskList.getListOfColumns(), function (columnName) {
        //create the label and the actual input element
        if (columnName === "action") {
            //skip showing the action column
            return;
        }
        /*
        <li>
                                    <div class="btn-group">
                                        <a class="btn btn-default active">ID</a>
                                        <a class="btn btn-default"><span class="glyphicon glyphicon-arrow-up"></a>
                                        <a class="btn btn-default"><span class="glyphicon glyphicon-arrow-down"></a>
                                    </div>
                                </li>
                                */
        var li = $("<li/>").appendTo("#columnChooser");
        var btnGroup = $("<div/>").appendTo(li).attr("class", "btn-group btn-group-flex");
        var anchor = $("<a/>").appendTo(btnGroup).attr("class", "btn btn-default sort-desc");
        //add the arrows
        var aArrowUp = $("<a/>").appendTo(btnGroup).attr("class", "btn btn-default sort-arrow").data("dir", "asc");
        var span = $("<span/>").appendTo(aArrowUp).attr("class", "glyphicon glyphicon-arrow-up");
        var aArrowDown = $("<a/>").appendTo(btnGroup).attr("class", "btn btn-default sort-arrow").data("dir", "desc");
        span = $("<span/>").appendTo(aArrowDown).attr("class", "glyphicon glyphicon-arrow-down");
        anchor.text(columnName);
        if (LocalStorageManager.visibleColumns.indexOf(columnName) > -1) {
            anchor.addClass("active");
            mainTaskList.columns[columnName].active = true;
        }
        //set up a click event on the LABEL... does not work for the input
        $(anchor).on("click", function (ev) {
            console.log("show/hide column click");
            //this seems to be opposite of the actual value
            var isActive = !$(this).hasClass("active");
            $(this).toggleClass("active");
            mainTaskList.columns[columnName].active = isActive;
            if (isActive) {
                LocalStorageManager.visibleColumns.push(columnName);
            }
            else {
                _.remove(LocalStorageManager.visibleColumns, function (item) {
                    return item === columnName;
                });
            }
            //update the local storage
            localStorage.setItem("visibleColumns", JSON.stringify(LocalStorageManager.visibleColumns));
            renderGrid();
        });
        //TODO add a check for the ASC/DESC flag
        if (columnName === mainTaskList.sortField && mainTaskList.sortDir === "desc") {
            aArrowDown.addClass("active");
        }
        else if (columnName === mainTaskList.sortField && mainTaskList.sortDir === "asc") {
            aArrowUp.addClass("active");
        }
        //add just combines the jQuery objects, no underlying change
        aArrowUp.add(aArrowDown).on("click", function (ev) {
            console.log("sort clicked", this, $(this).data("dir"));
            //this seems to be opposite of the actual value
            mainTaskList.sortField = columnName;
            mainTaskList.sortDir = $(this).data("dir");
            sortNow();
            $("#columnChooser .sort-arrow").removeClass("active");
            $(this).addClass("active");
        });
    });
}
function setupMainPageTasks() {
    //this is currently a dumping ground to get events created
    //create a blank task list to start
    mainTaskList = new TaskList();
    //set up the grid related events
    //TODO remove this hack    
    grid = (new TaskGrid()).getGrid();
    LocalStorageManager.setupLocalStorage();
    createColumnShowAndSort();
    setupEvents();
    createNewTasklist();
    //size things correctly at end
    resizeBasedOnNavbar();
    activateTooltipPlugin();
}
$(document).ready(setupMainPageTasks);
class LocalStorageManager {
    static setupLocalStorage() {
        //load the recent file list from localStorage
        LocalStorageManager.recentFiles = JSON.parse(localStorage.getItem("recentFiles"));
        if (LocalStorageManager.recentFiles === null) {
            LocalStorageManager.recentFiles = [];
        }
        updateRecentFileButton();
        LocalStorageManager.visibleColumns = JSON.parse(localStorage.getItem("visibleColumns"));
        if (LocalStorageManager.visibleColumns === null) {
            LocalStorageManager.visibleColumns = ["description"];
        }
    }
    ;
}
LocalStorageManager.recentFiles = [];
LocalStorageManager.visibleColumns = [];
class Task {
    constructor(taskList, shouldGetId = true) {
        this.taskList = taskList;
        //TODO change this out to use a data object instead of fields
        this.description = "";
        this.duration = 0;
        this.startDate = null;
        this.endDate = null;
        this.ID = (shouldGetId) ? Task.getUnique : -1;
        this.dateAdded = new Date();
        this.isComplete = false;
        //some new fields for testing
        this.priority = "";
        this.tags = [];
        this.status = null;
        this.milestone = null;
        this.comments = "";
        this.isFirstEdit = false;
        this.isProjectRoot = false;
        //these will be integers that store the ID
        this.parentTask = null;
        this.childTasks = [];
        this.indent = 0;
        this.isSelected = false;
        this.sortOrder = Number.MAX_SAFE_INTEGER;
        this.isVisible = true;
    }
    isResultForSearch(searchTerm) {
        //check each part of the task to see if it appears
        //do a check if the searchTerm is a string (wildcard) or object
        if (typeof searchTerm === "string") {
            //return true if any
            //TODO swap this for a "some" to avoid the negations
            var hasNoMatch = _.every(this, function (item) {
                var isMatch = false;
                if (item === null) {
                    return true;
                }
                if (typeof item === "string") {
                    isMatch = item.toUpperCase().indexOf(searchTerm.toUpperCase()) !== -1;
                }
                else {
                    isMatch = (item === searchTerm);
                }
                return !isMatch;
            });
            return !hasNoMatch;
        }
        else {
            var task = this;
            var allMatch = _.every(_.keys(searchTerm), function (key) {
                //for each key need to check if that value is equal to value
                if (task[key] !== null && typeof task[key] === "object") {
                    //this is an array
                    if (searchTerm[key] === "<none>") {
                        //do a test for the none case
                        return task[key].length === 0;
                    }
                    return task[key].indexOf(searchTerm[key]) > -1;
                }
                else {
                    //this is a bare field
                    if (searchTerm[key] === "<none>") {
                        //do a test for the none case
                        return task[key] === "" || task[key] === null;
                    }
                    return task[key] === searchTerm[key];
                }
            });
            return allMatch;
        }
    }
    static createFromData(data, taskList) {
        //this will create a task from a given JSON object
        var task = new Task(taskList, false);
        var _ = require("lodash");
        _.map(data, function (value, index) {
            task[index] = value;
        });
        if (data.ID > Task._id || !Task._id) {
            Task._id = data.ID + 1;
        }
        if (task.status === "") {
            task.status = null;
        }
        return task;
    }
    static get getUnique() {
        if (!Task._id) {
            Task._id = 1;
        }
        Task._id = Task._id + 1;
        return Task._id;
    }
    completeTask(isComplete) {
        //this will flip completion on the current task
        this.isComplete = (isComplete === undefined) ? !this.isComplete : isComplete;
        //check if there are any children, if so, complete those also
        var self = this;
        _.each(this.childTasks, function (childTaskIndex) {
            var childTask = self.taskList.tasks[childTaskIndex];
            childTask.completeTask(self.isComplete);
        });
    }
    removeTask() {
        //delete the children task
        var self = this;
        _.each(this.childTasks, function (childTaskIndex) {
            var childTask = self.taskList.tasks[childTaskIndex];
            childTask.removeTask();
        });
        self.taskList.removeTask(self.ID);
        //delete the current task from the task list
    }
    updateDescriptionBasedOnDataFields() {
        //take the current description
        //do the split step
        var parts = this.description.split(" ");
        var partsToKeep = [];
        _.each(parts, function (part) {
            switch (part[0]) {
                case "#":
                case "@":
                case "!":
                    break;
                default:
                    partsToKeep.push(part);
            }
        });
        //now that the task fields are updated, update the desc
        _.each(this.tags, function (tag) {
            partsToKeep.push("#" + tag);
        });
        if (this.status !== null) {
            partsToKeep.push("@" + this.status);
        }
        if (this.milestone !== null) {
            partsToKeep.push("!" + this.milestone);
        }
        //now add the remaining parts
        var newDesc = _.filter(partsToKeep, function (item) {
            return item !== "";
        }).join(" ");
        this.description = newDesc;
    }
    updateDependentProperties() {
        //update desc
        this.updateDescriptionBasedOnDataFields();
        //need to take an array of fields and run through them
        if (this.childTasks.length === 0) {
            //nothing to do without children
            return;
        }
        //TODO move this object out of this function call, waste of resources
        var transForms = {
            "duration": "sum"
        };
        var self = this;
        //values will hold an array of values for each field that is being tracked in transForms
        var values = {};
        _.each(this.childTasks, function (childTaskIndex) {
            var childTask = self.taskList.tasks[childTaskIndex];
            childTask.updateDependentProperties();
            //stick each set of values into an array
            _.each(transForms, function (value, key) {
                if (values[key] === undefined) {
                    values[key] = [];
                }
                //TODO this needs to become a more general calculation
                if (!childTask.isComplete) {
                    values[key].push(childTask[key]);
                }
            });
        });
        //iterate the array of values and update the values for this task
        _.each(transForms, function (value, key) {
            //this is a very magic way to get the function
            //lodash has sum/min/max as functions
            //this pulls the correct function and applies it to the current transForms field
            self[key] = _[value](values[key]);
        });
    }
    getObjectForSaving() {
        //this will be used up above, ideally they match
        return {
            "ID": this.ID,
            "description": this.description,
            "comments": this.comments,
            "priority": this.priority,
            "duration": this.duration,
            "startDate": this.startDate,
            "endDate": this.endDate,
            "dateAdded": this.dateAdded,
            "parentTask": this.parentTask,
            "childTasks": this.childTasks,
            "sortOrder": this.sortOrder,
            "status": this.status,
            "milestone": this.milestone,
            "isComplete": this.isComplete,
            "isProjectRoot": this.isProjectRoot,
            "tags": this.tags
        };
    }
    setDataValue(field, value) {
        console.log("task set info", typeof this[field]);
        if (typeof this[field] === "object") {
            if (value === "") {
                this[field] = [];
            }
            else {
                //assume this is a CSV string and split
                var parts = value.split(",");
                parts = _.map(parts, function (part) {
                    return part.trim();
                });
                console.log("will set obj", field, parts);
                this[field] = parts;
            }
        }
        else {
            console.log("will set", field, value);
            this[field] = value;
        }
    }
    indentLeft() {
        var currentTask = this;
        var currentID = currentTask.ID;
        if (currentTask.parentTask === null) {
            return;
        }
        var aboveId = currentTask.parentTask;
        var aboveTask = this.taskList.tasks[aboveId];
        if (aboveTask.parentTask === null) {
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
        if (grandparentID !== null) {
            var grandparentTask = this.taskList.tasks[grandparentID];
            grandparentTask.childTasks.push(currentID);
            console.log("grandparent task after adding", grandparentTask);
        }
    }
    indentRight() {
        var currentTask = this;
        var aboveTask = this.getTaskAbove();
        //remove the current parent if it exists
        if (currentTask.parentTask !== null) {
            var parentTask = this.taskList.tasks[currentTask.parentTask];
            var parentChildIndex = parentTask.childTasks.indexOf(currentTask.ID);
            parentTask.childTasks.splice(parentChildIndex, 1);
        }
        //need to set the parent for the current and the child for the above
        currentTask.parentTask = aboveTask.ID;
        aboveTask.childTasks.push(currentTask.ID);
    }
    getTaskAbove() {
        //TODO add some checks here on parentTask and aboveId
        //get the parent task
        var parentTask = this.taskList.tasks[this.parentTask];
        //sort the children by sortOrder
        var self = this;
        var sorted = _.sortBy(parentTask.childTasks, function (a) {
            return self.taskList.tasks[a].sortOrder;
        });
        //find the current item in that list
        var index = sorted.indexOf(this.ID);
        var indexAbove = index - 1;
        var aboveId = sorted[indexAbove];
        return this.taskList.tasks[aboveId];
    }
    changeTaskOrder(shouldMoveUp = true) {
        var currentTask = this;
        if (shouldMoveUp) {
            currentTask.sortOrder -= 1.1;
        }
        else {
            currentTask.sortOrder += 1.1;
        }
    }
    moveTaskToProject(newTaskId) {
        var currentTask = this;
        var newProjectId = newTaskId;
        var newProject = this.taskList.tasks[newProjectId];
        if (currentTask.parentTask !== null) {
            var parentTask = this.taskList.tasks[currentTask.parentTask];
            var parentChildIndex = parentTask.childTasks.indexOf(currentTask.ID);
            parentTask.childTasks.splice(parentChildIndex, 1);
        }
        //need to set the parent for the current and the child for the above
        currentTask.parentTask = newProjectId;
        newProject.childTasks.push(currentTask.ID);
        //remove project flag if project is being moved
        if (currentTask.isProjectRoot) {
            currentTask.isProjectRoot = false;
            this.taskList.idForIsolatedTask = newProject.ID;
        }
    }
}
Task._id = 1;
;
class TaskList {
    constructor() {
        this.tasks = {};
        this.sortField = "priority";
        this.sortDir = "desc";
        this.isSortEnabled = false;
        this.searchTerm = "";
        this.searchObj = {};
        this.searchChildren = false;
        this.searchParents = false;
        this.visibleTasks = {};
        this.path = "";
        this.googleDriveId = undefined;
        this.title = "TaskList";
        this.idForIsolatedTask = undefined;
        this.hideRootIfIsolated = false;
        this.shouldExcludeCompleteTasksForBuckets = true;
        this.shouldShowCommentsWithDesc = true;
        this.shouldHideComplete = true;
        this._possibleColumns = [
            { "name": "action", "label": "", "datatype": "action", "editable": false, "active": true },
            { "name": "ID", "label": "id", "datatype": "integer,,-1,,,", "editable": false, "active": false },
            { "name": "description", "label": "desc", "datatype": "hashtag", "editable": true, "active": false },
            { "name": "duration", "label": "duration", "datatype": "double", "editable": true, "active": false },
            { "name": "priority", "label": "priority", "datatype": "integer", "editable": true, "active": false },
            { "name": "status", "label": "status", "datatype": "string", "editable": true, "active": false },
            { "name": "tags", "label": "tags", "datatype": "array", "editable": true, "active": false },
            { "name": "milestone", "label": "milestone", "datatype": "string", "editable": true, "active": false },
            { "name": "comments", "label": "comments", "datatype": "string", "editable": true, "active": false },
            { "name": "dateAdded", "label": "added", "datatype": "date", "editable": true, "active": false },
            { "name": "startDate", "label": "start", "datatype": "date", "editable": true, "active": false },
            { "name": "endDate", "label": "end", "datatype": "date", "editable": true, "active": false }
        ];
        this.columns = _.keyBy(this._possibleColumns, "name");
    }
    getAllTags() {
        var tags = [];
        var self = this;
        _.each(this.tasks, function (item) {
            if (item.isComplete && self.shouldExcludeCompleteTasksForBuckets) {
                return true;
            }
            _.each(item.tags, function (tag) {
                if (tags.indexOf(tag) === -1) {
                    tags.push(tag);
                }
            });
        });
        tags.sort();
        return tags;
    }
    getAllStatus() {
        var status = [];
        var self = this;
        _.each(this.tasks, function (task) {
            if (task.isComplete && self.shouldExcludeCompleteTasksForBuckets) {
                return true;
            }
            if (status.indexOf(task.status) === -1 && task.status !== null) {
                status.push(task.status);
            }
        });
        status.sort();
        return status;
    }
    assignStrandedTasksToCurrentIsolationLevel() {
        var self = this;
        _.each(this.tasks, function (task) {
            if (task.parentTask === null && !task.isProjectRoot) {
                task.parentTask = self.idForIsolatedTask;
                self.tasks[self.idForIsolatedTask].childTasks.push(task.ID);
            }
        });
    }
    getProjectsInList() {
        var projects = [];
        _.each(this.tasks, function (task) {
            if (task.isProjectRoot) {
                projects.push(task);
            }
        });
        projects.sort();
        return projects;
    }
    getMilestones() {
        var projects = [];
        var self = this;
        _.each(this.tasks, function (task) {
            if (task.isComplete && self.shouldExcludeCompleteTasksForBuckets) {
                return true;
            }
            if (projects.indexOf(task.milestone) === -1 && task.milestone !== null) {
                projects.push(task.milestone);
            }
        });
        return projects;
    }
    getCrumbs() {
        //need to return these in top down order
        //get the isolation level, and work up through parents until there is none
        var crumbsOut = [];
        //return an array of tasks
        var bottomTask = this.tasks[this.idForIsolatedTask];
        while (bottomTask !== null) {
            crumbsOut.unshift(bottomTask);
            if (bottomTask.parentTask === null) {
                bottomTask = null;
            }
            else {
                bottomTask = this.tasks[bottomTask.parentTask];
            }
        }
        return crumbsOut;
    }
    getGridDataObject() {
        var gridDataObject = {
            "metadata": _.filter(this.columns, "active"),
            "data": this._processGridData(),
            "settings": {
                showComments: this.shouldShowCommentsWithDesc
            }
        };
        return gridDataObject;
    }
    _processGridData() {
        //get a list of all tasks
        //iterate through them
        //if they have a child... process the child next... same for that child
        //if they have a parent... skip and let the parent find them first
        //all tasks with either be at the root or have a parent
        //if at the root, add to the root, and process the child tasks, just push them on
        //do a depth first search and all will get added
        var tasksOut = [];
        //these checks set the sort column if used
        this.activeSortField = (this.isSortEnabled) ? this.sortField : "sortOrder";
        this.activeSortDir = (this.isSortEnabled) ? this.sortDir : "asc";
        //process the searchTerm
        //split on spaces, split on colon, build object
        //TODO split this out to get the search in a single place
        this.searchObj = this.searchTerm;
        var searchTextParts = this.searchTerm.split(" ");
        var self = this;
        _.each(searchTextParts, function (spaces) {
            if (spaces.indexOf(":") > -1) {
                var parts = spaces.split(":");
                if (typeof self.searchObj !== "object") {
                    self.searchObj = {};
                }
                self.searchObj[parts[0]] = parts[1];
            }
        });
        //run through children to update any dependent properties
        this.getPseudoRootNode().updateDependentProperties();
        //run the searches
        this.determineIfTasksAreVisible();
        //process children
        if (this.idForIsolatedTask === null) {
            this.recurseChildren(this.getPseudoRootNode(), -1, tasksOut);
        }
        else {
            //do the recursion only on the selected task
            var isolatedTask = this.tasks[this.idForIsolatedTask];
            //this will start at -1 (ignored) or 0 depending on flag.
            var startLevel = (this.hideRootIfIsolated) ? -1 : 0;
            this.recurseChildren(isolatedTask, startLevel, tasksOut);
        }
        //need to build tasks out down here based on the task visible option
        return _.map(tasksOut, function (item) {
            return { "id": item.ID, "values": item };
        });
    }
    determineIfTasksAreVisible() {
        //iterate each task and run the search
        var self = this;
        var tasksToProcessAgain = [];
        _.each(this.tasks, function (task) {
            var searchResult = self.searchTerm === "" || task.isResultForSearch(self.searchObj);
            var showBecauseComplete = (self.shouldHideComplete) ? !task.isComplete : true;
            var showBecauseNew = task.isFirstEdit;
            if ((searchResult && showBecauseComplete) || showBecauseNew) {
                tasksToProcessAgain.push(task);
                task.isVisible = true;
            }
            else {
                task.isVisible = false;
            }
        });
        _.each(tasksToProcessAgain, function (task) {
            if (self.searchChildren) {
                //add the kids
                this.recurseMakeVisible(task);
            }
            if (self.searchParents) {
                //add the parents
                //TODO rename the variables, this is awful
                var parentTaskId = task.parentTask;
                while (parentTaskId !== null) {
                    var parentTask = self.tasks[parentTaskId];
                    parentTask.isVisible = !parentTask.isComplete;
                    parentTaskId = parentTask.parentTask;
                }
            }
        });
        //at this point, all of the tasks have visibility set
    }
    recurseMakeVisible(childTask) {
        _.each(childTask.childTasks, (childTaskID) => {
            this.recurseMakeVisible(this.tasks[childTaskID]);
        });
        childTask.isVisible = !childTask.isComplete;
    }
    recurseChildren(task, indentLevel, tasksOut) {
        //skip if starting on the pseudo root
        if (indentLevel > -1) {
            //do a check on desc
            if (task.isVisible) {
                tasksOut.push(task);
            }
        }
        task.indent = indentLevel;
        var subProcessOrder = 0;
        //determine subtask ordering
        var self = this;
        var subOrder = _.map(task.childTasks, function (childTaskId) {
            return { "sort": self.tasks[childTaskId][self.activeSortField], "id": childTaskId };
        });
        subOrder = _.orderBy(subOrder, ["sort"], [this.activeSortDir]);
        _.each(subOrder, function (itemObj) {
            var itemNo = itemObj.id;
            var childTask = self.tasks[itemNo];
            childTask.sortOrder = subProcessOrder++;
            self.recurseChildren(childTask, indentLevel + 1, tasksOut);
        });
    }
    getPseudoRootNode() {
        //need to return a "task" that has the parent-less nodes as its children
        var newTask = new Task(this, false);
        _.each(this.tasks, function (task) {
            if (task.parentTask === null) {
                newTask.childTasks.push(task.ID);
            }
        });
        return newTask;
    }
    getNew() {
        var task = new Task(this);
        this.tasks[task.ID] = task;
        return task;
    }
    removeTask(ID) {
        //this will delete the task from the object
        //check if the task has a parent, if so remove from there
        var taskToDelete = this.tasks[ID];
        if (taskToDelete.parentTask !== null) {
            //assign children to current parent
            var parentTask = this.tasks[taskToDelete.parentTask];
            parentTask.childTasks = parentTask.childTasks.concat(taskToDelete.childTasks);
            //find the index of the current task and splice it out
            var index = parentTask.childTasks.indexOf(ID);
            parentTask.childTasks.splice(index, 1);
        }
        //update parent of children to current parent
        var obj = this;
        _.each(taskToDelete.childTasks, function (taskId) {
            obj.tasks[taskId].parentTask = taskToDelete.parentTask;
        });
        //check if task has children, if so, delete those children too (and their children)
        // -or- collapse the current node "up" a level into the current parent
        delete this.tasks[ID];
    }
    getListOfColumns() {
        //this will return a list of all possible columns that could be visualized
        //iterate through possible columns and return the name
        return _.map(this._possibleColumns, "name");
    }
    getJSONString() {
        //TODO use this method for the normal save() call too
        var output = _.map(this.tasks, function (d) {
            return d.getObjectForSaving();
        });
        var objectToSave = {
            title: this.title,
            googleDriveId: this.googleDriveId,
            tasks: output
        };
        return JSON.stringify(objectToSave);
    }
    isDefaultList() {
        console.log(this.tasks);
        if (this.tasks[2].description === "new project") {
            if (Object.keys(this.tasks).length === 2 && this.tasks[3] !== undefined && this.tasks[3].description === "new task") {
                return true;
            }
            if (Object.keys(this.tasks).length === 1) {
                return true;
            }
        }
        return false;
    }
    save(callback) {
        var jsonfile = require("jsonfile");
        var _ = require("lodash");
        if (this.path === "") {
            //TODO put this prompt into a actual message bar
            console.log("no path set, will not save");
            return false;
        }
        //create new object with only the date to keep        
        var output = _.map(this.tasks, function (d) {
            return d.getObjectForSaving();
        });
        var objectToSave = {
            title: this.title,
            googleDriveId: this.googleDriveId,
            tasks: output
        };
        jsonfile.writeFile(this.path, objectToSave, { spaces: 2 }, function (err) {
            if (err !== null) {
                console.error(err);
            }
            //TODO change this out for a status update proper
            console.log("saved... calling callback");
            if (callback !== undefined) {
                callback();
            }
        });
        return true;
    }
    static createNewTaskList() {
        //create the new task list
        var list = new TaskList();
        //create a root task
        var rootTask = list.getNew();
        rootTask.isProjectRoot = true;
        rootTask.description = "new project";
        //isolate to the root task
        list.idForIsolatedTask = rootTask.ID;
        return list;
    }
    static load(path, callback, fileId) {
        var jsonfile = require("jsonfile");
        //create new object with only the date to keep
        var _ = require("lodash");
        var taskList = new TaskList();
        taskList.path = path;
        jsonfile.readFile(taskList.path, function (err, obj) {
            var dataObj = {};
            //TODO: replace these strings with an actual object
            if (obj.length > 0) {
                //this is for the old format where the file was only tasks
                dataObj["tasks"] = obj;
            }
            else {
                //this loads an actual TaskList object
                dataObj = obj;
            }
            //obj contains title, googleDriveId, and tasks
            taskList.title = dataObj["title"];
            if (fileId === "") {
                //try to get the data from the file
                taskList.googleDriveId = dataObj["googleDriveId"];
            }
            else {
                //grab the fileId from Google
                taskList.googleDriveId = fileId;
            }
            _.each(dataObj["tasks"], function (item) {
                var task = Task.createFromData(item, taskList);
                taskList.tasks[task.ID] = task;
            });
            //work is done, call the callback
            callback(taskList);
        });
    }
}
//# sourceMappingURL=bundle.js.map