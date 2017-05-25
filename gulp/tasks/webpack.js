var gulp = require('gulp');
var gulpif = require('gulp-if');
var uglify = require('gulp-uglify');
var webpack = require('webpack-stream');
var WebpackDevServer = require('webpack-dev-server');
var config = require('../config');

gulp.task('webpack', ['webpack_ex1', 'webpack_ex2'])

gulp.task('webpack_ex1', function(cb) {
  const conf = config.ex1.webpack
  conf.resolve.extensions.push('') // *sigh
  const srcPath = conf.context + conf.entry
  gulp.src(srcPath)
      .pipe(webpack(conf))
      .pipe(gulpif(config.js.uglify, uglify()))
      .pipe(gulp.dest(config.js.dest));
});

gulp.task('webpack_ex2', function(cb) {
  const conf = config.ex2.webpack
  conf.resolve.extensions.push('') // *sigh
  const srcPath = conf.context + conf.entry
  gulp.src(srcPath)
      .pipe(webpack(conf))
      .pipe(gulpif(config.js.uglify, uglify()))
      .pipe(gulp.dest(config.js.dest));
});

