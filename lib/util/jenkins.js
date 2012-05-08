var url = require('url');
var util = require('util');
var request = require('request');
var logmagic = require('logmagic');
var async = require('async');

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
  this.log = log || logmagic.local('jenkins');
}

Jenkins.prototype.ensureRevisionBuilt = function(builder, revision, callback) {
  var self = this;
  var build = null;
  var polling = false;
  var attempts = 0;

  function getLastBuild(callback) {
    self.getRevision(builder, revision, function(err, last_build) {
      if (err) {
        return callback(err, null);
      }

      if (!build || build.building === false) {
        attempts++;
      }

      build = last_build;
      callback(null, build);
    });
  }

  function pollJenkins(async_cb) {
    if (!polling) {  // Wait a few seconds before the first poll
      polling = true;
      setTimeout(async_cb, self._options.delay);
      return;
    }

    if (attempts > self._options.attempts) {
      return async_cb("ERROR: build did not complete in time.", null);
    }

    setTimeout(getLastBuild, self._options.delay, async_cb);
  }

  function isBuilt() {
    if (self.isBuildComplete(build)) {
      return true;
    }

    if (polling === false) {   // Kick the build, this is the first poll
      if (!build || build.building === false) {
        self.build(builder, revision, function(err, resp, body) {
          if (err) {
            return callback({err: err, body: body}, null);
          }
        });
      }
    }
    return false;
  }

  getLastBuild(function(err, retrieved_build) {
    if (err) {
      callback(err);
    } else if (retrieved_build && self.isBuildComplete(build)) {
      callback(null, retrieved_build);
    } else {
      async.until(isBuilt, pollJenkins, function(err) { callback(err, build); });
    }
  });
}

Jenkins.prototype.isBuildComplete = function(build) {
  if (!build) {
    this.log.info('Did not see build in API response');
    return false;
  } else if (build.building === true) {
    this.log.infof('Build is building (build #${number})', {
      number: build.number,
      build: build,
    });
    return false;
  } else {
    if (build.result === 'SUCCESS') {
      this.log.info('Build was successful!', build);
    } else {
      this.log.infof('Build ended with status ${status}', {
        status: build.result,
        build: build
      });
    }
    return true;
  }
};

Jenkins.prototype.build = function(builder, revision, callback) {
  var options = {
    url: util.format('%s/job/%s/buildWithParameters', this._url, builder),
    qs : {'REV': revision}
  }

  this.log.info('Kicking off build', options);
  request.get(options, callback);
}

Jenkins.prototype.getRevision = function(builder, revision, callback) {
  var url = util.format('%s/job/%s/api/json?%s', this._url, builder, TREE_FILTER),
      self = this;

  request.get(url, function(err, response, body) {
    var i, build, build_sha;

    if (err) {
      return callback(err);
    }

    try {
      body = JSON.parse(body);
    } catch (e) {
      return callback(e);
    }

    for (i = 0; i < body.builds.length; i++) {
      build = body.builds[i];
      build_sha = self._getBuildSHA(build);
      if (revision === build_sha) {
        return callback(null, build);
      }
    }
    callback();
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
