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

var errors = require('./errors');
var Stack = require('./stack').Stack;



function Dreadnot(config, stackdir) {
  log.info('using config', config);
  this.config = config;
  this.stackdir = stackdir;
  this._stacks = {};
  this.emitter = new events.EventEmitter();
}


Dreadnot.prototype._getStack = function(name) {
  if (!this._stacks[name]) {
    this._stacks[name] = new Stack(name, this, this.config);
  }

  return this._stacks[name];
};


Dreadnot.prototype.emit = function(id, data) {
  this.emitter.emit(id, data);
};


Dreadnot.prototype.getStack = function(name, callback) {
  var stack = this._stacks[name];
  if (!stack) {
    callback(new errors.NotFoundError('Stack not found'));
  } else {
    callback(null, stack);
  }
};


Dreadnot.prototype.init = function(callback) {
  var self = this,
      stackNames = Object.keys(this.config.stacks);

  async.forEach(stackNames, function(stackName, callback) {
    self._getStack(stackName).init(callback);
  }, callback);
};


Dreadnot.prototype.getName = function() {
  return this.config.name;
};


Dreadnot.prototype.getSummary = function(callback) {
  callback(null, {name: this.config.env});
};


Dreadnot.prototype.getDetails = function(callback) {
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


Dreadnot.prototype.runningStatus = function(callback) {
  var self = this,
      stackNames = Object.keys(this.config.stacks);

  async.map(stackNames, function(stackName, callback) {
    self._getStack(stackName).runningStatus(callback);
  }, callback);
};


exports.Dreadnot = Dreadnot;
