function saveFile() {
    var fs = require('fs');

    //this works as expected!!
    fs.writeFile("./temp.txt", "aaaaa", function (err) {
        if (err) {
            alert("An error ocurred creating the file " + err.message)
        } else {
            alert("The file has been succesfully saved");
        }
    })
}

function entryPoint() {
    var Task = require("./app/js/Task.js");
    var TaskList = require("./app/js/TaskList.js");

    var tasks = new TaskList();
    tasks.createDummyData();
    tasks.render();
}