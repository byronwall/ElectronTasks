//create a Task object
module.exports = function Task() {
    this.description = "";
    this.duration = 0;
    this.startDate = null;
    this.endDate = null;
    this.ID = 0;

    this.parentTask = null;
    this.childrenTasks = [];

    this.toJSON = function () {
        return "{}";
    }
}

