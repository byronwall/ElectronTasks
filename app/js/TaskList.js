module.exports = class TaskList {

    constructor() {
        this.tasks = {};
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
                var tasksToProcess = []

                //get a list of ids and the order to process them
                var ordering = _.map(obj.tasks, function(item){
                    return {"sort" : item.sortOrder, "ID" : item.ID}
                })

                ordering = _.sortBy(ordering, ["sort"])

                //obj is the current TaskList
                //this function is used to output tasks in the correct default order
                //the grid does not understand parent-child and will render whatever it is given

                var processOrder = 0;

                _.each(ordering, function(orderItem){
                  var item = obj.tasks[orderItem.ID];

                
                    if (item.parentTask == null) {
                        var indent = 0
                        //process children
                        function recurseChildren(task, indentLevel) {
                            tasksOut.push(task);
                            task.indent = indentLevel;
                            _.each(task.childTasks, function (itemNo) { recurseChildren(obj.tasks[itemNo], indentLevel + 1) });
                        }

                        recurseChildren(item, 0)
                        item.sortOrder = processOrder++;
                    }
                });

                return _.map(tasksOut, function (item) {
                    return { "id": item.ID, "values": item }
                })
            })(this)
        };

        return gridDataObject;
    }

    getNew() {
        var task = new Task();
        this.tasks[task.ID] = task;

        return task;
    }

    removeTask(ID) {
        //this will delete the task from the object
        delete this.tasks[ID];
    }

    save(callback) {
        var jsonfile = require("jsonfile");
        var _ = require("lodash");

        //create new object with only the date to keep        
        var output = _.map(this.tasks, function (d) {
            return d.getObjectForSaving();
        })

        console.log(output);

        jsonfile.writeFile("./output.json", output, { spaces: 2 }, function (err) {
            if (err != null) {
                console.error(err);
            }

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