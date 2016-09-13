module.exports = class TaskList {

    constructor() {
        this.tasks = [];
    }

    createDummyData() {
        for (var index = 0; index < 5; index++) {
            var task = new Task();
            task.description = index;
            this.tasks.push(task);
        }
    }

    getGridDataObject() {
        var gridDataObject = {
            "metadata": [
                { "name": "description", "label": "desc", "datatype": "string", "editable": true }
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

    save(callback) {
        var jsonfile = require("jsonfile");

        //create new object with only the date to keep
        var _ = require("lodash");
        var output = _.map(this.tasks, function (d) {
            return d.getObjectForSaving();
        })

        console.log(output);

        jsonfile.writeFile("./output.json", output, function (err) {
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