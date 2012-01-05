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

var sprintf = require('../util/sprintf');
var misc = require('../util/misc');
var errors = require('../errors');

var viewHelpers = require('./view_helpers');


exports.getWebHandlers = function(dreadnot, authdb) {

  // Utility function for rendering responses
  function render(res, template, data, options) {
    res.render(template, misc.merge({
      user: res.req.user,
      title: dreadnot.getName(),
      url: res.req.originalUrl,
      emsg: res.emsg,
      wmsg: dreadnot.warning,
      helpers: viewHelpers,
      data: data
    }, options || {}));
  }

  // Build a callback that renders on success or errors on failure
  function renderCallback(res, next, template) {
    return function(err, data) {
      if (err) {
        next(err);
      } else {
        render(res, template, data);
      }
    };
  }

  // Render the Login page
  function getLogin(req, res, next) {
    var redirectTo = req.param('next');
    render(res, 'login.jade', {next: redirectTo});
  }

  // Handle Login attempts, redirect on success, render Login with error on failure
  function attemptLogin(req, res, next) {
    var username = req.param('username'),
        password = req.param('password'),
        redirectTo = req.param('next', '/');

    authdb.validate(username, password, function(err, valid) {
      if (valid) {
        req.session.authed = true;
        req.session.username = username;
        res.redirect(redirectTo);
      } else {
        res.emsg = 'Invalid Username or Password';
        render(res, 'login.jade', {next: redirectTo});
      }
    });
  }

  // Handle logout attempts
  function logout(req, res, next) {
    req.session.destroy();
    res.redirect('/');
  }

  // Render the main overview page
  function getStacks(req, res, next) {
    dreadnot.getDetails(renderCallback(res, next, 'stacks.jade'));
  }

  // Render a region view with a list of deployments
  function getDeployments(req, res, next) {
    var stackName = req.params.stack,
        regionName = req.params.region;

    async.waterfall([
      dreadnot.getStack.bind(dreadnot, stackName),

      function(stack, callback) {
        stack.getRegionDetails(regionName, 0, callback);
      }
    ], renderCallback(res, next, 'deployments.jade'));
  }

  // Render a view of a single deployment with the log
  function getDeployment(req, res, next) {
    var stackName = req.params.stack,
        regionName = req.params.region,
        deploymentNumber = req.params.deployment;

    async.waterfall([
      dreadnot.getStack.bind(dreadnot, stackName),

      function(stack, callback) {
        stack.getDeploymentDetails(regionName, deploymentNumber, callback);
      }
    ], renderCallback(res, next, 'deployment.jade'));
  }

  // Handle attempted deployments. Redirect to the deployment on success. On
  // stack locked errors, redirect to the region view, otherwise a full error
  // view.
  function deploy(req, res, next) {
    var stackName = req.params.stack,
        regionName = req.params.region,
        to = req.body.to_revision;

    async.waterfall([
      dreadnot.getStack.bind(dreadnot, stackName),

      function(stack, callback) {
        stack.run('deploy', regionName, to, req.user.name, callback);
      }
    ],

    function(err, number) {
      if (err) {
        if (err instanceof errors.StackLockedError) {
          res.emsg = err.message;
          getDeployments(req, res, next);
        } else {
          next(err);
        }
      } else {
        res.redirect(sprintf('/stacks/%s/regions/%s/deployments/%s', stackName, regionName, number));
      }
    });
  }

  // Render the warning editing view
  function getWarning(req, res, next) {
    render(res, 'warning.jade', {});
  }

  // Store the warning message
  function saveWarning(req, res, next) {
    var text = req.body.action === 'save' ? req.body.warning_text : '';

    dreadnot.setWarning(text, function(err) {
      if (err) {
        res.emsg = err.message;
      }
      getWarning(req, res, next);
    });
  }

  // Render an error page
  function handleError(err, req, res, next) {
    switch (err.name) {
      case 'NotFoundError':
        render(res, 'error', err, {status: 404});
        break;
      default:
        render(res, 'error', err, {status: 500});
    }
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


function StreamingHandlers(dreadnot) {
  this._dreadnot = dreadnot;
}


StreamingHandlers.prototype.handleConnection = function(socket) {
  socket.on('request log', this.streamLog.bind(this, socket));
};


StreamingHandlers.prototype.streamLog = function(socket, log) {
  var self = this;

  async.waterfall([
    self._dreadnot.getStack.bind(self._dreadnot, log.stack),

    function(stack, callback) {
      stack.getDeploymentSummary(log.region, log.deployment, callback);
    },

    function(summary, callback) {
      var logPath = ['stacks', log.stack, 'regions', log.region, 'deployments', log.deployment, 'log'].join('.'),
          endPath = ['stacks', log.stack, 'regions', log.region, 'deployments', log.deployment, 'end'].join('.'),
          emit = socket.emit.bind(socket, logPath);

      summary.log.forEach(emit);

      if (!summary.finished) {
        self._dreadnot.emitter.on(logPath, emit);
        self._dreadnot.emitter.once(endPath, function(success) {
          self._dreadnot.emitter.removeListener(logPath, emit);
          socket.emit(endPath, success);
        });
      } else {
        socket.emit(endPath, summary.success);
      }
    }
  ]);
};


exports.StreamingHandlers = StreamingHandlers;
