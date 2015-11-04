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
 *
 *
 * The "magic number" values for cmd_typ and cmd_mod come from:
 * http://sourceforge.net/p/nagios/nagios/ci/master/tree/include/common.h
 *
 */

var url = require('url');
var querystring = require('querystring');

var logmagic = require('logmagic');
var request = require('request');

var misc = require('./misc');
var sprintf = require('./sprintf');


/**
 * Nagios Client.
 * @constructor
 * @param {Object} options The options.
 */
function Nagios(options, log) {
  var parsed = url.parse(options.url);

  // Inject auth into the URL
  delete parsed.host;
  parsed['auth'] = sprintf('%s:%s', options.username, options.password);

  this._url = url.format(parsed);
  this._options = options;
  this.log = log || logmagic.local('nagios');
}


/**
 * Execute a nagios command by passing form data to cmd.cgi.
 * @param {Object} data The form data to pass.
 * @param {Function} callback A callback fired with (err).
 */
Nagios.prototype._cmd = function(data, callback) {
  var self = this,
      reqOpts = {
        method: 'POST',
        uri: sprintf('%s/cgi-bin/nagios3/cmd.cgi', this._url),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: this._options.timeout || 30000,
        body: querystring.stringify(data)
      };

  request(reqOpts, function(err, response, body) {
    if (err) {
      callback(err);
    } else if (response.statusCode !== 200) {
      callback(new Error(sprintf('Received %s from %s', response.statusCode, self._options.url)));
    } else {
      callback();
    }
  });
};


/**
 * Disable service notifications from a servicegroup.
 * @param {String} group The name of the servicegroup.
 * @param {Function} callback A callback fired with (err).
 */
Nagios.prototype.disableServiceGroupNotifications = function(group, callback) {
  var self = this,
      data = {
        cmd_typ: 110,
        cmd_mod: 2,
        servicegroup: group,
        ahas: 'on',
        btnSubmit: 'Commit'
      },
      logObj = {group: group, url: this._options.url};

  this.log.infof('disabling notifications for servicegroup ${group} on ${url}', logObj);

  this._cmd(data, function(err) {
    if (err) {
      self.log.errorf('error disabling notifications for servicegroup ${group} on ${url}', misc.merge({err: err}, logObj));
    } else {
      self.log.infof('notifications disabled for servicegroup ${group} on ${url}', logObj);
    }
    callback(err);
  });
};


/**
 * Enable service notifications from a servicegroup.
 * @param {String} group The name of the servicegroup.
 * @param {Function} callback A callback fired with (err).
 */
Nagios.prototype.enableServiceGroupNotifications = function(group, callback) {
  var self = this,
      data = {
        cmd_typ: 109,
        cmd_mod: 2,
        servicegroup: group,
        ahas: 'on',
        btnSubmit: 'Commit'
      },
      logObj = {group: group, url: this._options.url};

  this.log.infof('enabling notifications for servicegroup ${group} on ${url}', logObj);

  this._cmd(data, function(err) {
    if (err) {
      self.log.errorf('error enabling notifications for servicegroup ${group} on ${url}', misc.merge({err: err}, logObj));
    } else {
      self.log.infof('notifications enabled for servicegroup ${group} on ${url}', logObj);
    }
    callback(err);
  });
};


/**
 * Disable service notifications from a hostgroup.
 * @param {String} group The name of the hostgroup.
 * @param {Function} callback A callback fired with (err).
 */
Nagios.prototype.disableHostGroupNotifications = function(group, callback) {
  var self = this,
      data = {
        cmd_typ: 64,
        cmd_mod: 2,
        hostgroup: group,
        ahas: 'on',
        btnSubmit: 'Commit'
      },
      logObj = {group: group, url: this._options.url};

  this.log.infof('disabling notifications for hostgroup ${group} on ${url}', logObj);

  this._cmd(data, function(err) {
    if (err) {
      self.log.errorf('error disabling notifications for hostgroup ${group} on ${url}', misc.merge({err: err}, logObj));
    } else {
      self.log.infof('notifications disabled for hostgroup ${group} on ${url}', logObj);
    }
    callback(err);
  });
};


/**
 * Enable service notifications from a hostgroup.
 * @param {String} group The name of the hostgroup.
 * @param {Function} callback A callback fired with (err).
 */
Nagios.prototype.enableHostGroupNotifications = function(group, callback) {
  var self = this,
      data = {
        cmd_typ: 63,
        cmd_mod: 2,
        hostgroup: group,
        ahas: 'on',
        btnSubmit: 'Commit'
      },
      logObj = {group: group, url: this._options.url};

  this.log.infof('enabling notifications for hostgroup ${group} on ${url}', logObj);

  this._cmd(data, function(err) {
    if (err) {
      self.log.errorf('error enabling notifications for hostgroup ${group} on ${url}', misc.merge({err: err}, logObj));
    } else {
      self.log.infof('notifications enabled for hostgroup ${group} on ${url}', logObj);
    }
    callback(err);
  });
};



/** Nagios Class */
exports.Nagios = Nagios;
