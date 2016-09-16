//create a Task object

module.exports = class Task {
    constructor() {
        //TODO change this out to use a data object instead of fields
        this.description = "";
        this.duration = 0;
        this.startDate = null;
        this.endDate = null;
        this.ID = Task.getUnique;

        //some new fields for testig
        this.priority = 5;
        this.importance = 5;

        //these will be INTs that store the ID
        this.parentTask = null;
        this.childTasks = [];
    }

    static createFromData(data) {
        //this will create a task from a given JSON object
        var task = new Task();

        var _ = require("lodash");
        _.map(data, function (value, index) {
            task[index] = value
        })

        if (data.ID > Task._id || !Task._id) {
            Task._id = data.ID + 1;
        }

        return task;
    }

    static get getUnique() {
        if (!Task._id) {
            Task._id = 0;
        }
        return Task._id++;
    }

    get indentLevel() {
        if (this.parentTask == null) {
            return 1;
        }
        else {
            return this.parentTask.indentLevel + 1;
        }
    }

    getObjectForSaving() {
        //this will be used up above, ideally they match
        return {
            "description": this.description,
            "ID": this.ID,
            "priority": this.priority,
            "importance": this.importance,
            "startDate": this.startDate,
            "endDate": this.endDate
        }
    }
}