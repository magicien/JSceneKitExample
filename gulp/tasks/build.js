var gulp = require('gulp');
var gulpif = require('gulp-if');
var uglify = require('gulp-uglify');
var config = require('../config');
require('./webpack')
require('./copy')

gulp.task('build', gulp.series('webpack', 'copy'));

