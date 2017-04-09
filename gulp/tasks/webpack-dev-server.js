var gulp = require('gulp');
var webpack = require('webpack');
var WebpackDevServer = require('webpack-dev-server');
var config = require('../config');
var exec = require('child_process').exec;

gulp.task('webpack-dev-server', function(cb) {
  new WebpackDevServer(webpack(config.webpack), config.webpack.devServer)
    .listen(config.webpack.devServer.port, 'localhost', function(err) {
      console.error(err)
    });
})
