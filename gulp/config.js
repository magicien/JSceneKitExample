const path = require('path');
const babel = require('babel-core/register');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

const src = path.resolve(__dirname, '../src');
const dest = path.resolve(__dirname, '../public');

module.exports = {
  dest: dest,

  js: {
    src: src + '/js/**',
    dest: dest,
    uglify: false
  },

  eslint: {
    src: [
      src + '/**',
      './test/**/*.js',
    ],
    opts: {
      useEslintrc: true
    }
  },

  copy: {
    src: [
      src + '/index.html',
      src + '/art.scnassets/**'
    ],
    dest: dest,
    opts: {
      base: src
    }
  },

  webpack: {
    context: src,
    entry: './js/main.js',
    output: {
      path: dest,
      filename: 'index.js',
      library: 'JSceneKitExample',
      libraryTarget: 'var'
    },
    devServer: {
      contentBase: dest,
      port: 8080
    },
    resolve: {
      extensions: ['.js']
    },
    plugins: [
      //new UglifyJSPlugin()
    ],
    module: {
      loaders: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          loader: 'babel-loader',
          query: {
            presets: ['es2015']
          }
        }
      ]
    },
    node: {
      Buffer: false
    },
    externals: {
      //fs: 'fs'
    }
  },

  mocha: {
    src: ['test/**/*.js', 'src/**/*.js'],
    compilers: {
      js: babel
    },
    opts: {
      ui: 'bdd',
      reporter: 'spec', // or nyan
      globals: [],
      require: ['test/helper/testHelper', 'chai']
    }
  },

  watch: {
    js: __dirname + '/../' + src + '/js/**'
  }
}

