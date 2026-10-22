var gulp = require('gulp');
var config = require('../config');

gulp.task('copy_ex1', function(cb) {
  return gulp.src(config.ex1.copy.src, config.ex1.copy.opts)
             .pipe(gulp.dest(config.ex1.copy.dest))
             .on('end', cb)
});

gulp.task('copy_ex2', function(cb) {
  return gulp.src(config.ex2.copy.src, config.ex2.copy.opts)
             .pipe(gulp.dest(config.ex2.copy.dest))
             .on('end', cb)
});

gulp.task('copy_ex3', function(cb) {
  return gulp.src(config.ex3.copy.src, config.ex3.copy.opts)
             .pipe(gulp.dest(config.ex3.copy.dest))
             .on('end', cb)
});

gulp.task('copy_ex4', function(cb) {
  return gulp.src(config.ex4.copy.src, config.ex4.copy.opts)
             .pipe(gulp.dest(config.ex4.copy.dest))
             .on('end', cb)
});

gulp.task('copy', gulp.parallel('copy_ex1', 'copy_ex2', 'copy_ex3', 'copy_ex4'))
