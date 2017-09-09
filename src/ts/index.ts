require["paths"] = ["./app/js"];

import * as path from "path";
import * as _ from "lodash";
import * as $ from "jquery";

//TODO ideally these hacks would not be required
window["$"] = $;
window["jQuery"] = $;

import "bootstrap-notify";

import { LocalStorageManager } from "./local-storage";
import { EditableGrid } from "./grid/EditableGrid";
import { Task } from "./Task";
import { TaskGrid } from "./grid-setup";
import { setupEvents } from "./app-events";
import { renderGrid } from "./grid-render";
import { TaskList } from "./TaskList";

var app = require("electron").remote;
var dialog = app.dialog;

//TODO clean this section up to hide these variables
//declare any local/global variables

export var localDrive: DriveStorage;

export let mainTaskList: TaskList;

export var grid: EditableGrid;

export class AppGlobal {
  static shouldAddTaskWhenDoneEditing = false;
}

function showAlert(message, type = "info") {
  console.log(message);

  $.notify(
    {
      message: message
    },
    {
      // settings
      type: type,
      placement: {
        from: "bottom"
      },
      delay: 1000
    }
  );
}

function showSavePrompt(yesNoCallback) {
  $("<div/>")
    .text("Do you want to save first?")
    .dialog({
      resizable: false,
      height: "auto",
      width: 400,
      modal: true,
      title: "Save before leaving?",
      buttons: {
        Yes: function() {
          $(this).dialog("close");
          saveTaskList(true);
          //need to do some saving

          yesNoCallback();
        },
        No: function() {
          $(this).dialog("close");

          //continue with whatever
          yesNoCallback();
        }
      }
    });
}

//check if the filename is already in the list
export function addFileToRecentFileList(fileName) {
  _.remove(LocalStorageManager.recentFiles, function(item) {
    return item === fileName;
  });
  LocalStorageManager.recentFiles.unshift(fileName);
  //if not, add to the top of the list

  localStorage.setItem(
    "recentFiles",
    JSON.stringify(LocalStorageManager.recentFiles)
  );
  updateRecentFileButton();
}

export function updateRecentFileButton() {
  if (LocalStorageManager.recentFiles.length > 0) {
    $("#recentFileGroup").empty();
  }

  _.each(LocalStorageManager.recentFiles, function(fileName) {
    var label = $("<li/>").appendTo("#recentFileGroup");
    var aDom = $("<a/>")
      .attr("href", "#")
      .text(fileName)
      .appendTo(label);

    //set up a click event on the LABEL... does not work for the input
    //TODO swap this for a delegated event
    $(label).on("click", function(ev) {
      loadTaskListWithPrompt(fileName, "");
    });
  });
}

export function resizeBasedOnNavbar() {
  //get the height of the navbar
  var navbar = $("#navbar");

  //update the padding on the main element
  var height = navbar.height() + 5;

  $("body").css("padding-top", height + "px");
}

export function loadTaskListWithPrompt(fileName, driveId) {
  if (mainTaskList.path === "" && !mainTaskList.isDefaultList()) {
    showSavePrompt(function() {
      TaskList.load(fileName, loadTaskListCallback, driveId);
    });
  } else {
    TaskList.load(fileName, loadTaskListCallback, driveId);
  }
}

function loadTaskListCallback(loadedTaskList) {
  mainTaskList = loadedTaskList;
  _.each(LocalStorageManager.visibleColumns, function(columnName) {
    mainTaskList.columns[columnName].active = true;
  });

  //get first project in file and isolate on it
  var projects = mainTaskList.getProjectsInList();
  console.log("loader proj", projects);
  mainTaskList.idForIsolatedTask = projects[0].ID;

  renderGrid();
}

//TODO move these Google Drive things elsewhere

export function listGoogleDriveFiles() {
  localDrive.listFiles(function(files) {
    //once the files are here, update the button
    updateDriveFileButton(files);
  });
}

export function saveFileInDrive() {
  localDrive.storeFile(
    mainTaskList.getJSONString(),
    mainTaskList.title,
    mainTaskList.googleDriveId,
    function(fileId) {
      console.log("saved/updated tasklist to Drive");
      showAlert("File stored on Google Drive");
      mainTaskList.googleDriveId = fileId;
    }
  );
}

export function authorizeGoogleDrive(callback) {
  localDrive = new DriveStorage();
  localDrive.startAuth(function() {
    showAlert(
      "Google Drive has been authorized.  Check Google Drive -> Load menu to see files."
    );
    callback();
  });
}

function updateDriveFileButton(fileList) {
  console.log("files inside func", fileList);

  var driveGroup = $("#driveFileGroup");

  if (fileList.length > 0) {
    driveGroup.empty();
  }

  _.each(fileList, function(driveFile: any) {
    var label = $("<li/>").appendTo(driveGroup);
    var aDom = $("<a/>")
      .attr("href", "#")
      .text(driveFile.name)
      .appendTo(label);

    //set up a click event on the LABEL... does not work for the input
    $(label).on("click", function(ev) {
      //TODO need to wire this up
      console.log("load the file from drive", driveFile.id);
      localDrive.downloadFile(driveFile, function(path) {
        console.log("downloaded file to ", path);
        loadTaskListWithPrompt(path, driveFile.id);
      });
    });
  });
}

