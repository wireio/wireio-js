/*global module:false*/
module.exports = function(grunt) {

  // Helper methods
  function sub (str) {
    return str.replace(/%s/g, LIBRARY_NAME);
  }

  function wrapModules (head, tail) {
    return head.concat(MODULE_LIST).concat(tail);
  }

  var LIBRARY_NAME = 'wireio';

  var MODULE_LIST = [
    ];

  var DIST_HEAD_LIST = [
			sub('src/libs/jquery.js'),
			sub('src/%s.meta.js'),
      sub('src/%s.core.js')
    ];

  // This is the same as DIST_HEAD_LIST, just without *.const.js (which is just
  // there UglifyJS conditional compilation).
  var DEV_HEAD_LIST = [
			sub('src/libs/jquery.js'),
			sub('src/%s.meta.js'),
		  sub('src/%s.core.js')
    ];

  var TAIL_LIST = [
    ];

  // Gets inserted at the top of the generated files in dist/.
  var BANNER = [
      '/*! <%= pkg.name %> - v<%= pkg.version %> - ',
      '<%= grunt.template.today("yyyy-mm-dd") %> - <%= pkg.author %> */\n'
    ].join('');

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-qunit');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concat: {
      dist: {
        options: {
          banner: BANNER
        },
        src: wrapModules(DIST_HEAD_LIST, TAIL_LIST),
        dest: sub('dist/%s.js')
      },
      dev: {
        options: {
          banner: BANNER
        },
        src: wrapModules(DEV_HEAD_LIST, TAIL_LIST),
        dest: sub('dist/%s.dev.js')
      }
    },
    uglify: {
      dist: {
        files: (function () {
            // Using an IIFE so that the destination property name can be
            // created dynamically with sub().
            var obj = {};
            obj[sub('dist/%s.min.js')] = [sub('dist/%s.js')];
            return obj;
          } ())
      },
      options: {
        banner: BANNER
      }
    }
  });

  grunt.registerTask('default', [
      'jshint',
      'build',
      'qunit'
    ]);
  grunt.registerTask('build', [
      'concat:dist',
      'uglify:dist',
      'concat:dev'
    ]);
};
