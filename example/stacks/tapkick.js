var exec = require('child_process').exec;

var async = require('async');

var BuildBot = require('util/buildbot').BuildBot;
var knife = require('util/knife');
var misc = require('util/misc');
var sprintf = require('util/sprintf');
var git = require('util/git');

function execute(baton, args, cmd, opts, msg, callback) {
  cmdStr = cmd.join(' ');
  baton.log.info(cmd)
  if (args.dryrun) {
    baton.log.infof('dry run, skipping command: ${cmd}', {
      cmd: cmdStr
    });
    callback();
    return;
  }

  baton.log.infof('executing command: ${cmd}', {
    cmd: cmdStr
  });

  misc.spawn(cmd, opts, function(err, stdout) {
    if (err) {
      baton.log.error('error executing command', {
        cmd: cmdStr,
        err: err,
        stdout: stdout
      })
    } else {
      baton.log.info(msg, {
        cmd: cmdStr,
        stdout: stdout
      })
    }
    callback(err);
  });
};

exports.get_deployedRevision = function(args, callback) {
  git.revParse(this.config.tapkick_dir, 'HEAD', function(err, stdout) {
    callback(null, stdout);
  });
};

exports.task_deploy = function(stack, baton, args, callback) {
  cmd = ['git', 'pull', 'origin', 'master']
  opts = { cwd: stack.config.tapkick_dir, env: process.env }
  execute(baton, args, cmd, opts, 'run git pull', callback);
};

exports.targets = {
  'deploy': [
    'task_deploy',
  ]
};
