/*
 *  Copyright 2012 Needle
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
 * NewRelic Client.
 * @constructor
 * @param {Object} options The options.
 */
function Sensu(api_key, options, log) {
  this.url = "https://api.newrelic.com";
  this._options = options;
  this.api_key = api_key;

  if (!this._options.hasOwnProperty('user')) {
    this._options['user'] = 'dreadnot';
  }

  this.log = log || logmagic.local('sensu');
}


/**
 * Notify NewRelic of a deploy
 */
NewRelic.prototype.send_deploy_message = function(stack, callback) {
  var self = this,
             reqOpts,
             request_data;

  request_data = {};

  for (var key in this._options) {
    request_data[sprintf("deployment[%s]" % key)] = this._options[key];
  }

  if (!this._options.hasOwnProperty('application_id')) {
    return callback(new Error('No application_id passed to NewRelic!'));
  }

  reqOpts = {
    method: 'POST',
    uri: sprintf('%s/deployments.xml', this.url),
    headers: {
      "x-api-key": this.api_key
    },
    body: JSON.stringify(request_data)
  };

  request(reqOpts, function(err, response, body) {
    var obj;

    if (err) {
      callback(err);
    } else if ([204, 201, 200].indexOf(response.statusCode) === -1) {
      callback(new Error(sprintf('Received %s from %s', response.statusCode, self.url)));
    }
    callback(err, body);
  });
};

exports.NewRelic = NewRelic;
