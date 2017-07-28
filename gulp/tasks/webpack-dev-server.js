var gulp = require('gulp');
var webpack = require('webpack');
var WebpackDevServer = require('webpack-dev-server');
var config = require('../config');
var exec = require('child_process').exec;

gulp.task('webpack-dev-server', function(cb) {
  //new WebpackDevServer(webpack(config.webpack), config.webpack.devServer)
  new WebpackDevServer(webpack(config.ex4.webpack), config.ex4.webpack.devServer)
    .listen(config.ex2.webpack.devServer.port, 'localhost', function(err) {
      if(err){
        console.error(err)
      }
    });
})
