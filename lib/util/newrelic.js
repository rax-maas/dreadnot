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

var logmagic = require('logmagic');
var request = require('request');

var misc = require('./misc');
var sprintf = require('./sprintf');

// Hopefully newrelic retained backwards compatibility since the code here was most likely written for v1 of their api

/**
 * NewRelic Client.
 * @constructor
 * @param {Object} options The options.
 */
function NewRelic(license_key, options, log) {
  this.url = "https://api.newrelic.com";
  this._options = options;
  this.license_key = license_key;

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

  request_data = "";

  if (!this._options.hasOwnProperty('application_id')) {
    callback(new Error('No application_id passed to NewRelic!'));
    return;
  }

  for (var key in this._options) {
    if (!request_data) {
      request_data = sprintf("deployment[%s]=%s", key, this._options[key]);
    } else {
      request_data = sprintf("%s&deployment[%s]=%s", request_data, key, this._options[key]);
    }
  }

  reqOpts = {
    method: 'POST',
    uri: sprintf('%s/deployments.xml', this.url),
    headers: {
      "x-license-key": this.license_key
    },
    body: request_data
  };

  request(reqOpts, function(err, response, body) {
    if (err) {
      callback(err);
    } else if ([204, 201, 200].indexOf(response.statusCode) === -1) {
      callback(new Error(sprintf('Received %s from %s', response.statusCode, self.url)));
    }
    callback(err, body);
  });
};

exports.NewRelic = NewRelic;
