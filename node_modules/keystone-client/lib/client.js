/**
 *  Copyright 2012 Rackspace
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

var querystring = require('querystring');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var async = require('async');
var sprintf = require('sprintf').sprintf;

var request = require('rackspace-shared-utils/lib/request');
var errors = require('rackspace-shared-utils/lib/errors');

var KEYSTONE_SUCCESS_STATUS_CODES = [200, 203];

/*
 * How long to cache the admin token for before obtaining a new one.
 * @type {Number}
 */
var DEFAULT_CACHE_TOKEN_FOR = 60;

/**
 * OpenStack Keystone Identity API client.
 *
 * @param {String} url Base keystone server url including the version.
 * @param {Object} options Authentication options (username, apiKey, password,
 * cacheTokenFor).
 * @constructor
 */
function KeystoneClient(url, options) {
  options = options || {};

  if (options.username) {
    if (!options.password && !options.apiKey) {
      throw new Error('If username is provided you also need to provide password or apiKey');
    }
  }

  this._url = url;
  this._username = options.username;
  this._apiKey = options.apiKey;
  this._password = options.password;
  this._extraArgs = options.extraArgs || {};
  this._cacheTokenFor = options.cacheTokenFor || DEFAULT_CACHE_TOKEN_FOR;

  this._token = null;
  this._tokenExpires = null;
  this._refreshTokenCompletions = [];
  this._tokenUpdated = 0;
  this._tenantId = null;
  this._serviceCatalog = [];
}

util.inherits(KeystoneClient, EventEmitter);

/**
 * @return {Object} default http request options.
 */
KeystoneClient.prototype._defaultOptions = function() {
  var options = {
    'parse_json': true,
    'expected_status_codes': KEYSTONE_SUCCESS_STATUS_CODES,
    'headers': {'Accept': 'application/json', 'Content-Type': 'application/json'},
    'timeout': 5000,
    'return_response': true
  };
  return options;
};

/**
 * Ensure we have a relatively fresh auth api token.
 *
 * @param {Boolean} force Forcefully update the token, ignoring a cache
 * interval.
 * @param {Function} callback Completion callback.
 */
KeystoneClient.prototype._freshToken = function(force, callback) {
  var curtime;

  curtime = (new Date().getTime() / 1000);

  if (!force && (curtime < (this._tokenUpdated + this._cacheTokenFor))) {
    callback(null, this._token);
    return;
  }

  this._refreshTokenCompletions.push(callback);

  if (this._refreshTokenCompletions.length === 1) {
    this._updateToken();
  }
};

/**
 * Update our Service catalog and Auth Token caches.
 * Notifies this._refreshTokenCompletions on completion or error.
 */
KeystoneClient.prototype._updateToken = function() {
  var options, url, body, self = this;

  options = this._defaultOptions();

  url = sprintf('%s/tokens', this._url);
  body = {};

  if (this._password) {
    body = {'auth': {'passwordCredentials': {'username': this._username, 'password': this._password}}};
  }
  else {
    body = {'auth': {'RAX-KSKEY:apiKeyCredentials': {'username': this._username, 'apiKey': this._apiKey}}};
  }

  function complete(err, result) {
    var cpl;

    self._tokenUpdated = new Date().getTime() / 1000;
    cpl = self._refreshTokenCompletions;
    self._refreshTokenCompletions = [];
    cpl.forEach(function(func) {
      func(err, result);
    });
  }

  this.emit('log', 'debug', 'Refresing admin token', {'url': this._url});

  request.request(url, 'POST', JSON.stringify(body), options, function(err, result) {
    var cpl, newToken, newExpires, logObj;

    if (err) {
      complete(err);
      return;
    }

    if (result.body.access) {
      newToken = result.body.access.token.id;
      newExpires = result.body.access.token.expires;
      logObj = {'url': self._url, 'expires': newExpires};

      if (newToken === self._token) {
        self.emit('log', 'debug', 'Received idential admin token', logObj);
      }
      else {
        self.emit('log', 'debug', 'Received new admin token', logObj);
      }

      self._token = newToken;
      self._tokenExpires = newExpires;
      self._serviceCatalog = result.body.access.serviceCatalog;
    }
    else {
      complete(new Error('Malformed response: ' + JSON.stringify(result)));
      return;
    }

    complete(null, self._token);
  });
};

/**
 * Validate a tenantId and token for a user. This method doesn't require
 * username and api key / password to be provided to the constructor.
 *
 * @param {String} tenantId User's tenantId.
 * @param {String} token User's Token.
 * @param {Function} callback Callback called with (err, body).
 */
