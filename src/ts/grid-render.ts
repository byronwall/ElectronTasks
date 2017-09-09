import { EditableGrid } from "./grid/EditableGrid";
import { TaskList } from "./TaskList";
import * as $ from "jquery";
import * as _ from "lodash";
import { Task } from "./Task";
import { grid, mainTaskList } from "./index";

export var renderGrid = function() {
  grid.load(mainTaskList.getGridDataObject());

  console.log(grid.data);

  grid.renderGrid("gridList", "testgrid");

  console.log("grid rendered");

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
  var breadcrumbBucket = $("#breadcrumbs");
  breadcrumbBucket.empty();

  //this will hide the breadcrumbs if isolation is just a project (or nothing)
  if (
    mainTaskList.idForIsolatedTask === null ||
    mainTaskList.tasks[mainTaskList.idForIsolatedTask].isProjectRoot
  ) {
    breadcrumbBucket.hide();
    return;
  } else {
    breadcrumbBucket.show();
  }

  //create the clear isolation button
  console.log(clearItem);
  breadcrumbBucket.append(clearItem);

  //add a new span for each one
  _.each(breadcrumbs, function(breadcrumb) {
    var label = $("<li/>").appendTo(breadcrumbBucket);
    var aDom = $("<a/>")
      .attr("href", "#")
      .text(breadcrumb.description)
      .appendTo(label);

    //set up a click event on the LABEL... does not work for the input
    //TODO swap this for a delegated event
    $(label).on("click", function(ev) {
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
  } else {
    projectBucket.show();
  }

  $(".gridMove").empty();

  //add the buttons to move the task
  _.each(projects, function(project) {
    var label = $("<li/>").attr("data-project", project.ID);
    var aDom = $("<a/>")
      .attr("href", "#")
      .text(project.description)
      .appendTo(label);

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
  _.each(projects, function(project) {
    var label = $("<li/>").appendTo(projectBucket);
    var aDom = $("<a/>")
      .attr("href", "#")
      .text(project.description)
      .appendTo(label);

    if (project.ID === mainTaskList.idForIsolatedTask) {
      label.addClass("active");
    }

    //set up a click event on the LABEL... does not work for the input
    //TODO swap this for a delegated event
    $(label).on("click", function(ev) {
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
  _.each(tags, function(tag) {
    var label = $("<li/>")
      .appendTo(tagBucket)
      .attr("class", "label-search")
      .attr("data-type", "tags");
    var aDom = $("<a/>")
      .attr("href", "#")
      .text(tag)
      .appendTo(label);
  });
}

function updateStatusBucket() {
  var tags = mainTaskList.getAllStatus().sort();
  tags.push("<none>");

  //clear out the tag bucket
  var tagBucket = $("#statusBucket");
  tagBucket.empty();

  //add a new span for each one
  _.each(tags, function(tag) {
    var label = $("<li/>")
      .appendTo(tagBucket)
      .attr("class", "label-search")
      .attr("data-type", "status");
    var aDom = $("<a/>")
      .attr("href", "#")
      .text(tag)
      .appendTo(label);
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
  _.each(tags, function(tag) {
    var label = $("<li/>")
      .appendTo(tagBucket)
      .attr("class", "label-search")
      .attr("data-type", "milestone");
    var aDom = $("<a/>")
      .attr("href", "#")
      .text(tag)
      .appendTo(label);
  });
}

function updateSelectionMenu() {
  //determine if anything is selected
  var selected = _.some(mainTaskList.tasks, function(item) {
    return item.isSelected;
  });

  if (selected) {
    $("#selectionMenu").show();
  } else {
    $("#selectionMenu").hide();
  }
}
