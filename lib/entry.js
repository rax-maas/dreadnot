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

var logmagic = require('logmagic');
var log = require('logmagic').local('entry');
var optimist = require('optimist');

var path = require('path');

var webApp = require('./web/app');
var Dreadnot = require('./dreadnot').Dreadnot;
var plugins = require('./plugins');

exports.run = function() {
  var argv, config, d;

  optimist = optimist.usage('Usage: $0 -p [port] -c [/path/to/settings.js] -s [/path/to/stack/directory/] --log-sink [logmagic sink]');
  optimist = optimist['default']('p', 8000);
  optimist = optimist['default']('c', './local_settings');
  optimist = optimist['default']('s', './stacks');
  optimist = optimist['default']('log-sink', 'console');
  argv = optimist.argv;

  logmagic.route('__root__', logmagic.DEBUG, argv['log-sink']);

  config = require(path.resolve(argv.c)).config;
  d = new Dreadnot(config, argv.s);

  d.init(function(err) {
    if (err) {
      log.error('error initializing dreadnot', {err: err});
      process.exit(1);
      return;
    }

    plugins.run(d);
    webApp.run(argv.p, d);
  });
};
