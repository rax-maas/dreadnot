/*
 *  Copyright 2014 Rackspace
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

var graphite = require('graphite');
var logmagic = require('logmagic');
var request = require('request');

var sprintf = require('./sprintf');


/**
 * Graphite client
 * @constructor
 * @param {String} host Graphite host.
 * @param {Number} port Graphite port.
 * @param {Object} log An optional logging facility.
 */
function Graphite(host, port, eventPort, secure, log) {
  this.client = graphite.createClient(sprintf('plaintext://%s:%s/', host, port));
  this.secure = secure;
  this.host = host;
  this.port = port;
  this.eventPort = eventPort;
  this.log = log || logmagic.local('graphite');
}


/**
 * Write out metrics to graphite.
 * @param {Object} metrics An object containing the metrics to write to graphite.
 * @param {Function} callback The callback function.
 */
Graphite.prototype.writeMetrics = function(metrics, callback) {
  var self = this;

  this.log.info('Submitting metrics to graphite.', {metrics: metrics, host: this.host, port: this.host});
  this.client.write(metrics, function(err) {
    if (err) {
      self.log.error('Error submitting metrics to graphite.', {err: err, host: self.host, port: self.port});
      callback(err);
      return;
    }

    self.log.info('Successfully submitted metrics to graphite.', {host: self.host, port: self.port});
    callback();
  });
};


/**
 * Write an event out to graphite.
 * @param {Object} event The event to write to graphite.
 * @param {Function} callback The callback function.
 */
Graphite.prototype.writeEvent = function(event, tags, callback) {
  var self = this,
      reqOpts;

  reqOpts = {
    method: 'POST',
    uri: sprintf('%s://%s:%s/events/', this.secure ? 'https' : 'http', this.host, this.eventPort),
    body: JSON.stringify({
      what: event,
      tags: tags.join(' ')
    })
  };

  this.log.info('Submitting event to graphite.', {reqOpts: reqOpts});

  request(reqOpts, function(err, response, body) {
    if (err) {
      self.log.err('Error submitting event to graphite.', {err: err});
      callback(err);
      return;
    }

    if (response.statusCode !== 200) {
      self.log.err('Unexpected response code from graphite', {statusCode: response.statusCode});
      callback(new Error(sprintf('Recieved %s from %s', response.statusCode, self.host)));
      return;
    }

    self.log.info('Successfully submitted event to graphite.');
    callback();
  });
};


/** Graphite class */
exports.Graphite = Graphite;
