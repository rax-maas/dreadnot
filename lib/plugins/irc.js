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

var async = require('async');
var irc = require('irc');

var sprintf = require('util/sprintf');

exports.run = function(dreadnot) {
  var clients = {},
      joined = {},
      config = dreadnot.config.plugins.irc;

  async.forEach(Object.keys(config.channels), function(network, callback) {
    var client = new irc.Client(network, config.nick);

    client.on('registered', function() {
      var i;

      clients[network] = client;
      joined[network] = [];

      client.on('join', function(channel) {
        joined[network].push(channel);
      });

      for (i = 0; i < config.channels[network].length; i++) {
        clients[network].join(config.channels[network][i]);
      }
    });
  });

  dreadnot.emitter.on('deployments', function(deployment) {
    var msg = sprintf('%s is deploying %s to %s:%s', deployment.user, deployment.stack, dreadnot.config.env, deployment.region),
        endPath = ['stacks', deployment.stack, 'regions', deployment.region, 'deployments', deployment.deployment, 'end'].join('.'),
        network, i;
    onEach(clients, joined, function(client, channel) {
      client.notice(channel, msg);
    });

    dreadnot.emitter.once(endPath, function(success) {
      var endMsg = sprintf('deployment #%s of %s to %s:%s %s', deployment.deployment, deployment.stack, dreadnot.config.env,
          deployment.region, success ? 'succeeded' : '*FAILED*');
      onEach(clients, joined, function(client, channel) {
        client.notice(channel, endMsg);
      });
    });
  });
};



function onEach(clients, joined, fn) {
  for (network in joined) {
    for (i = 0; i < joined[network].length; i++) {
      fn(clients[network], joined[network][i]);
    }
  }
}
