/*
 *  Copyright 2011 Brian McKinney (@tritonrc)
 *  Copyright 2014 Circonus, Inc. All Rights Reserved.
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

var slack = require('node-slackr');

var helpers = require('web/view_helpers');
var log = require('logmagic').local('plugins.slack');
var sprintf = require('util/sprintf');

exports.run = function(dreadnot) {
  var config = dreadnot.config.plugins.slack,
      MY_SLACK_WEBHOOK_URL = config.webhook_url,
      client = new slack(MY_SLACK_WEBHOOK_URL);

  log.info('loaded');

  dreadnot.emitter.on('deployments', function(deployment) {
    var link = sprintf(
      '%s/stacks/%s/regions/%s/deployments/%s',
      dreadnot.config.default_url,
      deployment.stack,
      deployment.region,
      deployment.deployment
    ),
    msg = sprintf(
      '%s is deploying %s to %s:%s - %s',
      deployment.user,
      deployment.stack,
      dreadnot.config.env,
      deployment.region,
      link
    ),
    endPath = [
      'stacks',
      deployment.stack,
      'regions',
      deployment.region,
      'deployments',
      deployment.deployment,
      'end'
    ].join('.');

    var messages = {
      text : '<' + link + '|Deploying>',
      channel : config.rooms,
      username : config.user,
      icon_emoji : config.icon,
      attachments: [
        { fallback: msg,
          fields: [
            { title: 'User', value: deployment.user, short: true },
            { title: 'Stack', value: deployment.stack, short: true },
            { title: 'Environment', value: dreadnot.config.env, short: true },
            { title: 'Region', value: deployment.region, short: true }
          ]
        }
      ]
    };

    client.notify(messages, function (err, result) {
      console.log(err, result);
    });

    dreadnot.emitter.once(endPath, function(success) {
      var endMsg = sprintf(
        'deployment #%s of %s to %s:%s %s',
        deployment.deployment,
        deployment.stack,
        dreadnot.config.env,
        deployment.region,
        success ? 'SUCCEEDED' : 'FAILED'
      );

      client.notify({
        channel: config.rooms,
        icon_emoji: config.icon,
        text: '<' + link + '|Deployment> - ' + (success ? 'SUCCEEDED' : 'FAILED'),
        username: config.name,
        attachments: [
          { fallback: endMsg,
            color: success ? '#89B54C' : '#CB452A',
            fields: [
              { title: 'Stack', value: deployment.stack, short: true },
              { title: 'Environment', value: dreadnot.config.env, short: true },
              { title: 'Region', value: deployment.region, short: true },
              { title: 'Deployment', value: deployment.deployment, short: true },
              { title: 'Version', value: '<' + helpers.ghCommitUrl(deployment.github_href, deployment.to_revision) + '|' + helpers.trimRevision(deployment.to_revision) + '>', short: true },
              { title: 'Diff', value: '<' + helpers.ghDiffUrl(deployment.github_href, deployment.from_revision, deployment.to_revision) + '|from ' + helpers.trimRevision(deployment.from_revision) + '>', short: true }
            ]
          }
        ]
      });
    });
  });
};
