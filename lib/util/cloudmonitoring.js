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
var DEFAULT_MONITORING_API_URI = 'https://monitoring.api.rackspacecloud.com/v1.0';
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
  this.monitoringApiUri = options.monitoringApiUri || DEFAULT_MONITORING_API_URI;

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
        uri: [self.monitoringApiUri, auth.tenantId, 'entities?limit=1000'].join('/'),
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
 * @param {Object} _suppression An object containing the desired suppression attributes.
 *        i.e. {entities: [enyXd5ZI84, enbYO5Za17], alarms: [al49382711], start_time: 0}
 * @param {Function} callback The end callback, invoked with (err, suppressionId).
 */
CloudMonitoring.prototype.createSuppression = function(_suppression, callback) {
  var auth,
      self = this,
      suppression = _suppression,
      suppressionId;

  if (!suppression.hasOwnProperty('start_time')) {
    suppression.start_time = 0; // start suppression immediately
  }

  if (!suppression.hasOwnProperty('end_time')) {
    suppression.end_time = (Date.now() + this.defaultSuppressionDuration);
  }

  if (!suppression.hasOwnProperty('entities') &&
      !suppression.hasOwnProperty('checks') &&
      !suppression.hasOwnProperty('alarms') &&
      !suppression.hasOwnProperty('notification_plans')) {
    this.log.error('attempted to create an empty suppression, skipping', {suppression: suppression});
    callback(new Error('suppression payload did not contain any suppression attribute'));
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
        uri: [self.monitoringApiUri, auth.tenantId, 'suppressions'].join('/'),
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
 * Updates the specified suppresion.
 * @param {String} suppressionId The id of the suppression to delete.
 * @param {Object} update An object containing the suppression attributes to update.
 * @param {Function} callback The end callback, called with (err, suppresionId).
 */
CloudMonitoring.prototype.updateSuppression = function(suppressionId, update, callback) {
  var auth,
      self = this;

  if (!update.hasOwnProperty('entities') &&
      !update.hasOwnProperty('checks') &&
      !update.hasOwnProperty('alarms') &&
      !update.hasOwnProperty('notification_plans') &&
      !update.hasOwnProperty('start_time') &&
      !update.hasOwnProperty('end_time')) {
    this.log.error('attempted to update a suppression without any attribute', {update: update});
    callback(new Error('update payload did not contain at least one suppression attribute'));
    return;
  }

  if (!suppressionId) {
    callback(new Error('suppressionId was undefined'));
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
    function updateSuppression(callback) {
      request({
        uri: [self.monitoringApiUri, auth.tenantId, 'suppressions', suppressionId].join('/'),
        method: 'PUT',
        headers: {
          'X-Auth-Token': auth.token
        },
        body: JSON.stringify(update)
      },
      function(_err, response, body) {
        var err = _err;

        if (err || response.statusCode !== 204) {
          self.log.error('failed to update suppression', {err: err, body: body});
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


/*
 * Deletes the specified suppresion.
 * @param {String} suppressionId The id of the suppression to delete.
 * @param {Function} callback The end callback, called with (err, suppressionId).
 */
CloudMonitoring.prototype.deleteSuppression = function(suppressionId, callback) {
  var auth,
      self = this;

  if (!suppressionId) {
    callback(new Error('suppressionId was undefined'));
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
    function deleteSuppression(callback) {
      request({
        uri: [self.monitoringApiUri, auth.tenantId, 'suppressions', suppressionId].join('/'),
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
