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
      src + '/**/*.js',
      './test/**/*.js',
    ],
    opts: {
      useEslintrc: true
    }
  },

  ex1: {
    copy: {
      src: [
        src + '/ex1/index.html',
        src + '/ex1/art.scnassets/**'
      ],
      dest: dest,
      opts: {
        base: src
      }
    },

    webpack: {
      context: src,
      entry: './ex1/js/main.js',
      output: {
        path: dest,
        filename: 'ex1/index.js',
        library: 'JSceneKitExample',
        libraryTarget: 'var'
      },
      devServer: {
        contentBase: dest,
        port: 8080,
        staticOptions: {
          setHeaders: (res, path, stat) => {
            if(/\.exr$/.test(path)){
              res.setHeader('Content-Type', 'image/x-exr')
            }
          }
        }
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
              presets: ['env']
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
  },

  ex2: {
    copy: {
      src: [
        src + '/ex2/index.html',
        src + '/ex2/game.scnassets/**',
        src + '/ex2/Overlays/**',
        src + '/ex2/ParticleSystems/**',
      ],
      dest: dest,
      opts: {
        base: src
      }
    },

    webpack: {
      context: src,
      entry: './ex2/js/main.js',
      output: {
        path: dest,
        filename: 'ex2/index.js',
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
              presets: ['env']
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
  },

  ex3: {
    copy: {
      src: [
        src + '/ex3/index.html',
        src + '/ex3/badger.scnassets/**',
        src + '/ex3/overlays/**',
      ],
      dest: dest,
      opts: {
        base: src
      }
    },

    webpack: {
      context: src,
      entry: './ex3/js/main.js',
      output: {
        path: dest,
        filename: 'ex3/index.js',
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
              presets: ['env']
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
  },

  ex4: {
    copy: {
      src: [
        src + '/ex4/index.html',
        src + '/ex4/Art.scnassets/**',
        src + '/ex4/audio/**',
        src + '/ex4/Overlays/**'
      ],
      dest: dest,
      opts: {
        base: src
      }
    },

    webpack: {
      context: src,
      entry: './ex4/js/main.js',
      output: {
        path: dest,
        filename: 'ex4/index.js',
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
              presets: ['env']
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

