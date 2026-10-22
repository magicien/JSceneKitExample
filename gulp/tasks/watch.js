var gulp = require('gulp');
var config = require('../config').watch;
require('./webpack')

gulp.task('watch', function() {
  return gulp.watch(config.js, gulp.series('webpack'));
});
