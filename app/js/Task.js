//create a Task object
module.exports = class Task {
    constructor() {
        //TODO change this out to use a data object instead of fields
        this.description = "";
        this.duration = 0;
        this.startDate = null;
        this.endDate = null;
        this.ID = 0;

        this.parentTask = null;
        this.childrenTasks = [];
    }


    static createFromData(data) {
        //this will create a task from a given JSON object
        var task = new Task();

        task.description = data.description;
        task.ID = data.ID;

        return task;
    }

    getObjectForSaving() {
        //this will be used up above, ideally they match
        return {
            "description": this.description,
            "ID": this.ID
        }
    }
}

