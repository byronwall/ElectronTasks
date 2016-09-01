//these requires are needed in order to load objects on the Browser side of things
var Task = require("./js/Task.js");
var TaskList = require("./js/TaskList.js");
var _ = require("lodash")

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
            
            //get the tasks from the main list and render here
            var gridDataObject = {
                "metadata": [
                    { "name": "description", "label": "desc", "datatype": "string", "editable": true }
                ],
                "data":  _.map(mainTaskList.tasks, function(item){
                    return {"id":item.ID, "values":item}
                })
            };
            console.log(gridDataObject);

            grid = new EditableGrid("task-list");
            grid.load(gridDataObject);
            grid.renderGrid("gridList", "testgrid");

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