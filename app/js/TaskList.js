module.exports = class TaskList {

    constructor() {
        this.tasks = {};
        this.sortField = "priority";
        this.sortDir = "desc";
    }

    getGridDataObject() {
        var gridDataObject = {
            "metadata": [
                { "name": "description", "label": "desc", "datatype": "string", "editable": true },
                { "name": "priority", "label": "priority", "datatype": "integer", "editable": true },
                { "name": "importance", "label": "importance", "datatype": "integer", "editable": true },
                { "name": "startDate", "label": "start", "datatype": "date", "editable": true },
                { "name": "endDate", "label": "end", "datatype": "date", "editable": true }
            ],
            "data": (function (obj) {

                //get a list of all tasks
                //iterate through them
                //if they have a child... process the child next... same for that child
                //if they have a parent... skip and let the parent find them first

                //all tasks with either be at the root or have a parent
                //if at the root, add to the root, and process the child tasks, just push them on
                //do a depth first seach and all will get added

                var tasksOut = []

                //process children
                function recurseChildren(task, indentLevel) {
                    //skip if starting on the pseudo root
                    if (indentLevel > -1) {
                        tasksOut.push(task);
                    }
                    task.indent = indentLevel;
                    var subProcessOrder = 0;

                    //determine subtask ordering
                    var subOrder = _.map(task.childTasks, function (childTaskId) {
                        return { "sort": obj.tasks[childTaskId][obj.sortField], "id": childTaskId }
                    })

                    subOrder = _.orderBy(subOrder, ["sort"], [obj.sortDir])

                    _.each(subOrder, function (itemObj) {
                        var itemNo = itemObj.id;
                        //TODO apply sort order to the children here
                        var childTask = obj.tasks[itemNo];
                        childTask.sortOrder = subProcessOrder++;
                        recurseChildren(childTask, indentLevel + 1)
                    });
                }

                recurseChildren(obj.getPseudoRootNode(), -1)

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

        if(taskToDelete.parentTask != null){
            //assign children to current parent
            var parentTask = this.tasks[taskToDelete.parentTask];

            parentTask.childTasks = parentTask.childTasks.concat(taskToDelete.childTasks);

            //find the index of the current task and splice it out
            console.log("childTasks before", parentTask.childTasks)
            console.log("id to remove", ID);
            var index = parentTask.childTasks.indexOf(ID);
            console.log("index", index)
            parentTask.childTasks.splice(index, 1);
            console.log("childTasks after", parentTask.childTasks)
        }

        //update parent of children to current parent
        var obj = this;
        _.each(taskToDelete.childTasks, function(taskId){
            obj.tasks[taskId].parentTask = taskToDelete.parentTask;
        })

        //check if task has children, if so, delete those children too (and their children)
        // -or- collapse the current node "up" a level into the current parent


        delete this.tasks[ID];
    }

    save(callback) {
        var jsonfile = require("jsonfile");
        var _ = require("lodash");

        //create new object with only the date to keep        
        var output = _.map(this.tasks, function (d) {
            return d.getObjectForSaving();
        })

        jsonfile.writeFile("./output.json", output, { spaces: 2 }, function (err) {
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

    static load(callback) {
        var jsonfile = require("jsonfile");

        //create new object with only the date to keep
        var _ = require("lodash");

        var taskList = new TaskList();

        jsonfile.readFile("./output.json", function (err, obj) {
            console.log(obj);

            _.each(obj, function (item) {
                var task = Task.createFromData(item);

                taskList.tasks[task.ID] = task;
            })

            //obj contains all of the data that is needed
            //TODO spin this up into a new TaskList object and generate the tasks correctly

            //iterate through tasks to create the main list
            //go through tasks in some order to generate links and such

            //work is done, call the callback
            callback(taskList);
        })
    }
}