var Task = require("./Task.js")

module.exports = class TaskList {

    constructor() {
        this.tasks = [];
    }


    createDummyData() {
        for (var index = 0; index < 5; index++) {
            var task = new Task();
            task.description = index;
            this.tasks.push(task)
        }
    }

    render() {
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
    save() {
        var jsonfile = require("jsonfile");
        
    }
    load() {
        console.log("develop this");
    }
}