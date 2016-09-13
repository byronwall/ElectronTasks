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
            "data": _.map(this.tasks, function (item) {
                return { "id": item.ID, "values": item }
            })
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