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


exports.getWebHandlers = function(dreadnot, authdb) {
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

  // Utility function for rendering responses
  function render(req, res, template, data, options) {
    res.render(template, misc.merge({
      user: req.remoteUser,
      title: dreadnot.getName(),
      url: req.originalUrl,
      emsg: res.emsg,
      wmsg: dreadnot.warning,
      helpers: viewHelpers,
      data: data
    }, options || {}));
  }

  // Build a callback that renders on success or errors on failure
  function renderCallback(req, res, template) {
    return function(err, data) {
      if (err) {
        handleError(req, res, err)
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
    dreadnot.getDetails(renderCallback(req, res, 'stacks.jade'));
  }

  // Render a region view with a list of deployments
  function getDeployments(req, res) {
    var stackName = req.params.stack,
        regionName = req.params.region;

    async.waterfall([
      dreadnot.getStack.bind(dreadnot, stackName),

      function(stack, callback) {
        stack.getRegionDetails(regionName, 0, callback);
      }
    ], renderCallback(req, res, 'deployments.jade'));
  }

  // Render a view of a single deployment with the log
  function getDeployment(req, res) {
    var stackName = req.params.stack,
        regionName = req.params.region,
        deploymentNumber = req.params.deployment;

    async.waterfall([
      dreadnot.getStack.bind(dreadnot, stackName),

      function(stack, callback) {
        stack.getDeploymentDetails(regionName, deploymentNumber, callback);
      }
    ], renderCallback(req, res, 'deployment.jade'));
  }

  // Handle attempted deployments. Redirect to the deployment on success. On
  // stack locked errors, redirect to the region view, otherwise a full error
  // view.
  function deploy(req, res) {
    var stackName = req.params.stack,
        regionName = req.params.region,
        to = req.body.to_revision;

    async.waterfall([
      dreadnot.getStack.bind(dreadnot, stackName),

      function(stack, callback) {
        stack.run('deploy', regionName, to, req.remoteUser.name, callback);
      }
    ],

    function(err, number) {
      if (err) {
        if (err instanceof errors.StackLockedError) {
          res.emsg = err.message;
          getDeployments(req, res);
        } else {
          handleError(req, res, err);
        }
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

    dreadnot.setWarning(text, function(err) {
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
    deploy: deploy,
    getWarning: getWarning,
    saveWarning: saveWarning,
    handleError: handleError
  };
};