export function sortNow() {
  var isSortEnabled = mainTaskList.isSortEnabled;

  mainTaskList.isSortEnabled = true;
  renderGrid();
  mainTaskList.isSortEnabled = isSortEnabled;

  showAlert("Tasklist sorted");

  saveTaskList();
}

export function saveTaskList(shouldPromptForFilename = false) {
  if (shouldPromptForFilename && mainTaskList.path === "") {
    dialog.showSaveDialog({}, function(fileName) {
      if (fileName === undefined) {
        //TODO put this in a real output box
        console.log("dialog was cancelled");
        return false;
      }

      mainTaskList.path = fileName;
      //TODO this is a duplicate piece of code
      mainTaskList.save(null);
      addFileToRecentFileList(fileName);
    });
  }

  var didSave = mainTaskList.save(null);
  if (didSave) {
    showAlert("tasklist was saved", "success");
  }
}

export function createNewTask(options = {}) {
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
    grid.editCell(
      grid.getRowIndex(newTask.ID),
      grid.getColumnIndex("description")
    );
  } else {
    //this will prevent the task from being added if it has no parent
    console.log("stranded task removed");
    //TODO add a warning that task was not created since it would have been stranded
    newTask.removeTask();
  }
}

export function createNewTasklist() {
  var newList = TaskList.createNewTaskList();
  loadTaskListCallback(newList);
  createNewTask();
}

function activateTooltipPlugin() {
  //this will allow Bootstrap to drive the tooltips
  console.log("init the tooltips");
  $("button").tooltip({
    trigger: "hover"
  });

  $(".dropdown-toggle").on("click", function() {
    //hide all tooltips
    $("button").tooltip("hide");
  });
}

//clear selection, render grid
export function clearSelection(shouldRender = true) {
  _.each(mainTaskList.tasks, function(task: any) {
    task.isSelected = false;
  });
  if (shouldRender) {
    renderGrid();
  }
}

function createColumnShowAndSort() {
  //set up the column chooser
  _.each(mainTaskList.getListOfColumns(), function(columnName) {
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
    var btnGroup = $("<div/>")
      .appendTo(li)
      .attr("class", "btn-group btn-group-flex");
    var anchor = $("<a/>")
      .appendTo(btnGroup)
      .attr("class", "btn btn-default sort-desc");

    //add the arrows
    var aArrowUp = $("<a/>")
      .appendTo(btnGroup)
      .attr("class", "btn btn-default sort-arrow")
      .data("dir", "asc");
    var span = $("<span/>")
      .appendTo(aArrowUp)
      .attr("class", "glyphicon glyphicon-arrow-up");

    var aArrowDown = $("<a/>")
      .appendTo(btnGroup)
      .attr("class", "btn btn-default sort-arrow")
      .data("dir", "desc");
    span = $("<span/>")
      .appendTo(aArrowDown)
      .attr("class", "glyphicon glyphicon-arrow-down");

    anchor.text(columnName);

    if (LocalStorageManager.visibleColumns.indexOf(columnName) > -1) {
      anchor.addClass("active");
      mainTaskList.columns[columnName].active = true;
    }

    //set up a click event on the LABEL... does not work for the input
    $(anchor).on("click", function(ev) {
      console.log("show/hide column click");

      //this seems to be opposite of the actual value
      var isActive = !$(this).hasClass("active");
      $(this).toggleClass("active");
      mainTaskList.columns[columnName].active = isActive;

      if (isActive) {
        LocalStorageManager.visibleColumns.push(columnName);
      } else {
        _.remove(LocalStorageManager.visibleColumns, function(item) {
          return item === columnName;
        });
      }

      //update the local storage
      localStorage.setItem(
        "visibleColumns",
        JSON.stringify(LocalStorageManager.visibleColumns)
      );

      renderGrid();
    });

    //TODO add a check for the ASC/DESC flag
    if (
      columnName === mainTaskList.sortField &&
      mainTaskList.sortDir === "desc"
    ) {
      aArrowDown.addClass("active");
    } else if (
      columnName === mainTaskList.sortField &&
      mainTaskList.sortDir === "asc"
    ) {
      aArrowUp.addClass("active");
    }

    //add just combines the jQuery objects, no underlying change
    aArrowUp.add(aArrowDown).on("click", function(ev) {
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

export function setupMainPageTasks() {
  //this is currently a dumping ground to get events created

  //create a blank task list to start
  mainTaskList = new TaskList();

  //set up the grid related events
  //TODO remove this hack
  grid = new TaskGrid().grid;

  console.log("grid", grid);

  LocalStorageManager.setupLocalStorage();
  createColumnShowAndSort();

  setupEvents();

  createNewTasklist();

  //size things correctly at end
  resizeBasedOnNavbar();

  activateTooltipPlugin();
}

$(document).ready(setupMainPageTasks);
