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

        //iterates through the TaskList and creates a new DIV for each Task
        var parent = this;
        var body = d3.select('body')
            .selectAll('div')
            .data(data).enter()
            .append('div')
            .text(function (d) { return d.description })
            .on("click", function () {
                parent.save();
            })
    }
    save() {
        var jsonfile = require("jsonfile");

        //create new object with only the date to keep
        var _ = require("lodash");
        var output = _.map(this.tasks, function (d) {
            return {
                "desc": d.description,
                "id": d.ID
            }
        })

        console.log(output);

        jsonfile.writeFile("./output.json", output, function (err) {
            console.error(err);
        })

    }
    load() {
        console.log("develop this");
    }
}