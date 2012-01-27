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


exports.getAPIHandlers = function(dreadnot, authdb) {
  // Render the main overview page
  function getStacks(req, res) {
    dreadnot.getDetails(res.respond);
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
    ], res.respond);
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
    ], res.respond);
  }

  // Handle attempted deployments. Redirect to the deployment on success. On
  // stack locked errors, redirect to the region view, otherwise a full error
  // view.
  function deploy(req, res) {
    var stackName = req.params.stack,
        regionName = req.params.region,
        to = req.body.to_revision, user;

    async.waterfall([
      dreadnot.getStack.bind(dreadnot, stackName),

      function(stack, callback) {
        stack.run('deploy', regionName, to, req.remoteUser.name, function(err, number) {
          callback(err, stack, number);
        });
      },

      function(stack, number, callback) {
        stack.getDeploymentDetails(regionName, number, callback);
      }
    ], res.respond);
  }

  function getWarning(req, res) {
    res.respond(null, {message: dreadnot.warning});
  }

  // Store the warning message
  function saveWarning(req, res) {
    var text = req.body.action === 'save' ? req.body.warning_text : '';

    dreadnot.setWarning(text, function(err) {
      if (err) {
        res.respond(err);
      } else {
        getWarning(req, res);
      }
    });
  }

  // Return bound handlers
  return {
    getStacks: getStacks,
    getDeployments: getDeployments,
    getDeployment: getDeployment,
    deploy: deploy,
    getWarning: getWarning,
    saveWarning: saveWarning
  };
};
