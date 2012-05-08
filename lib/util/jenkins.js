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

  function getRevision(callback) {
    self.getRevision(builder, revision, function(err, last_build) {
      if (err) {
        return callback(err);
      }

      build = last_build;
      callback(null, build);
    });
  }

  function isBuilt() {
    if (!build) {
      if (polling === false) {
        self.build(builder, revision, function() { self.log.info("build kicked!") });
      } else {
        self.log.info('build is queued, has not shown up yet');
      }
      return false;
    } else if (build.building === true) {
      self.log.info('build is building');
      return false;
    } else {
      if (build.result === 'SUCCESS') {
        self.log.info('build was successful!', build);
      } else {
        self.log.infof('build ended with status ${status}', {
          status: build.result,
          build: build
        });
      }
      return true;
    }
  }

  function poll_jenkins(async_cb) {
    if (!polling) {  // Wait a few seconds before the first poll
      polling = true;
      setTimeout(async_cb, self._options.delay);
      return;
    }
    setTimeout(getRevision, self._options.delay, async_cb);
  }

  getRevision(function(err, retrieved_build) {
    if (err) {
      self.log.error("BOO, ERROR GETTING REV THE FIRST TIME");
      callback(err);
    } else if (retrieved_build && isBuilt()) {
      self.log.error("HMM, GOT A REV BUT IT WAS OVER");
      callback(null, retrieved_build);
    } else {
      self.log.info("NEVER SEEN THAT SHA1 BEFORE LOL");
      async.until(isBuilt, poll_jenkins, function(err) { callback(err, build); });
    }
  });
}

Jenkins.prototype.build = function(builder, revision, callback) {
  // Call the Jenkins API to build
  var url = util.format('%s/job/%s/buildWithParameters', this._url, builder);
  var options = {'REV': revision}

  this.log.info('kicking off build', {url: url, qs: options});
  request.get({url: url, qs: options}, callback);
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
    self.log.info('couldnt find revision', {rev: revision});
    setTimeout(callback, self._options.delay, null, null);
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
