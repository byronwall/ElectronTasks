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
    static load() {
        var jsonfile = require("jsonfile");

        //create new object with only the date to keep
        var _ = require("lodash");
        

        jsonfile.readFile("./output.json", function (err,obj) {
            console.log(obj);

            //obj contains all of the data that is needed
            //TODO spin this up into a new TaskList object and generate the tasks correctly

            //iterate through tasks to create the main list
            //go through tasks in some order to generate links and such
        })

        return;

        var output = _.map(this.tasks, function (d) {
            return {
                "desc": d.description,
                "id": d.ID
            }
        })
    }
}