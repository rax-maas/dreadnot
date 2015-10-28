var async = require('async'),
    misc = require('util/misc'),
    git = require('util/git');


exports.get_deployedRevision = function(args, callback) {
  git.revParse(this.config.tapkick_dir, 'HEAD', function(err, stdout) {
    // trim leading and trailing whitespace
    callback(null, stdout.replace(/^\s+|\s+$/g, ''));
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
