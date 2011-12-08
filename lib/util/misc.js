var sprintf = require('./sprintf');
var log = require('logmagic').local('deploy.helpers.misc');
var spawn = require('child_process').spawn;


/** Spawn a subprocess and issue the callback.
 * @param {Array} cmd Command and Arguments.
 * @param {Function} callback Completion callback(err, resultStdoutString).
 */
exports.spawn = function(cmd, callback) {
  var args,
      proc,
      resultString = '',
      errString = '',
      cmdStr;

  // Copy command so we don't override the parent
  cmd = cmd.slice();
  args = cmd.splice(1);

  cmdStr = sprintf('%s %s', cmd[0], args.join(' '));
  log.info('Executing Command', cmdStr);

  proc = spawn(cmd[0], args);
  proc.stdout.on('data', function(data) {
    resultString += data;
  });
  proc.stderr.on('data', function(data) {
    errString += data;
  });
  proc.on('exit', function(code) {
    if (code) {
      callback(new Error(sprintf('Failed command %s:\nstderr:\n%s\nstdout:\n%s', cmdStr, errString, resultString)));
    } else {
      callback(null, resultString);
    }
  });
};


exports.randstr = function(len) {
  var chars, r, x;

  chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  r = [];

  for (x = 0; x < len; x++) {
    r.push(chars[exports.getRandomInt(0, chars.length - 1)]);
  }

  return r.join('');
}


exports.getRandomInt = function(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};


exports.merge = function(a, b) {
  var c = {}, attrname;

  for (attrname in a) {
    if (a.hasOwnProperty(attrname)) {
      c[attrname] = a[attrname];
    }
  }
  for (attrname in b) {
    if (b.hasOwnProperty(attrname)) {
      c[attrname] = b[attrname];
    }
  }
  return c;
};
