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

    static createFromData(data){

    }

    toJSON() {
        return "{}";
    };
}

