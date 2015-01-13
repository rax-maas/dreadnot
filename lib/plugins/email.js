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

var async = require('async'),
    email = require('emailjs'),
    log = require('logmagic').local('plugins.email'),

    helpers = require('web/view_helpers'),
    sprintf = require('sprintf-js').sprintf;

var BEG_SUBJ_FMT = 'Deployment #%s of %s to %s:%s started';
var BEG_TEXT_FMT = [
  'user: %s',
  'started: %s',
  'revisions: %s -> %s',
  'diff link: %s'
];

var END_SUBJ_FMT = 'Deployment #%s of %s to %s:%s: %s';
var END_TEXT_FMT = [
  'user: %s',
  'started: %s',
  'revisions: %s -> %s',
  'diff link: %s',
  'log:',
  '',
  '%s'
];


exports.run = function(dreadnot) {
  var config = dreadnot.config.plugins.email;

  dreadnot.emitter.on('deployments', function(deployment) {
    var endPath = ['stacks', deployment.stack, 'regions', deployment.region, 'deployments', deployment.deployment, 'end'].join('.'),
        logPath = ['stacks', deployment.stack, 'regions', deployment.region, 'deployments', deployment.deployment, 'log'].join('.'),
        logEvents = [],
        server, message;

    server = email.server.connect(config.server);

    message = email.message.create({
      to: config.to,
      from: config.from,
      subject: sprintf(BEG_SUBJ_FMT, deployment.deployment, deployment.stack, dreadnot.config.env, deployment.region),
      text: sprintf(BEG_TEXT_FMT.join('\n'),
                    deployment.user,
                    new Date(deployment.time).toUTCString(),
                    helpers.trimRevision(deployment.from_revision), helpers.trimRevision(deployment.to_revision),
                    helpers.ghDiffUrl(deployment.github_href, deployment.from_revision, deployment.to_revision))
    });

    server.send(message, function(err) {
      if (err) {
        log.error('error sending deployment email', {
          deployment: deployment,
          err: err
        });
      }
    });

    dreadnot.emitter.on(logPath, function(logEvent) {
      logEvents.push(logEvent);
    });

    dreadnot.emitter.once(endPath, function(success) {
      var endMessage = email.message.create({
        to: config.to,
        from: config.from,
        subject: sprintf(END_SUBJ_FMT, deployment.deployment, deployment.stack, dreadnot.config.env, deployment.region,
                          success ? 'SUCCESS': 'FAILURE'),
        text: sprintf(END_TEXT_FMT.join('\n'),
                      deployment.user,
                      new Date(deployment.time).toUTCString(),
                      helpers.trimRevision(deployment.from_revision), helpers.trimRevision(deployment.to_revision),
                      helpers.ghDiffUrl(deployment.github_href, deployment.from_revision, deployment.to_revision),
                      logEvents.map(function(logEvent) {
                        return logEvent.msg;
                      }).join('\n'))
      });

      server.send(endMessage, function(err) {
        log.error('error sending deployment end email', {
          deployment: deployment,
          success: success,
          err: err
        });
      });
    });
  });
};
