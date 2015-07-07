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

var Slack = require('node-slackr');

var helpers = require('web/view_helpers');
var log = require('logmagic').local('plugins.slack');
var sprintf = require('util/sprintf');

exports.run = function(dreadnot) {
  var config = dreadnot.config.plugins.slack,
      slack = new Slack(config.webhook_url, {
        channel: config.rooms,
        username: config.name,
        icon_url: config.icon,
        icon_emoji: config.icon_emoji
      });

  log.info('loaded slack notification plugin');


  function logNotification(err, result) {
    log.info('notifying slack channels', { channels: config.rooms });

    if (err) {
      log.error('slack error', { error: err, result: result });
    }
  }


  dreadnot.emitter.on('deployments', function(deployment) {
    var link = sprintf('%s/stacks/%s/regions/%s/deployments/%s',
                       dreadnot.config.default_url,
                       deployment.stack,
                       deployment.region,
                       deployment.deployment),

        fallback = sprintf('%s is deploying %s to %s:%s - %s',
                           deployment.user,
                           deployment.stack,
                           dreadnot.config.env,
                           deployment.region,
                           link),

        pretext = sprintf('Deployment <%s|#%s> of %s to %s:%s by %s',
                          link, deployment.deployment,
                          deployment.stack, dreadnot.config.env,
                          deployment.region, deployment.user),

        from_to = sprintf('%s → %s',
                          helpers.trimRevision(deployment.from_revision),
                          helpers.trimRevision(deployment.to_revision)),

        diff_url = helpers.ghDiffUrl(deployment.github_href,
                                     deployment.from_revision,
                                     deployment.to_revision),

        endPath = ['stacks', deployment.stack,
                   'regions', deployment.region,
                   'deployments', deployment.deployment,
                   'end'
                  ].join('.');

    var message = {
      attachments: [
        { fallback: fallback,
          pretext: pretext,
          title: from_to,
          title_link: diff_url
        }
      ]
    };

    slack.notify(message, logNotification);

    dreadnot.emitter.once(endPath, function(success) {
      var endMsg = sprintf('deployment #%s of %s to %s:%s %s',
                           deployment.deployment,
                           deployment.stack,
                           dreadnot.config.env,
                           deployment.region,
                           success ? 'SUCCEEDED' : 'FAILED'),

          message = {
            attachments: [{
              fallback: endMsg,
              pretext: pretext,
              title: success ? 'SUCCEEDED' : 'FAILED',
              color: success ? 'good' : 'danger'
            }]
          };

      slack.notify(message, logNotification);
    });
  });


  dreadnot.emitter.on('warning.set', function(warn) {
    var fallback = sprintf('Warning has been set to "%s" by %s',
                           warn.text, warn.username);

    var message = {
      attachments: [{
        fallback: fallback,
        pretext: 'Warning set:',
        author_name: warn.username,
        text: warn.text,
        color: 'warning'
      }]
    };

    slack.notify(message, logNotification);
  });


  dreadnot.emitter.on('warning.removed', function(warn) {
    var fallback = sprintf('Warning "%s" has been removed by %s',
                           warn.text, warn.username);

    var message = {
      attachments: [{
        fallback: fallback,
        pretext: 'Warning removed:',
        author_name: warn.username,
        text: warn.text,
      }]
    };

    slack.notify(message, logNotification);
  });
};
