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
  function streamLog(socket, details) {
    var depPath = ['stacks', details.stack, 'regions', details.region, 'deployments', details.deployment].join('.');
    dreadnot.getStack(details.stack, function(err, stack) {
      if (err) {
        return;
      }

      stack.getDeploymentLog(details.region, details.deployment, function(err, depLog) {
        if (err) {
          return;
        }

        depLog.on('data', function(data) {
          socket.emit([depPath, 'log'].join('.'), data);
        });

        depLog.on('end', function(success) {
          socket.emit([depPath, 'end'].join('.'), success);
        });
      });
    });
  }

  function handleConnection(socket) {
    socket.on('request log', streamLog.bind(null, socket));
  }

  return {
    handleConnection: handleConnection
  };
};
