class TaskList {

    constructor() {
        this.tasks = {};
        this.sortField = "priority";
        this.sortDir = "desc";
        this.isSortEnabled = false;

        this.searchTerm = "";
        this.searchObj = {};

        this.path = "";
        this.googleDriveId = undefined;

        this.title = "TaskList";

        this.idForIsolatedTask = undefined;
        this.hideRootIfIsolated = false;

        this.shouldHideComplete = true;

        this._possibleColumns = [
            { "name": "action", "label": "", "datatype": "action", "editable": false, "active": true },
            { "name": "description", "label": "desc", "datatype": "hashtag", "editable": true, "active": false },
            { "name": "duration", "label": "duration (min)", "datatype": "double", "editable": true, "active": false },
            { "name": "priority", "label": "priority", "datatype": "integer", "editable": true, "active": false },
            { "name": "status", "label": "status", "datatype": "string", "editable": true, "active": false },
            { "name": "dateAdded", "label": "added", "datatype": "date", "editable": true, "active": false },
            { "name": "startDate", "label": "start", "datatype": "date", "editable": true, "active": false },
            { "name": "endDate", "label": "end", "datatype": "date", "editable": true, "active": false }
        ]

        this.columns = _.keyBy(this._possibleColumns, "name");
    }

    getAllTags() {
        var tags = [];
        _.each(this.tasks, function (item) {
            _.each(item.tags, function (tag) {
                if (tags.indexOf(tag) == -1) {
                    tags.push(tag);
                }
            })
        })

        return tags;
    }

    getAllStatus() {
        var status = [];
        _.each(this.tasks, function (task) {
            if (status.indexOf(task.status) == -1) {
                status.push(task.status);
            }
        })

        return status;
    }

    assignStrandedTasksToCurrentIsolationLevel() {
        var self = this;
        _.each(this.tasks, function (task) {
            if (task.parentTask == null && !task.isProjectRoot) {
                task.parentTask = self.idForIsolatedTask;
                self.tasks[self.idForIsolatedTask].childTasks.push(task.ID);
            }
        })
    }

    getProjectsInList() {
        var projects = [];
        _.each(this.tasks, function (task) {
            if (task.isProjectRoot) {
                projects.push(task);
            }
        })

        return projects;
    }

    getGridDataObject() {
        var gridDataObject = {
            "metadata": _.filter(this.columns, "active"),
            "data": this._processGridData()
        };

        return gridDataObject;
    };

    _processGridData() {
        //get a list of all tasks
        //iterate through them
        //if they have a child... process the child next... same for that child
        //if they have a parent... skip and let the parent find them first

        //all tasks with either be at the root or have a parent
        //if at the root, add to the root, and process the child tasks, just push them on
        //do a depth first seach and all will get added

        var tasksOut = []

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
        })

        //run through children to update any dependent properties
        this.getPseudoRootNode().updateDependentProperties();

        //process children
        if (this.idForIsolatedTask == undefined) {
            this.recurseChildren(this.getPseudoRootNode(), -1, tasksOut)
        } else {
            //do the recursion only on the selected task
            var isolatedTask = this.tasks[this.idForIsolatedTask];
            //this will start at -1 (ignored) or 0 depending on flag.
            var startLevel = (this.hideRootIfIsolated) ? -1 : 0;
            this.recurseChildren(isolatedTask, startLevel, tasksOut);
        }

        return _.map(tasksOut, function (item) {
            return { "id": item.ID, "values": item }
        })
    }

    recurseChildren(task, indentLevel, tasksOut) {
        //skip if starting on the pseudo root
        if (indentLevel > -1) {
            //do a check on desc
            var searchResult = this.searchTerm == "" || task.isResultForSearch(this.searchObj)
            var showBecauseComplete = (this.shouldHideComplete) ? !task.isComplete : true;
            if (searchResult && showBecauseComplete) {
                tasksOut.push(task);
            }
        }
        task.indent = indentLevel;
        var subProcessOrder = 0;

        //determine subtask ordering
        var self = this;
        var subOrder = _.map(task.childTasks, function (childTaskId) {
            return { "sort": self.tasks[childTaskId][self.activeSortField], "id": childTaskId }
        })

        subOrder = _.orderBy(subOrder, ["sort"], [this.activeSortDir])

        _.each(subOrder, function (itemObj) {
            var itemNo = itemObj.id;
            //TODO apply sort order to the children here
            var childTask = self.tasks[itemNo];
            childTask.sortOrder = subProcessOrder++;
            self.recurseChildren(childTask, indentLevel + 1, tasksOut)
        });
    }

    getPseudoRootNode() {
        //need to return a "task" that has the parentless nodes as its children

        var newTask = new Task(this);

        _.each(this.tasks, function (task) {
            if (task.parentTask == null) {
                newTask.childTasks.push(task.ID)
            }
        })

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

        if (taskToDelete.parentTask != null) {
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
        })

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
        })

        var objectToSave = {
            title: this.title,
            googleDriveId: this.googleDriveId,
            tasks: output
        };

        return JSON.stringify(objectToSave);
    }

    save(callback) {
        var jsonfile = require("jsonfile");
        var _ = require("lodash");

        if (this.path == "") {
            //TODO put this prompt into a actual message bar
            console.log("no path set, will not save");
            return false;
        }

        //create new object with only the date to keep        
        var output = _.map(this.tasks, function (d) {
            return d.getObjectForSaving();
        })

        var objectToSave = {
            title: this.title,
            googleDriveId: this.googleDriveId,
            tasks: output
        };

        jsonfile.writeFile(this.path, objectToSave, { spaces: 2 }, function (err) {
            if (err != null) {
                console.error(err);
            }

            //TODO change this out for a status update proper
            console.log("saved... calling callback");
            if (callback !== undefined) {
                callback();
            }
        })
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

            console.log(typeof obj);
            console.log(obj);

            var dataObj = {};

            if (obj.length > 0) {
                console.log("old format")
                dataObj.tasks = obj;
            } else {
                console.log("new format")
                dataObj = obj;
            }

            //obj contains title, googleDriveId, and tasks
            taskList.title = dataObj.title;
            if (fileId == undefined) {
                //try to get the data from the file
                taskList.googleDriveId = dataObj.googleDriveId;
            } else {
                //grab the fileId from Google
                taskList.googleDriveId = fileId;
            }

            _.each(dataObj.tasks, function (item) {
                var task = Task.createFromData(item, taskList);

                taskList.tasks[task.ID] = task;
            })



            //work is done, call the callback
            callback(taskList);
        })
    }
}

module.exports = TaskList;