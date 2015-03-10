'use strict';


module.exports = function (grunt) {

  // Load grunt tasks automatically
  require('load-grunt-tasks')(grunt);

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    // Compiles CoffeeScript to JavaScript
    coffee: {
      options: {
        sourceMap: true,
        sourceRoot: 'src/'
      },
      dist: {
        files: [
          {
            expand: true,
            cwd: 'src',
            src: 'angular-indexed-db.coffee',
            dest: '.',
            ext: '.js'
          }
        ]
      },
      test: {
        files: [
          {
            expand: true,
            cwd: 'test/spec',
            src: '{,*/}*.coffee',
            dest: '.tmp/spec',
            ext: '.js'
          }
        ]
      }
    },

    karma: {
      options: {
        configFile: 'karma.conf.js'
      },
      unit: {
        singleRun: true
      },
      dev: {
        singleRun: false,
        reporters: 'dots'
      }
    },

    uglify: {
      options: {
        sourceMap: true,
        sourceMapName: 'angular-indexed-db.min.js.map',
        sourceMapIncludeSources: true,
        mangle: false
      },
      dist: {
        files: {
          'angular-indexed-db.min.js': [
            'angular-indexed-db.js'
          ]
        }
      }
    }
  });

  grunt.registerTask('test', [
    'karma:unit'
  ]);

  grunt.registerTask('build', [
    'test',
    'coffee:dist',
    'uglify'
  ]);

};
