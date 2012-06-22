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
 * Sensu Client.
 * @constructor
 * @param {Object} options The options.
 */
function Sensu(options, log) {
  var parsed = url.parse(options.url);

  this.url = options.url;
  this.log = log || logmagic.local('sensu');
}


/**
 * Silence a client's checks
 */
Sensu.prototype.silence = function(client_id, user, callback) {
  var self = this,
             reqOpts;

  reqOpts = {
    method: 'POST',
    uri: sprintf('%s/stash/silence/%s', this.url, client_id),
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      timestamp: Math.round(new Date().getTime() / 1000),
      actor: "dreadnot",
      user: user
    })
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


/**
 * Unsilence a client's checks
 */
Sensu.prototype.unsilence = function(client_id, user, callback) {
  var self = this,
             reqOpts;

  reqOpts = {
    method: 'DELETE',
    uri: sprintf('%s/stash/silence/%s', this.url, client_id),
    headers: {
      'Content-Type': 'application/json'
    }
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


exports.Sensu = Sensu;
