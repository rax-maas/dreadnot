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
var log = require('logmagic').local('plugins.irc');

var sprintf = require('util/sprintf');

exports.run = function(dreadnot) {
  var clients = {},
      joined = {},
      config = dreadnot.config.plugins.irc;

  Object.keys(config.channels).forEach(function(network) {
    var client = new irc.Client(network, config.nick, config.connect_opts ? config.connect_opts[network] : undefined);

    log.info('connecting to irc network', {network: network, nick: config.nick});

    client.on('registered', function() {
      var i;

      clients[network] = client;
      joined[network] = [];

      config.channels[network].forEach(function(chanStr) {
        var channel = chanStr.split(' ')[0];

        log.info('joining channel', {network: network, channel: channel});
        clients[network].join(chanStr);

        clients[network].once('join' + channel, function(nick) {
          log.info('joined channel', {network: network, channel: channel, nick: nick});
          joined[network].push(channel);
        });
      });
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
      log.info('notifying channel', {channel: channel, message: msg});
      client.notice(channel, msg);
    });

    dreadnot.emitter.once(endPath, function(success) {
      var endMsg = sprintf('deployment #%s of %s by %s to %s:%s %s',
                           deployment.deployment,
                           deployment.stack,
                           deployment.user,
                           dreadnot.config.env,
                           deployment.region,
                           success ? 'succeeded' : '\u0002FAILED\u000f');
      onEach(clients, joined, function(client, channel) {
        log.info('notifying channel', {channel: channel, message: endMsg});
        client.notice(channel, endMsg);
      });
    });
  });

  dreadnot.emitter.on('warning.set', function(obj) {
    var msg = sprintf('Warning has been set to "%s" by %s', obj.text, obj.username);

    onEach(clients, joined, function(client, channel) {
      log.info('notifying channel', {channel: channel, message: msg});
      client.notice(channel, msg);
    });
  });

  dreadnot.emitter.on('warning.removed', function(obj) {
    var msg = sprintf('Warning "%s" has been removed by %s', obj.text, obj.username);

    onEach(clients, joined, function(client, channel) {
      log.info('notifying channel', {channel: channel, message: msg});
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
