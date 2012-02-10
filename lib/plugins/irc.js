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
    var client = new irc.Client(network, config.nick, config.connect_opts ? config.connect_opts[network] : undefined);

    client.on('registered', function() {
      var i;

      clients[network] = client;
      joined[network] = [];

      client.on('join', function(channel, nick) {
        if (nick === config.nick) {
          joined[network].push(channel);
        }
      });

      for (i = 0; i < config.channels[network].length; i++) {
        clients[network].join(config.channels[network][i]);
      }
    });
  });

  dreadnot.emitter.on('deployments', function(deployment) {
    var link = sprintf('%s/stacks/%s/regions/%s/deployments/%s', dreadnot.config.default_url, deployment.stack, deployment.region,
                          deployment.deployment),
        msg = sprintf('%s is deploying %s to %s:%s - %s', deployment.user, deployment.stack, dreadnot.config.env,
                          deployment.region, link),
        endPath = ['stacks', deployment.stack, 'regions', deployment.region, 'deployments', deployment.deployment, 'end'].join('.'),
        i;
    onEach(clients, joined, function(client, channel) {
      client.notice(channel, msg);
    });

    dreadnot.emitter.once(endPath, function(success) {
      var endMsg = sprintf('deployment #%s of %s to %s:%s %s', deployment.deployment, deployment.stack, dreadnot.config.env,
          deployment.region, success ? 'succeeded' : '\u0002FAILED\u000f');
      onEach(clients, joined, function(client, channel) {
        client.notice(channel, endMsg);
      });
    });
  });

  dreadnot.emitter.on('warning_set', function(obj) {
    var msg = sprintf('Warning has been set to "%s" by %s', obj.text, obj.username);

    onEach(clients, joined, function(client, channel) {
      client.notice(channel, msg);
    });
  });

  dreadnot.emitter.on('warning_removed', function(obj) {
    var msg = sprintf('Warning "%s" has been removed by %s', obj.text, obj.username);

    onEach(clients, joined, function(client, channel) {
      client.notice(channel, msg);
    });
  });
};


function onEach(clients, joined, fn) {
  var network, i;
  for (network in joined) {
    for (i = 0; i < joined[network].length; i++) {
      fn(clients[network], joined[network][i]);
    }
  }
}
