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

var misc = require('./misc');
var sprintf = require('./sprintf');


/**
 * PagerDuty Client.
 * @constructor
 * @param {Object} options The options.
 */
function PagerDuty(options, log) {
  var parsed = url.parse(options.url);

  // Inject auth into the URL
  delete parsed.host;
  parsed['auth'] = sprintf('%s:%s', options.username, options.password);

  this.url = options.url;
  this.authedURL = url.format(parsed);
  this.users = options.users;
  this.schedules = options.schedules;
  this.log = log || logmagic.local('pagerduty');
}


/**
 * Create a schedule override.
 */
PagerDuty.prototype.override = function(schedule, user, startTime, endTime, callback) {
  var self = this,
      scheduleId = this.schedules[schedule],
      userId = this.users[user],
      reqOpts;

  if (!scheduleId) {
    callback(new Error('Unconfigured schedule: ' + schedule));
    return;
  }

  if (!userId) {
    callback(new Error('Unconfigured user: ' + user));
    return;
  }

  reqOpts = {
    method: 'POST',
    uri: sprintf('%sapi/beta/schedules/%s/overrides', this.authedURL, scheduleId),
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      override: {
        start: startTime.toISOString(),
        end: endTime.toISOString(),
        user_id: userId
      }
    })
  };

  request(reqOpts, function(err, response, body) {
    var obj;

    if (err) {
      callback(err);
    } else if ([201, 200].indexOf(response.statusCode) === -1) {
      callback(new Error(sprintf('Received %s from %s', response.statusCode, self.url)));
    } else {
      try {
        obj = JSON.parse(body);
      } catch (e) {
        err = e;
      }
      callback(err, err ? null : obj.override);
    }
  });
};


/** PagerDuty Class */
exports.PagerDuty = PagerDuty;
