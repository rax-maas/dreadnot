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
var fs = require('fs'),
    authMethods = {};

// read all possible auth handlers (*.js from ./auth folder)
fs.readdirSync(__dirname + '/auth').forEach(function(authMethod) {
  if (authMethod.substr(-3) === '.js') {
    authMethods[authMethod.replace('.js', '')] = require(__dirname + '/auth/' + authMethod);
  }
});

exports.initialize = function(config) {
  // if auth_method is not set in configuration, ensure that the default handler is set to htpasswd or passthru, depending on the login_required config flag
  if (!config.auth_method) {
    config.auth_method = (config.login_required ? 'htpasswd' : 'passthru');
  }

  if (Object.keys(authMethods).indexOf(config.auth_method) < 0) {
    throw new Error('Invalid auth_method in configuration! Valid options are: ' + Object.keys(authMethods).join(', '));
  }
  return authMethods[config.auth_method].initialize(config);
};

// Maintain backwards compatibility
exports.loadDBFromFile = require('./auth/htpasswd').initialize;
exports.createProxyPassAuth = require('./auth/passthru').initialize;
