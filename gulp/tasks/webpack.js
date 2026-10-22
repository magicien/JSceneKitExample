var gulp = require('gulp');
var gulpif = require('gulp-if');
var uglify = require('gulp-uglify');
var webpack = require('webpack-stream');
var WebpackDevServer = require('webpack-dev-server');
var config = require('../config');

gulp.task('webpack_ex1', function(cb) {
  const conf = config.ex1.webpack
  const srcPath = conf.context + conf.entry
  gulp.src(srcPath)
      .pipe(webpack(conf))
      .pipe(gulpif(config.js.uglify, uglify()))
      .pipe(gulp.dest(config.js.dest))
      .on('end', cb)
});

gulp.task('webpack_ex2', function(cb) {
  const conf = config.ex2.webpack
  const srcPath = conf.context + conf.entry
  gulp.src(srcPath)
      .pipe(webpack(conf))
      .pipe(gulpif(config.js.uglify, uglify()))
      .pipe(gulp.dest(config.js.dest))
      .on('end', cb)
});

gulp.task('webpack_ex3', function(cb) {
  const conf = config.ex3.webpack
  const srcPath = conf.context + conf.entry
  gulp.src(srcPath)
      .pipe(webpack(conf))
      .pipe(gulpif(config.js.uglify, uglify()))
      .pipe(gulp.dest(config.js.dest))
      .on('end', cb)
});

gulp.task('webpack_ex4', function(cb) {
  const conf = config.ex4.webpack
  const srcPath = conf.context + conf.entry
  gulp.src(srcPath)
      .pipe(webpack(conf))
      .pipe(gulpif(config.js.uglify, uglify()))
      .pipe(gulp.dest(config.js.dest))
      .on('end', cb)
});

gulp.task('webpack', gulp.parallel('webpack_ex1', 'webpack_ex2', 'webpack_ex3', 'webpack_ex4'));
