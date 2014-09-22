'use strict';


module.exports = function(grunt) {

  // Load grunt tasks automatically
  require('load-grunt-tasks')(grunt);

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

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
    }
  });

};
