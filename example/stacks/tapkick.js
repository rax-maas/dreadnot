var exec = require('child_process').exec;

var async = require('async');

var BuildBot = require('util/buildbot').BuildBot;
var knife = require('util/knife');
var misc = require('util/misc');
var sprintf = require('util/sprintf');
var git = require('util/git');


exports.get_deployedRevision = function(args, callback) {
  git.revParse(this.config.tapkick_dir, 'HEAD', function(err, stdout) {
    if (err) { return callback(err); }
    // trim leading and trailing whitespace
    var rev;
    try {
      rev =  stdout.replace(/^\s+|\s+$/g, '');
    }
    catch (error) {
      return callback(error);
    }
    callback(null, rev);
  });
};


exports.task_deploy = function(stack, baton, args, callback) {
  var opts = {cwd: stack.config.tapkick_dir, env: process.env};

  async.series([
    function fetch(callback) {
      misc.taskSpawn(baton, args, ['git', 'fetch'], opts, callback);
    },

    function checkout(callback) {
      misc.taskSpawn(baton, args, ['git', 'checkout', args.revision], opts, callback);
    }
  ], callback);
};


exports.task_cleanup = function(stack, baton, args, callback) {
  baton.log.info('This gets logged whether the deploy succeeds or fails');
  callback();
};


exports.targets = {
  'deploy': [
    'task_deploy'
  ],

  'finally': [
    'task_cleanup'
  ]
};
