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

var auth = require('./auth');
var viewHelpers = require('./view_helpers');


function WebHandlers(dreadnot) {
  this._dreadnot = dreadnot;
  this._authdb = auth.loadDBFromFile(dreadnot.config.htpasswd_file);
}



WebHandlers.prototype._render = function(res, template, data, options) {
  res.render(template, misc.merge({
    user: res.req.user,
    title: this._dreadnot.getName(),
    url: res.req.originalUrl,
    emsg: res.emsg,
    helpers: viewHelpers,
    data: data
  }, options || {}));
};


WebHandlers.prototype.renderCallback = function(res, next, template) {
  var self = this;

  return function(err, data) {
    if (err) {
      next(err);
    } else {
      self._render(res, template, data);
    }
  };
};


WebHandlers.prototype.getStacks = function(req, res, next) {
  this._dreadnot.getDetails(this.renderCallback(res, next, 'stacks.jade'));
};


WebHandlers.prototype.getLogin = function(req, res, next) {
  var redirectTo = req.param('next');
  this.renderCallback(res, next, 'login.jade')(null, {next: redirectTo});
};


WebHandlers.prototype.attemptLogin = function(req, res, next) {
  var self = this,
      username = req.param('username'),
      password = req.param('password'),
      redirectTo = req.param('next', '/');

  this._authdb.validate(username, password, function(err, valid) {
    if (valid) {
      req.session.authed = true;
      req.session.username = username;
      res.redirect(redirectTo);
    } else {
      res.emsg = 'Invalid Username or Password';
      self.renderCallback(res, next, 'login.jade')(null, {next: redirectTo});
    }
  });
};


WebHandlers.prototype.logout = function(req, res, next) {
  req.session.destroy();
  res.redirect('/');
};


WebHandlers.prototype.getDeployments = function(req, res, next) {
  var self = this,
      stackName = req.params.stack,
      regionName = req.params.region;

  async.waterfall([
    self._dreadnot.getStack.bind(self._dreadnot, stackName),

    function(stack, callback) {
      stack.getRegionDetails(regionName, 0, callback);
    }
  ], this.renderCallback(res, next, 'deployments.jade'));
};


WebHandlers.prototype.getDeployment = function(req, res, next) {
  var self = this,
      stackName = req.params.stack,
      regionName = req.params.region,
      deploymentNumber = req.params.deployment;

  async.waterfall([
    self._dreadnot.getStack.bind(self._dreadnot, stackName),

    function(stack, callback) {
      stack.getDeploymentDetails(regionName, deploymentNumber, callback);
    }
  ], this.renderCallback(res, next, 'deployment.jade'));
};


WebHandlers.prototype.deploy = function(req, res, next) {
  var self = this,
      stackName = req.params.stack,
      regionName = req.params.region,
      to = req.body.to_revision;

  async.waterfall([
    self._dreadnot.getStack.bind(self._dreadnot, stackName),

    function(stack, callback) {
      stack.run('deploy', regionName, to, req.user.name, callback);
    }
  ],

  function(err, number) {
    if (err) {
      if (err instanceof errors.StackLockedError) {
        res.emsg = err.message;
        self.getDeployments(req, res, next);
      } else {
        next(err);
      }
    } else {
      res.redirect(sprintf('/stacks/%s/regions/%s/deployments/%s', stackName, regionName, number));
    }
  });
};


WebHandlers.prototype.handleError = function(err, req, res, next) {
  switch (err.name) {
    case 'NotFoundError':
      this._render(res, 'error', err, {status: 404});
      break;
    default:
      this._render(res, 'error', err, {status: 500});
  }
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


exports.WebHandlers = WebHandlers;
exports.StreamingHandlers = StreamingHandlers;
