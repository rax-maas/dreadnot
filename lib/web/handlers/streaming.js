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


exports.getStreamingHandlers = function(dreadnot) {
  function streamLog(socket, log) {
    async.waterfall([
      dreadnot.getStack.bind(dreadnot, log.stack),

      function(stack, callback) {
        stack.getDeploymentDetails(log.region, log.deployment, callback);
      },

      function(summary, callback) {
        var logPath = ['stacks', log.stack, 'regions', log.region, 'deployments', log.deployment, 'log'].join('.'),
            endPath = ['stacks', log.stack, 'regions', log.region, 'deployments', log.deployment, 'end'].join('.'),
            emit = socket.emit.bind(socket, logPath);

        summary.log.forEach(emit);

        if (!summary.finished) {
          dreadnot.emitter.on(logPath, emit);
          dreadnot.emitter.once(endPath, function(success) {
            dreadnot.emitter.removeListener(logPath, emit);
            socket.emit(endPath, success);
          });
        } else {
          socket.emit(endPath, summary.success);
        }
      }
    ]);
  }

  function handleConnection(socket) {
    socket.on('request log', streamLog.bind(null, socket));
  }

  return {
    handleConnection: handleConnection
  };
};
