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

var events = require('events');
var util = require('util');
var path = require('path');

var async = require('async');
var log = require('logmagic').local('dreadnot');

var sprintf = require('./util/sprintf');

var Stack = require('./stack').Stack;

function NotFoundError(message) {
  this.name = 'NotFoundError';
  this.message = message;
  Error.captureStackTrace(this, NotFoundError);
};

util.inherits(NotFoundError, Error);



function Deployinator(config, stackdir) {
  log.info('using config', config);
  this.config = config;
  this.stackdir = stackdir;
  this._stacks = {};
  this.emitter = new events.EventEmitter();
}


Deployinator.prototype._getStack = function(name) {
  if (!this._stacks[name]) {
    this._stacks[name] = new Stack(name, this, this.config);
  }

  return this._stacks[name];
};


Deployinator.prototype.emit = function(id, data) {
  this.emitter.emit(id, data);
};


Deployinator.prototype.getStack = function(name, callback) {
  var stack = this._stacks[name];
  if (!stack) {
    callback(new NotFoundError('Stack not found'));
  } else {
    callback(null, stack);
  }
};


Deployinator.prototype.init = function(callback) {
  var self = this,
      stackNames = Object.keys(this.config.stacks);

  async.forEach(stackNames, function(stackName, callback) {
    self._getStack(stackName).init(callback);
  }, callback);
};


Deployinator.prototype.getName = function() {
  return this.config.name;
};


Deployinator.prototype.getSummary = function(callback) {
  callback(null, {name: this.config.env});
};


Deployinator.prototype.getDetails = function(callback) {
  var self = this,
      stackNames = Object.keys(this.config.stacks);

  async.map(stackNames, function(stackName, callback) {
    self._getStack(stackName).getDetails(callback);
  },

  function(err, summaries) {
    callback(err, {
      name: self.config.env,
      stacks: summaries
    });
  });
};


Deployinator.prototype.runningStatus = function(callback) {
  var self = this,
      stackNames = Object.keys(this.config.stacks);

  async.map(stackNames, function(stackName, callback) {
    self._getStack(stackName).runningStatus(callback);
  }, callback);
};


exports.Deployinator = Deployinator;
