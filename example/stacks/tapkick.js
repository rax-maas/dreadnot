var exec = require('child_process').exec;

var async = require('async');

var BuildBot = require('util/buildbot').BuildBot;
var knife = require('util/knife');
var misc = require('util/misc');
var sprintf = require('util/sprintf');
var git = require('util/git');


exports.get_deployedRevision = function(args, callback) {
  git.revParse(this.config.tapkick_dir, 'HEAD', function(err, stdout) {
    callback(null, stdout);
  });
};


exports.task_deploy = function(stack, baton, args, callback) {
  var cmd = ['git', 'pull', 'origin', 'master'],
      opts = {cwd: stack.config.tapkick_dir, env: process.env};

  misc.taskSpawn(baton, args, cmd, opts, function(err, stdout) {
    if (!err) {
      baton.log.info('ran git pull');
    }
    callback(err);
  });
};

exports.targets = {
  'deploy': [
    'task_deploy',
  ]
};
