class TaskList {

    constructor() {
        this.tasks = {};
        this.sortField = "priority";
        this.sortDir = "desc";
        this.isSortEnabled = false;

        this.searchTerm = "";
        this.searchObj = {};

        this.path = "";

        this.idForIsolatedTask = undefined;
        this.hideRootIfIsolated = true;

        this._possibleColumns = [
            { "name": "description", "label": "desc", "datatype": "hashtag", "editable": true, "active": false },
            { "name": "duration", "label": "duration (min)", "datatype": "double", "editable": true, "active": false },
            { "name": "priority", "label": "priority", "datatype": "integer", "editable": true, "active": false },
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
            "data": (function (obj) {
                //TODO, really need to pull this function call out

                //get a list of all tasks
                //iterate through them
                //if they have a child... process the child next... same for that child
                //if they have a parent... skip and let the parent find them first

                //all tasks with either be at the root or have a parent
                //if at the root, add to the root, and process the child tasks, just push them on
                //do a depth first seach and all will get added

                var tasksOut = []

                //these checks set the sort column if used
                var activeSortField = (obj.isSortEnabled) ? obj.sortField : "sortOrder";
                var activeSortDir = (obj.isSortEnabled) ? obj.sortDir : "asc";

                //process the searchTerm
                //split on spaces, split on colon, build object
                obj.searchObj = obj.searchTerm;
                var searchTextParts = obj.searchTerm.split(" ");

                _.each(searchTextParts, function (spaces) {
                    if (spaces.indexOf(":") > -1) {
                        var parts = spaces.split(":");

                        if (typeof obj.searchObj !== "object") {
                            obj.searchObj = {};
                        }
                        obj.searchObj[parts[0]] = parts[1];
                    }
                })

                //process children
                function recurseChildren(task, indentLevel) {
                    //skip if starting on the pseudo root
                    if (indentLevel > -1) {

                        //do a check on desc
                        if (obj.searchTerm == "" || task.isResultForSearch(obj.searchObj)) {
                            tasksOut.push(task);
                        }
                    }
                    task.indent = indentLevel;
                    var subProcessOrder = 0;

                    //determine subtask ordering
                    var subOrder = _.map(task.childTasks, function (childTaskId) {
                        return { "sort": obj.tasks[childTaskId][activeSortField], "id": childTaskId }
                    })

                    subOrder = _.orderBy(subOrder, ["sort"], [activeSortDir])

                    _.each(subOrder, function (itemObj) {
                        var itemNo = itemObj.id;
                        //TODO apply sort order to the children here
                        var childTask = obj.tasks[itemNo];
                        childTask.sortOrder = subProcessOrder++;
                        recurseChildren(childTask, indentLevel + 1)
                    });
                }

                if (obj.idForIsolatedTask == undefined) {
                    recurseChildren(obj.getPseudoRootNode(), -1)
                } else {
                    //do the recursion only on the selected task
                    var isolatedTask = obj.tasks[obj.idForIsolatedTask];
                    //this will start at -1 (ignored) or 0 depending on flag.
                    var startLevel = (obj.hideRootIfIsolated) ? -1 : 0;
                    recurseChildren(isolatedTask, startLevel);
                }

                return _.map(tasksOut, function (item) {
                    return { "id": item.ID, "values": item }
                })
            })(this)
        };

        return gridDataObject;
    };

    getPseudoRootNode() {
        //need to return a "task" that has the parentless nodes as its children

        var newTask = new Task();

        _.each(this.tasks, function (task) {
            if (task.parentTask == null) {
                newTask.childTasks.push(task.ID)
            }
        })

        return newTask;
    }

    getNew() {
        var task = new Task();
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

        jsonfile.writeFile(this.path, output, { spaces: 2 }, function (err) {
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

    static load(path, callback) {
        var jsonfile = require("jsonfile");

        //create new object with only the date to keep
        var _ = require("lodash");

        var taskList = new TaskList();
        taskList.path = path;

        jsonfile.readFile(taskList.path, function (err, obj) {
            _.each(obj, function (item) {
                var task = Task.createFromData(item);

                taskList.tasks[task.ID] = task;
            })

            //work is done, call the callback
            callback(taskList);
        })
    }
}

module.exports = TaskList;