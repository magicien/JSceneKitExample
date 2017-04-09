var gulp = require('gulp');
var gulpif = require('gulp-if');
var uglify = require('gulp-uglify');
var webpack = require('webpack-stream');
var WebpackDevServer = require('webpack-dev-server');
var config = require('../config');


gulp.task('webpack', function(cb) {
  config.webpack.resolve.extensions.push('') // *sigh
  const srcPath = config.webpack.context + config.webpack.entry.javascript
  gulp.src(srcPath)
      .pipe(webpack(config.webpack))
      .pipe(gulpif(config.js.uglify, uglify()))
      .pipe(gulp.dest(config.js.dest));
});

