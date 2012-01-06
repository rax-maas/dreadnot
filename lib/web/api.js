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

exports.getAPIHandlers = function(dreadnot) {
  // Utility for handling errors
  function handleError(err, req, res) {
    switch (err.name) {
      case 'NotFoundError':
        res.send(err, 404);
        break;
      default:
        res.send(err, 500);
    }
  }

  // Utilty to build response callbacks
  function responseCallback(req, res) {
    return function(err, data) {
      if (err) {
        handleError(err, req, res);
      } else {
        res.send(data);
      }
    };
  }

  function getStatus(req, res) {
    dreadnot.runningStatus(responseCallback(req, res));
  }

  return {
    getStatus: getStatus
  };
};
