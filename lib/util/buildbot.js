/*
 *  Copyright 2011 Rackspace
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

var url = require('url');
var querystring = require('querystring');

var logmagic = require('logmagic');
var request = require('request');

var sprintf = require('./sprintf');


/**
 * BuildBot Client.
 * @constructor
 * @param {Object} options The options.
 */
function BuildBot(options, log) {
  var parsed = url.parse(options.url);

  // Inject auth into the URL
  delete parsed.host;
  parsed['auth'] = sprintf('%s:%s', options.username, options.password);

  this._url = url.format(parsed);
  this._options = options;
  this.log = log || logmagic.local('buildbot');
}


/**
 * Initiate build on buildbot
 * @param {String} builder The builder to force the build on.
 * @param {?String} Branch The branch to build. Defaults to master.
 * @param {String} revision The revision to build.
 * @param {Function} callback The completion callback(err).
 */
BuildBot.prototype.build = function(builder, branch, revision, callback) {
  branch = branch || 'master';
  var self = this,
      reqOpts = {
        method: 'POST',
        uri: sprintf('%s/builders/%s/force', this._url, builder),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: querystring.stringify({
          username: this._options.username,
          revision: revision,
          branch: branch
        })
      };

  this.log.infof('forcing build of ${revision} in branch ${branch} on ${builder}', {
    builder: builder,
    branch: branch,
    revision: revision
  });

  request(reqOpts, function(err, response, body) {
    if (err) {
      callback(err);
    } else if (response.statusCode !== 302) {
      callback(new Error(sprintf('Received %s from %s', response.statusCode, self._options.url)));
    } else {
      callback(null, body);
    }
  });
};


/**
 * Find the oldest build with a given revision.
 */
BuildBot.prototype._findOldestBuild = function(builds, revision) {
  // Logic is to return, in order of preference:
  // - Oldest Build with status code 0 (success)
  // - Oldest Build with status code not in [0, 4, 5]
  // - Newest Build with status code 4 or 5 (retry)
  var i, j, number, numbers, build, properties, retrybuild,
      oldestBuild;

  // Get numbers of builds from oldest to newest
  numbers = Object.keys(builds).map(function(numstr) {
    return parseInt(numstr, 10);
  }).sort(function(a, b) {
    return a - b;
  });

  for (i = 0; i < numbers.length; i++) {
    number = numbers[i].toString();

    if (builds.hasOwnProperty(number)) {
      build = builds[number];
      properties = build.properties;

      if (!properties) {
        this.log.warnf('invalid build at ${index}: ${text}', {
          index: number,
          text: build.error
        });
        continue;
      }

      for (j = 0; j < properties.length; j++) {
        if (properties[j][0] === 'got_revision' && properties[j][1] === revision) {
          // If a build failed due to an exception, see if a subsequent one
          // can be used instead. (Also, "5" is apparently undocumented, but
          // seems to be the result code for "retry").
          if (build.results === 4 || build.results === 5) {
            retrybuild = build;
            continue;
          }

          if (oldestBuild === undefined) {
            oldestBuild = build;
          }

          if (build.results === 0) {
            return build;
          }
        }
      }
    }
  }

  if (oldestBuild !== undefined) {
    return oldestBuild;
  }

  return retrybuild;
};

/**
 * Get a build for a specified revision.
 * @param {String} revision The revision to search for.
 * @param {Function} callback A callback fired with (err, build).
 */
BuildBot.prototype.getRevision = function(builder, revision, callback) {
  var self = this,
      selects = [],
      search, i;

  for (i = 1; i <= this._options.num_builds; i++) {
    selects.push(sprintf('-%s', i));
  }

  search = querystring.stringify({select: selects});

  request.get(sprintf('%s/json/builders/%s/builds?%s', this._url, builder, search), function(err, response, body) {
    if (err) {
      callback(err);
    } else {
      try {
        body = JSON.parse(body);
      } catch (e) {
        callback(e);
        return;
      }

      callback(null, self._findOldestBuild(body, revision));
    }
  });
};


BuildBot.prototype.ensureRevisionBuilt = function(builder, branch, revision, callback) {
  var self = this,
      attempts = 0;

  this.log.infof('ensuring revision ${revision} on ${builder}', {
    revision: revision,
    builder: builder
  });

  function attempt(force) {
    attempts++;

    if (attempts > self._options.attempts) {
      callback(new Error(sprintf('No build found after %s attempts', self._options.attempts)));
      return;
    }

    self.getRevision(builder, revision, function(err, build) {
      if (err) {
        callback(err);
      } else if (!build) {
        if (force) {
          self.build(builder, branch, revision, function(err) {
            if (err) {
              callback(err);
            } else {
              setTimeout(attempt, self._options.delay);
            }
          });
        } else {
          // The build was already forced, but isn't showing up - it is
          // *probably* pending. Alternatively, maybe num_builds happened
          // and we missed it. Oops.
          self.log.infof('build of ${revision} on ${builder} is queued', {
            revision: revision,
            builder: builder
          });
          setTimeout(attempt, self._options.delay);
        }
      } else if (build.times[1] !== null) {
        self.log.infof('build ${number} on ${builder} finished: ${text}', {
          number: build.number,
          result_code: build.results || 0,
          builder: builder,
          text: build.text.join(' ')
        });
        // There is a Buildbot bug where build.results isn't included when it
        // is 0
        if ((build.results || 0) === 0) {
          callback(null, build);
        } else {
          callback(new Error(sprintf('Build %s of %s: %s', build.number, builder, build.text.join(' '))));
        }
      } else {
        self.log.infof('build ${number} on ${builder} ETA is ${eta}s', {
          number: build.number,
          builder: builder,
          eta: build.eta
        });
        // Try again in the greater of half of the ETA or the configured delay
        setTimeout(attempt, Math.max(build.eta * 500, self._options.delay));
      }
    });
  }

  attempt(true);
};



/** BuildBot Class */
exports.BuildBot = BuildBot;
