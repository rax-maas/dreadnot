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
  function getDreadnot(req, res) {
    dreadnot.getSummary(res.respond);
  }

  function getStacks(req, res) {
    dreadnot.getStacks(function(err, stacks) {
      if (err) {
        res.respond(err);
      } else {
        async.map(stacks, function(stack, callback) {
          stack.getSummary(callback);
        }, res.respond);
      }
    });
  }

  function getStack(req, res) {
    dreadnot.getStack(req.params.stack, function(err, stack) {
      if (err) {
        res.respond(err);
      } else {
        stack.getSummary(res.respond);
      }
    });
  }

  function getRegions(req, res) {
    async.waterfall([
      function(callback) {
        dreadnot.getStack(req.params.stack, callback);
      },

      function(stack, callback) {
        stack.getRegionSummaries(callback);
      }
    ], res.respond);
  }

  function getRegion(req, res) {
    async.waterfall([
      function(callback) {
        dreadnot.getStack(req.params.stack, callback);
      },

      function(stack, callback) {
        stack.getRegionSummary(req.params.region, callback);
      }
    ], res.respond);
  }

  // Render a region view with a list of deployments
  function getDeployments(req, res) {
    var stackName = req.params.stack,
        regionName = req.params.region;

    async.waterfall([
      dreadnot.getStack.bind(dreadnot, stackName),

      function(stack, callback) {
        stack.getDeploymentSummaries(regionName, callback);
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
        stack.getDeploymentSummary(regionName, deploymentNumber, callback);
      }
    ], res.respond);
  }

  function getDeploymentLog(req, res) {
    var stackName = req.params.stack,
        regionName = req.params.region,
        deploymentNumber = req.params.deployment;

    dreadnot.getStack(stackName, function(err, stack) {
      if (err) {
        res.respond(err);
        return;
      }

      stack.getDeploymentLog(regionName, deploymentNumber, function(err, depLog) {
        if (err) {
          res.respond(err);
          return;
        }

        res.header('Transfer-Encoding', 'chunked');
        res.setHeader('Content-Type', 'application/json');
        depLog.on('data', function(item) {
          res.write(JSON.stringify(item) + '\n');
        });
        depLog.on('end', function(success) {
          res.end();
        });
      });
    });
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
        stack.getDeploymentSummary(regionName, number, callback);
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
    getDreadnot: getDreadnot,

    getStacks: getStacks,
    getStack: getStack,

    getRegions: getRegions,
    getRegion: getRegion,

    getDeployments: getDeployments,
    getDeployment: getDeployment,

    getDeploymentLog: getDeploymentLog,

    deploy: deploy,

    getWarning: getWarning,
    saveWarning: saveWarning
  };
};
