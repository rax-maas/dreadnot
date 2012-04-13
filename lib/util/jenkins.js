var url = require('url');
var util = require('util');
var request = require('request');
var logmagic = require('logmagic');

var TREE_FILTER = 'depth=1&tree=builds[actions[lastBuiltRevision[SHA1]],result,number,building]';

/**
 * Jenkins Client.
 * @constructor
 * @param {Object} options The options.
 */
function Jenkins(options, log) {
  var parsed = url.parse(options.url);

  parsed['auth'] = util.format('%s:%s', options.username, options.password);

  this._url = url.format(parsed);
  this._options = options;
  this.log = log || logmagic.local('buildbot');
}

Jenkins.prototype.build = function(builder, revision, callback) {
  // Call the Jenkins API to build
}

Jenkins.prototype.getRevision = function(builder, revision, callback) {
  var url = util.format('%s/job/%s/api/json?%s', this._url, builder, TREE_FILTER),
      self = this;

  request.get(url, function(err, response, body) {
    var i, build, build_sha;

    if (err) {
      callback(err);
    } else {
      try {
        body = JSON.parse(body);
      } catch (e) {
        callback(e);
        return;
      }
      for (i = 0; i < body.builds.length; i++) {
        build = body.builds[i];
        build_sha = self._getBuildSHA(build);
        if (revision === build_sha) {
          return callback(null, build);
        }
      }
    }
  });
}

Jenkins.prototype._getBuildSHA = function (build) {
  var actions = build.actions,
      action, i;

  for (i=0; i < build.actions.length; i++) {
    action = actions[i];
    if (action.hasOwnProperty('lastBuiltRevision')) {
      return action.lastBuiltRevision.SHA1;
    }
  }
};

exports.Jenkins = Jenkins;
