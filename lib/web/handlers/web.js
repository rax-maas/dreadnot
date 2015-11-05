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

var sprintf = require('../../util/sprintf');
var misc = require('../../util/misc');
var errors = require('../../errors');

var viewHelpers = require('../view_helpers');

var api = require('./api');


exports.getWebHandlers = function(dreadnot, authdb) {
  // Utility function for rendering responses
  function render(req, res, template, data, options) {
    res.render(template, misc.merge({
      user: req.remoteUser,
      title: dreadnot.config.name,
      env: dreadnot.config.env,
      url: req.originalUrl,
      emsg: res.emsg,
      wmsg: dreadnot.warning,
      helpers: viewHelpers,
      data: data
    }, options || {}));
  }

  // Render an error page
  function handleError(req, res, err) {
    switch (err.name) {
      case 'NotFoundError':
        render(req, res, 'error', err, {status: 404});
        break;
      default:
        render(req, res, 'error', err, {status: 500});
    }
  }

  // Build a callback that renders on success or errors on failure
  function renderCallback(req, res, template) {
    return function(err, data) {
      if (err) {
        handleError(req, res, err);
      } else {
        render(req, res, template, data);
      }
    };
  }

  // Render the Login page
  function getLogin(req, res) {
    var next = req.param('next');
    render(req, res, 'login.jade', {next: next});
  }

  // Handle Login attempts, redirect on success, render Login with error on failure
  function attemptLogin(req, res) {
    var username = req.param('username'),
        password = req.param('password'),
        next = req.param('next', '/');

    authdb.validate(username, password, function(err, valid) {
      if (valid) {
        req.session.authed = true;
        req.session.username = username;
        res.redirect(next);
      } else {
        res.emsg = 'Invalid Username or Password';
        render(req, res, 'login.jade', {next: next});
      }
    });
  }

  // Handle logout attempts
  function logout(req, res) {
    req.session.destroy();
    res.redirect('/');
  }

  // Render the main overview page
  function getStacks(req, res) {
    var data = {};
    async.auto({
      stacks: function(callback) {
        dreadnot.getStackSummaries(function(err, stacks) {
          data.stacks = stacks;
          callback(err);
        });
      },

      regions: ['stacks', function(callback) {
        async.forEach(data.stacks, function(stack, callback) {
          dreadnot.getRegionSummaries(stack.name, function(err, regions) {
            if (err) {
              callback(err);
              return;
            }

            stack.regions = regions;
            async.forEach(stack.regions, function(region, callback) {
              // TODO: Should this go in dreadnot.js or stack.js maybe?
              if (region.latest_deployment === '0') {
                region.latest_deployment = null;
                callback();
                return;
              }
              dreadnot.getDeploymentSummary(stack.name, region.name, region.latest_deployment, function(err, deployment) {
                region.latest_deployment = deployment;
                callback(err);
              });
            }, callback);
          });
        }, callback);
      }],
    }, function(err) {
      renderCallback(req, res, 'stacks.jade')(err, data);
    });
  }

  // Render a region view with a list of deployments
  function getDeployments(req, res) {
    async.parallel({
      stack: dreadnot.getStackSummary.bind(dreadnot, req.params.stack),
      region: dreadnot.getRegionSummary.bind(dreadnot, req.params.stack, req.params.region),
      deployments: dreadnot.getDeploymentSummaries.bind(dreadnot, req.params.stack, req.params.region)
    }, renderCallback(req, res, 'deployments.jade'));
  }

  // Render a view of a single deployment with the log
  function getDeployment(req, res) {
    async.parallel({
      stack: dreadnot.getStackSummary.bind(dreadnot, req.params.stack),
      region: dreadnot.getRegionSummary.bind(dreadnot, req.params.stack, req.params.region),
      deployment: dreadnot.getDeploymentSummary.bind(dreadnot, req.params.stack, req.params.region, req.params.deployment)
    }, renderCallback(req, res, 'deployment.jade'));
  }

  function getDeploymentLog(req, res) {
    var stackName = req.params.stack,
        regionName = req.params.region,
        deploymentNumber = req.params.deployment,
        fromIdx = req.param('from', 0),
        entries = [];

    dreadnot.getDeploymentLog(stackName, regionName, deploymentNumber, {fromIdx: fromIdx, stream: false}, function(err, depLog) {
      if (err) {
        res.respond(err);
        return;
      }

      res.writeHead('200', {'content-type': 'application/json'});

      depLog.on('data', function(item) {
        entries.push(item);
      });

      depLog.on('end', function(success) {
        entries.push(success);
        res.end(JSON.stringify(entries));
      });

      depLog.on('segment', function() {
        res.end(JSON.stringify(entries));
      });
    });
  }

  // Handle attempted deployments. Redirect to the deployment on success. On
  // stack locked errors, redirect to the region view, otherwise a full error
  // view.
  function deploy(req, res) {
    var stackName = req.params.stack,
        regionName = req.params.region,
        to = req.body.to_revision, user;

    dreadnot.deploy(stackName, regionName, to, req.remoteUser.name, function(err, number) {
      if (err) {
        res.respond(err);
        return;
      } else {
        res.redirect(sprintf('/stacks/%s/regions/%s/deployments/%s', stackName, regionName, number));
      }
    });
  }

  // Render the warning editing view
  function getWarning(req, res) {
    render(req, res, 'warning.jade', {});
  }

  // Store the warning message
  function saveWarning(req, res) {
    var text = req.body.action === 'save' ? req.body.warning_text : '';

    dreadnot.setWarning(req.remoteUser, text, function(err) {
      if (err) {
        res.emsg = err.message;
      }
      getWarning(req, res);
    });
  }

  // Return bound handlers
  return {
    getLogin: getLogin,
    attemptLogin: attemptLogin,
    logout: logout,
    getStacks: getStacks,
    getDeployments: getDeployments,
    getDeployment: getDeployment,
    getDeploymentLog: getDeploymentLog,
    deploy: deploy,
    getWarning: getWarning,
    saveWarning: saveWarning,
    handleError: handleError
  };
};
