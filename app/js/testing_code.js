//these requires are needed in order to load objects on the Browser side of things
var Task = require("./js/Task.js");
var TaskList = require("./js/TaskList.js");

function entryPoint() {
    //this is equal to the onLoad event for the body
    setupMainPageTasks();

    mainTaskList = new TaskList();
    mainTaskList.render();
}

function setupMainPageTasks() {
    //this is currently a dumping ground to get events created

    $ = require("jquery");

    $("#loader").on("click", function () {
        //set the list object
        TaskList.load(function (loadedTaskList) {
            mainTaskList = loadedTaskList;
            mainTaskList.render();
        });
    })

    $("#saver").on("click", function () {
        //save the tasklist object
        mainTaskList.save(function () {
            console.log("saved");
        })
    })

    $("#taskDesc").on("keydown", function (e) {
        var txtBox = $(this);
        if (e.keyCode == 13) {

            //TODO create a new task and stick in list
            var desc = txtBox.val();
            var newTask = new Task();
            newTask.description = desc;

            mainTaskList.tasks.push(newTask);
            mainTaskList.render();

            //clear the box
            txtBox.val("");

            //kill the event
            return false;
        }
    });
}