KeystoneClient.prototype.validateTokenForTenant = function(tenantId, token, callback) {
  var self = this, options, url, body;

  body = JSON.stringify({'auth': {'tenantName': tenantId, 'token': {'id': token}}});

  options = this._defaultOptions();

  url = sprintf('%s/tokens/', self._url);

  request.request(url, 'POST', body, options, function(err, result) {
    var logObj, data, token, tenant;

    if (err) {
      if ((err instanceof errors.UnexpectedStatusCodeError) && result.body) {
        logObj = {code: err.statusCode, url: self._url, body: result.body};

        if (err.statusCode === 404) {
          self.emit('log', 'debug', 'Authentication API returned 404, invalid tenant id or token', logObj);
        }
        else if (err.statusCode === 401) {
          self.emit('log', 'error', 'Authentication API returned 401, invalid admin token (or auth is broken)', logObj);
        }
        else {
          self.emit('log', 'error', 'Authentication API returned an unexpected status code', logObj);
        }
      }

      callback(err);
      return;
    }

    data = result.body.access;

    if (!data) {
      callback(new Error('Malformed response: ' + JSON.stringify(result)));
      return;
    }

    token = data.token || {};
    tenant = token.tenant || {};

    if (tenant.id !== tenantId) {
      // Returned tenant id doesn't match the provided one.
      callback(new errors.UnexpectedStatusCodeError(KEYSTONE_SUCCESS_STATUS_CODES, 401));
      return;
    }

    callback(null, data);
  });
};

/**
 * Validate an auth token without validation the tenant it belongs to.
 *
 * @param {String} token User's Token.
 * @param {Function} callback Callback called with (err, body).
 */
KeystoneClient.prototype.validateToken = function(token, callback) {
  var options = this._defaultOptions(), url = sprintf('%s/tenants', this._url);

  options.headers['X-Auth-Token'] = token;

  request.request(url, 'GET', null, options, function(err, result) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, result.body);
  });
};

/**
 * Retrieve information about a TenantId, using the admin token.
 *
 * @param {String} tenantId User's tenantId.
 * @param {Object} options Options object with the following keys:
 * refreshAuthToken.
 * @param {Function} callback Completion callback.
 */
KeystoneClient.prototype.getTenantInfo = function(tenantId, options, callback) {
  options = options || {};
  var url, self = this;

  this._freshToken(options.refreshAuthToken, function() {
    var reqOptions, qargs;

    reqOptions = self._defaultOptions();
    reqOptions.headers['X-Auth-Token'] = self._token;

    qargs = querystring.stringify(self._extraArgs);

    url = sprintf('%s/tenants/%s?%s', self._url, tenantId, qargs);

    request.request(url, 'GET', null, reqOptions, function(err, result) {
      if (err) {
        if ((err instanceof errors.UnexpectedStatusCodeError) && result.body) {
          self.emit('log', 'error', 'tenantInfo: Authentication API returned an unexpected status code',
                    {'code': err.statusCode, 'body': result.body, 'tenantId': tenantId});
        }

        callback(err);
        return;
      }

      if (!result.body.tenant) {
        callback(new Error('tenantInfo: malformed response: ' + JSON.stringify(result)));
        return;
      }

      callback(null, result.body.tenant);
    });
  });
};

/**
 * Get the service catalog from Keystone.
 *
 * @param {Object} options Options object with the following keys:
 * refreshAuthToken.
 * @param {Function} callback Completion callback.
 */
KeystoneClient.prototype.getServiceCatalog = function(options, callback) {
  options = options || {};
  var self = this;

  this._freshToken(options.refreshAuthToken, function(err) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, self._serviceCatalog);
  });
};

/**
 * Get the tenant id and token from Keystone for the current username & api key
 * / password combination.
 *
 * @param {Object} options Options object with the following keys:
 * refreshAuthToken.
 * @param {Function} callback Completion callback.
 */
KeystoneClient.prototype.getTenantIdAndToken = function(options, callback) {
  options = options || {};
  var self = this, tenantId;

  this._freshToken(options.refreshAuthToken, function(err) {
    if (err) {
      callback(err);
      return;
    }

    self._serviceCatalog.forEach(function(item) {
      if (item.name === 'cloudServers' || item.name === 'cloudServersLegacy') {
        if (item.endpoints.length === 0) {
          throw new Error('Endpoints should always be > 0');
        }

        tenantId = item.endpoints[0].tenantId;
      }
    });

    callback(null, {token: self._token, expires: self._tokenExpires, tenantId: tenantId});
  });
};


/**
 * Retrieve a tenant id for the provided cloud username.
 *
 * @param {String} username username.
 * @param {Function} callback Callback called with (err, tenantId).
 */
KeystoneClient.prototype.getTenantId = function(username, callback) {
  var url, options, authStr;

  url = sprintf('%s/users/%s', this._url, username);
  authStr = new Buffer(this._username + ':' + this._password).toString('base64');
  options = {
    'parse_json': true,
    'expected_status_codes': ['200'],
    'timeout': 5000,
    'return_response': true,
    'headers': {'Accept': 'application/json',
                'Authorization': 'Basic ' + authStr}
  };

  request.request(url, 'GET', null, options, function(err, result) {
    var tenantId;
    if (err) {
      callback(err, null);
      return;
    }

    tenantId = result.body.user.mossoId;
    callback(null, tenantId);
  });
};

exports.KeystoneClient = KeystoneClient;
