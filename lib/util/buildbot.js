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

var log = require('logmagic').local('buildbot');
var request = require('request');

var sprintf = require('./sprintf');


/**
 * BuildBot Client.
 * @constructor
 * @param {Object} options The options.
 */
function BuildBot(options) {
  var parsed = url.parse(options.url);

  // Inject auth into the URL
  delete parsed.host;
  parsed['auth'] = sprintf('%s:%s', options.username, options.password);

  this._url = url.format(parsed);
  this._options = options;
}


/**
 * Initiate build on buildbot
 * @param {String} builder The builder to force the build on.
 * @param {String} revision The revision to build.
 * @param {Function} callback The completion callback(err).
 */
BuildBot.prototype.build = function(builder, revision, callback) {
  var self = this,
      reqOpts = {
        method: 'POST',
        uri: sprintf('%s/builders/%s/force', this._url, builder),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: querystring.stringify({
          username: this._options.username,
          revision: revision
        })
      };

  log.info('forcing build', {
    builder: builder,
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
  var i, j, number, numbers, build, properties;

  // Get numbers of builds from oldest to newest
  numbers = Object.keys(builds).map(function(numstr) {
    return parseInt(numstr);
  }).sort(function(a, b) {
    return a - b;
  });

  for (i = 0; i < numbers.length; i++) {
    number = numbers[i].toString();

    if (builds.hasOwnProperty(number)) {
      build = builds[number];
      properties = build.properties; 

      for (j = 0; j < properties.length; j++) {
        if (properties[j][0] === 'got_revision' && properties[j][1] === revision) {
          return build;
        }
      }
    }
  }
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

  log.info('searching for revision', {
    builder: builder,
    revision: revision
  });

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


/**
 * 
 */
BuildBot.prototype.ensureRevisionBuilt = function(builder, revision, callback) {
  var self = this,
      attempts = 0;

  // After all, why would the buildbot API tell you whether a build failed?
  function stepFailed(step) {
    var text = step.text.join(' ');
    return text.match(/failed/) ? text : null;
  }

  function attempt() {
    attempts++;

    if (attempts > self._options.retries) {
      callback(new Error(sprintf('No build found after %s attempts', self._options.retries)));
      return;
    }

    self.getRevision(builder, revision, function(err, build) {
      var messages;

      if (err) {
        callback(err);
      } else if (!build) {
        self.build(builder, revision, function(err) {
          if (err) {
            callback(err);
          } else {
            setTimeout(attempt, self._options.delay);
          }
        });
      } else if (build.steps[build.steps.length - 1].isFinished) {
        messages = build.steps.map(stepFailed).filter(function(message) {
          return message !== null;
        });

        if (messages.length > 0) {
          callback(new Error(sprintf('Build %s of %s: %s', build.number, builder, message.join(', '))));
        } else {
          callback(null, build);
        }
      } else {
        setTimeout(attempt, self._options.delay);
      }
    });
  }

  attempt();
};



/** BuildBot Class */
exports.BuildBot = BuildBot;
