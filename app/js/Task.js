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

        //these will be INTs that store the ID
        this.parentTask = null;
        this.childTasks = [];

        this.indent = 0;
        this.sortOrder = Number.MAX_SAFE_INTEGER;
    }

    isResultForSearch(searchTerm) {
        //check each part of the task to see if it appears

        //return true if any
        var hasNoMatch = _.every(this, function (item) {

            var isMatch = false;

            if (item == null) {
                return true;
            }

            if (typeof item.indexOf === "function") {
                isMatch = item.indexOf(searchTerm) != -1;
            } else {
                isMatch = (item == searchTerm);
            }

            return !isMatch;
        })

        return !hasNoMatch;
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

    getObjectForSaving() {
        //this will be used up above, ideally they match
        return {
            "description": this.description,
            "ID": this.ID,
            "priority": this.priority,
            "duration": this.duration,
            "startDate": this.startDate,
            "endDate": this.endDate,
            "parentTask": this.parentTask,
            "childTasks": this.childTasks,
            "sortOrder": this.sortOrder
        }
    }
}