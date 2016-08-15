var Task = require("./Task.js")

module.exports = function TaskList() {

    this.tasks = [];

    this.createDummyData = function () {
        for (var index = 0; index < 5; index++) {
            var task = new Task();
            task.description = index;
            this.tasks.push(task)
        }
    }

    this.render = function () {
        //dom should be a valid object to render to
        var d3 = require("d3");
        var data = this.tasks;

        console.log(data);

        //iterates through the TaskList and creates a new DIV for each Task
        var body = d3.select('body')
            .selectAll('div')
            .data(data).enter()
            .append('div')
            .text(function (d) { return d.description })
    }
}