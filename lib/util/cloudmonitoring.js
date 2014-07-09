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
 *  Please define cloudmonitoring : { username: 'user', apiKey: 'key' }
 *  in your dreadnot settings file before using.
 *
 */

var logmagic = require('logmagic');
var request = require('request');
var async = require('async');

var KeystoneClient = require('keystone-client').KeystoneClient;

var DEFAULT_AUTH_URI = 'https://identity.api.rackspacecloud.com/v2.0';
var MONITORING_API_URI = 'https://monitoring.api.rackspacecloud.com:443/v1.0';
var DEFAULT_SUPPRESSION_DURATION = 30 * 60 * 1000; //30 mins


/**
 * Cloud Monitoring Client.
 * @constructor
 * @param {Object} options The options.
 */
function CloudMonitoring(options, log) {
  this._options = options;
  this.log = log || logmagic.local('cloudmonitoring');
  this.defaultSuppressionDuration = options.defaultSuppressionDuration || DEFAULT_SUPPRESSION_DURATION;

  this.keystoneClient = new KeystoneClient(options.authUri || DEFAULT_AUTH_URI, {
      username: options.username,
      apiKey: options.apiKey
    }
  );
}


/**
 * Gets a list of all entities on an account.
 * @param {Function} callback The callback.
 */
CloudMonitoring.prototype.getEntities = function(callback) {
  var auth,
      entities,
      self = this;

  async.series([
    function getToken(callback) {
      self.keystoneClient.getTenantIdAndToken(null, function(err, _auth) {
        if (err) {
          self.log.error('could not authenticate to Keystone: ' + err);
        }

        auth = _auth;
        callback(err);
      });
    },
    function listEntitiesForAccount(callback) {
      //TODO: paginate.
      request({
        uri: [MONITORING_API_URI, auth.tenantId, 'entities?limit=1000'].join('/'),
        method: 'GET',
        headers: {
          'X-Auth-Token': auth.token
        }
      },
      function(_err, response, body) {
        var err = _err;
        if (err || response.statusCode !== 200) {
          self.log.error('failed to list cloud monitoring entities', {err: err, body: body});
          if (!err) {
            err = new Error('non-200 status code received');
          }
        } else {
          try {
            entities = JSON.parse(body).values;
          } catch (_err) {
            self.log.error('cloud monitoring returned invalid data', {err: _err, body: body});
            err = new Error('malformed api response received');
          }
        }
        callback(err);
      });
    }],
    function asyncHandler(err) {
      callback(err, entities);
    });
};


/**
 * Returns the list of entitiy IDs whose label was matched by pattern.
 * If your entity labels are set to your servers' hostnames, this is very useful
 * to get all the entity ids of a region before creating a suppression.
 * @param {RegExp} pattern The regexp to match entity labels against.
 * @param {Function} callback The callback.
 */
CloudMonitoring.prototype.getEntityIdsByRegex = function(pattern, callback) {
  this.getEntities(function(err, entities) {
    var matchedEntityIds = [];

    if (err) {
      callback(err, null);
    } else {
      entities.forEach(function(entity) {
        if (entity.hasOwnProperty('label') && pattern.test(entity.label)) {
          matchedEntityIds.push(entity.id);
        }
      });

      callback(null, matchedEntityIds);
    }
  });
};


/*
 * Creates a suppression for a group of entities.
 * @param {Array} entities The list of entity ids to suppress.
 * @param {Integer} startTime A unix timestamp in ms when to start the suppression (0 or null means right away).
 * @param {Integer} endTime A unix timestamp in ms when to end the suppression (set to null to use this.defaultSuppressionDuration)
 * @param {Function} callback A callback.
 */
CloudMonitoring.prototype.createEntitiesSuppression = function(entities, startTime, endTime, callback) {
  var auth,
      self = this,
      suppression = {
        entities: entities,
        start_time: startTime || 0,
        end_time: endTime || (Date.now() + this.defaultSuppressionDuration)
      },
      suppressionId;

  if (!entities || !entities instanceof Array || entities.length === 0) {
    this.log.warn('no entities to set a suppression on, skipping');
    callback(new Error('requested a suppression on zero entities'));
    return;
  }

  async.series([
    function getToken(callback) {
      self.keystoneClient.getTenantIdAndToken(null, function(err, _auth) {
        if (err) {
          self.log.error('could not authenticate to Keystone: ' + err);
        }

        auth = _auth;
        callback(err);
      });
    },
    function createSuppression(callback) {
      request({
        uri: [MONITORING_API_URI, auth.tenantId, 'suppressions'].join('/'),
        method: 'POST',
        headers: {
          'X-Auth-Token': auth.token
        },
        body: JSON.stringify(suppression)
      },
      function(_err, response, body) {
        var err = _err,
            suppressionUri;

        if (err || response.statusCode !== 201) {
          self.log.error('failed to create suppression', {err: err, body: body});
          if (!err) {
            err = new Error('non-201 status code received');
          }
        } else {
          // The api returns an uri pointing to the suppression in the form of
          // https://monitoring.api.rackspacecloud.com/v1.0/12345/suppressions/splOUfE2xI
          // where splOUfE2xI is the suppression ID we want to remember.
          if (response.headers.hasOwnProperty('location')) {
            suppressionUri = response.headers['location'].split('/');
            suppressionId = suppressionUri[suppressionUri.length-1];
          }

          if (!suppressionId) {
            self.log.error('cloud monitoring returned invalid data', {headers: response.headers});
            err = new Error('malformed api response received');
          } else {
            self.log.info('created suppression id ' + suppressionId);
          }
        }
        callback(err);
      });
    }],
    function asyncHandler(err) {
      callback(err, suppressionId);
    });
};


/*
 * Deletes the specified suppresion.
 * @param {String} suppressionId The id of the suppression to delete.
 * @param {Function} callback A callback.
 */
CloudMonitoring.prototype.deleteSuppression = function(suppressionId, callback) {
  var auth,
      self = this;

  async.series([
    function getToken(callback) {
      self.keystoneClient.getTenantIdAndToken(null, function(err, _auth) {
        if (err) {
          self.log.error('could not authenticate to Keystone: ' + err);
        }

        auth = _auth;
        callback(err);
      });
    },
    function deleteSuppression(callback) {
      request({
        uri: [MONITORING_API_URI, auth.tenantId, 'suppressions', suppressionId].join('/'),
        method: 'DELETE',
        headers: {
          'X-Auth-Token': auth.token
        }
      },
      function(_err, response, body) {
        var err = _err;

        if (err || response.statusCode !== 204) {
          self.log.error('failed to delete suppression', {err: err, body: body});
          if (!err) {
            err = new Error('non-204 status code received');
          }
        }
        callback(err);
      });
    }],
    function asyncHandler(err) {
      callback(err, suppressionId);
    });
};


/** CloudMonitoring Class */
exports.CloudMonitoring = CloudMonitoring;
