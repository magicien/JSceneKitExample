var gulp = require('gulp');
var config = require('../config');

gulp.task('copy', ['copy_ex1', 'copy_ex2', 'copy_ex3'])

gulp.task('copy_ex1', function() {
  return gulp.src(config.ex1.copy.src, config.ex1.copy.opts)
             .pipe(gulp.dest(config.ex1.copy.dest))
});

gulp.task('copy_ex2', function() {
  return gulp.src(config.ex2.copy.src, config.ex2.copy.opts)
             .pipe(gulp.dest(config.ex2.copy.dest))
});

gulp.task('copy_ex3', function() {
  return gulp.src(config.ex3.copy.src, config.ex3.copy.opts)
             .pipe(gulp.dest(config.ex3.copy.dest))
});

