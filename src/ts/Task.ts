import { TaskList } from "./TaskList";
import * as _ from "lodash";

export class Task {
  taskList: TaskList;
  description: string;
  duration: number;
  startDate: Date;
  endDate: Date;
  ID: number;
  dateAdded: Date;
  isComplete: boolean;
  priority: any;
  tags: string[];
  status: string;
  milestone: string;
  comments: string;
  isFirstEdit: boolean;
  isProjectRoot: boolean;
  parentTask: number;
  childTasks: number[];
  indent: number;
  isSelected: boolean;
  sortOrder: number;
  isVisible: boolean;

  static _id = 1;

  constructor(taskList, shouldGetId = true) {
    this.taskList = taskList;

    //TODO change this out to use a data object instead of fields
    this.description = "";
    this.duration = 0;
    this.startDate = null;
    this.endDate = null;

    this.ID = shouldGetId ? Task.getUnique : -1;

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
      var hasNoMatch = _.every(Object.keys(this), key => {
        let item = this[key];

        var isMatch = false;

        if (item === null) {
          return true;
        }

        if (typeof item === "string") {
          isMatch = item.toUpperCase().indexOf(searchTerm.toUpperCase()) !== -1;
        } else {
          isMatch = item === searchTerm;
        }

        return !isMatch;
      });

      return !hasNoMatch;
    } else {
      var task = this;

      var allMatch = _.every(_.keys(searchTerm), function(key) {
        //for each key need to check if that value is equal to value
        if (task[key] !== null && typeof task[key] === "object") {
          //this is an array
          if (searchTerm[key] === "<none>") {
            //do a test for the none case
            return task[key].length === 0;
          }

          return task[key].indexOf(searchTerm[key]) > -1;
        } else {
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
    _.map(data, function(value, index) {
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

  completeTask(isComplete = undefined) {
    //this will flip completion on the current task
    this.isComplete = isComplete === undefined ? !this.isComplete : isComplete;

    //check if there are any children, if so, complete those also
    var self = this;
    _.each(this.childTasks, function(childTaskIndex) {
      var childTask = self.taskList.tasks[childTaskIndex];
      childTask.completeTask(self.isComplete);
    });
  }

  removeTask() {
    //delete the children task
    var self = this;
    _.each(this.childTasks, function(childTaskIndex) {
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
    _.each(parts, function(part) {
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
    _.each(this.tags, function(tag) {
      partsToKeep.push("#" + tag);
    });

    if (this.status !== null) {
      partsToKeep.push("@" + this.status);
    }
    if (this.milestone !== null) {
      partsToKeep.push("!" + this.milestone);
    }
    //now add the remaining parts

    var newDesc = _.filter(partsToKeep, function(item) {
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
      duration: "sum"
    };

    var self = this;

    //values will hold an array of values for each field that is being tracked in transForms
    var values = {};
    _.each(this.childTasks, function(childTaskIndex) {
      var childTask = self.taskList.tasks[childTaskIndex];
      childTask.updateDependentProperties();

      //stick each set of values into an array
      _.each(transForms, function(value, key) {
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
    _.each(transForms, function(value, key) {
      //this is a very magic way to get the function
      //lodash has sum/min/max as functions
      //this pulls the correct function and applies it to the current transForms field
      self[key] = _[value](values[key]);
    });
  }

  getObjectForSaving() {
    //this will be used up above, ideally they match
    return {
      ID: this.ID,
      description: this.description,
      comments: this.comments,
      priority: this.priority,
      duration: this.duration,
      startDate: this.startDate,
      endDate: this.endDate,
      dateAdded: this.dateAdded,
      parentTask: this.parentTask,
      childTasks: this.childTasks,
      sortOrder: this.sortOrder,
      status: this.status,
      milestone: this.milestone,
      isComplete: this.isComplete,
      isProjectRoot: this.isProjectRoot,
      tags: this.tags
    };
  }
  setDataValue(field, value: string) {
    console.log("task set info", typeof this[field]);

    if (typeof this[field] === "object") {
      if (value === "") {
        this[field] = [];
      } else {
        //assume this is a CSV string and split
        var parts = value.split(",");
        parts = _.map(parts, function(part) {
          return part.trim();
        });

        console.log("will set obj", field, parts);
        this[field] = parts;
      }
    } else {
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
    var sorted = _.sortBy(parentTask.childTasks, function(a) {
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
    } else {
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
