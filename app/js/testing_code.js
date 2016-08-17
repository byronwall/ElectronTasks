var Task = require("./app/js/Task.js");
var TaskList = require("./app/js/TaskList.js");

function entryPoint() {
    //this is equal to the onLoad event for the body
    setupMainPageTasks();

    var tasks = new TaskList();
    tasks.createDummyData();
    tasks.render();
}

function setupMainPageTasks() {
    //this is currently a dumping ground to get events created

    $ = require("jquery");

    $("#loader").on("click", function () {
        console.log("click triggered");
        console.log(TaskList);
        var newTaskList = TaskList.load();

        console.log(newTaskList);
    })

    $("#taskDesc").on("keydown", function (e) {
        var txtBox = this;
        if (e.keyCode == 13) {
            //TODO create a new task and stick in list

            //clear the box
            console.log("ENTER");
            $(txtBox).val("");

            //kill the event
            return false;
        }
    });
}