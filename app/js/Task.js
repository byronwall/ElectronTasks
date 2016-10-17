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

        this.tags = [];

        this.isProjectRoot = false;

        //these will be INTs that store the ID
        this.parentTask = null;
        this.childTasks = [];

        this.indent = 0;
        this.sortOrder = Number.MAX_SAFE_INTEGER;
    }

    isResultForSearch(searchTerm) {
        //check each part of the task to see if it appears

        //do a check if the searchTerm is a string (wildcard) or object
        if (typeof searchTerm === "string") {

            //return true if any
            //TODO swap this for a "some" to avoid the negations
            var hasNoMatch = _.every(this, function (item) {

                var isMatch = false;

                if (item == null) {
                    return true;
                }

                if (typeof item === "string") {
                    isMatch = item.toUpperCase().indexOf(searchTerm.toUpperCase()) != -1;
                } else {
                    isMatch = (item == searchTerm);
                }

                return !isMatch;
            })

            return !hasNoMatch;
        }
        else {
            console.log("search is an object");

            var task = this;

            var allMatch = _.every(_.keys(searchTerm), function (key) {
                //for each key need to check if that value is equal to value
                console.log(task);

                if (typeof task[key] === "object") {
                    //this is an array
                    return task[key].indexOf(searchTerm[key]) > -1;
                } else {
                    //this is a bare field
                    return task[key] == searchTerm[key];
                }
            });

            return allMatch;
        }
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
            "sortOrder": this.sortOrder,
            "isProjectRoot": this.isProjectRoot,
            "tags": this.tags
        }
    }
}