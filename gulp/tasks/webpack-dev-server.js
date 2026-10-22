var gulp = require('gulp');
var webpack = require('webpack');
var WebpackDevServer = require('webpack-dev-server');
var config = require('../config');

gulp.task('webpack-dev-server', function() {
  var conf = config.ex4.webpack
  var server = new WebpackDevServer(conf.devServer, webpack(conf))
  return server.start()
})
