/*
 *  Copyright 2012 Rackspace
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


/**
 * Default number of retries.
 * @type {Number}
 * @const
 */
var DEFAULT_FLOW_MAX_RETRIES = 3;


/**
 * Wrap a function so that the original function will only be called once,
 * regardless of how  many times the wrapper is called.
 * @param {Function} fn The to wrap.
 * @return {Function} A function which will call fn the first time it is called.
 */
exports.fireOnce = function(fn) {
  var fired = false;
  return function wrapped() {
    if (!fired) {
      fired = true;
      fn.apply(null, arguments);
    }
  };
};


/**
 * Wraps a callback and only passes args to it if err is null / undefined.
 *
 * @param {Function} callback Callback to wrap.
 * @param {Array} args Arguments which are passed to callback if !err.
 * @param {Bool} includeExtra true to include arguments which are passed to the
 * callback after err.
 * @return {Function} Wrapped callback.
 */
exports.wrapCallback = function(callback, args, includeExtra) {
  includeExtra = includeExtra || false;
  return function(err) {
    var callbackArgs = [null], i = 1, len = arguments.length;
    if (err) {
      callback(err);
      return;
    }

    callbackArgs = callbackArgs.concat(args);

    if (includeExtra) {
      while (i < len) {
        callbackArgs.push(arguments[i]);
        i++;
      }
    }

    callback.apply(null, callbackArgs);
  };
};


/**
 * Calls a function and retries if a callback gets passed an error.
 *
 * @param {Function} func Function to call. This function must take callback as
 * the last argument.
 * @param {Object} scope Scope in which function is called.
 * @param {Array} args Arguments with which the function should be called.
 * @param {Object} options Function options (max_retries, ...).
 * @param {Function} callback A callback called with (err).
 */
exports.retryOnError = function(func, scope, args, options, callback) {
  args = args || [];
  options = options || {};
  scope = scope || null;
  var retries = 0, done = false, funcErr = null,
      maxRetries = (options.max_retries || DEFAULT_FLOW_MAX_RETRIES) + 1;

  async.whilst(function test() {
    return (retries < maxRetries) && !done;
  },

  function runTask(callback) {
    var funcArgs;
    function wrappedCallback(err) {
      if (!err) {
        done = true;
      }

      funcErr = err;
      callback();
    }

    funcArgs = args.concat(wrappedCallback);

    retries++;
    try {
      func.apply(scope, funcArgs);
    } catch (err) {
      callback();
      return;
    }
  },

  function onEnd(err) {
    callback(funcErr);
  });
};
