//this all works but is somewhat unneeded with Node and require

var gulp = require('gulp');

gulp.task('default', ["concat"]);

var concat = require("gulp-concat");

gulp.task("concat", function () {
  gulp.src("src/js/*.js")
    .pipe(concat("combined_script.js"))
    .pipe(gulp.dest("app/js"))
})