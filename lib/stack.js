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
var fs = require('fs');
var path = require('path');

var async = require('async');
var logmagic = require('logmagic');
var mkdirp = require('mkdirp');

var misc = require('./util/misc');
var git = require('./util/git');
var sprintf = require('./util/sprintf');

var errors = require('./errors');

var DEFAULT_TARGETS = {
  'deploy': ['task_predeploy', 'task_deploy', 'task_postdeploy'],
  'finally': null
};


var PAGE_SIZE = 10;



/**
 * Stack Constructor.
 * @constructor
 * @param {String} name The name of this stack.
 * @param {Object} config The global config.
 */
function Stack(name, dreadnot, config) {
  var self = this,
      logName = sprintf('deploy.stack.%s', name),
      sinkName = sprintf('stack.%s', name),
      moduleName;

  if (config.stacks[name].hasOwnProperty('module_name')) {
    moduleName = config.stacks[name].module_name;
  }
  else {
    moduleName = name;
  }

  this.name = name;
  this.dreadnot = dreadnot;
  this.module = require(path.join(path.resolve(dreadnot.stackdir), moduleName));
  this.config = config;
  this.stackConfig = config.stacks[name];
  this.log = logmagic.local(logName);
  this.logRoot = path.join(config.data_root, 'logs', name);
  this.newestDeployments = {};
  this.current = null;
  this._cache = {};
  this._waiting = {};

  logmagic.registerSink(sinkName, function(moduleName, lvl, msg, obj) {
    var both = moduleName.split('.').slice(-2),
        logPath = ['regions', both[0], 'deployments', both[1], 'log'].join('.');

    // Fix serialization of Error objects
    if (obj.err && obj.err instanceof Error) {
      obj.err = {
        name: obj.err.name,
        message: obj.err.message,
        stack: obj.err.stack
      };
    }

    self.emit(logPath, {
      lvl: lvl,
      msg: msg,
      obj: obj
    });
  });
  logmagic.route(sprintf('%s.*', logName), logmagic.INFO, sinkName);
}


Stack.prototype.init = function(callback) {
  var self = this;

  async.forEach(this.stackConfig.regions, function(region, callback) {
    self.log.debug('ensuring region log directory', {
      stack: self.name,
      region: region
    });
    async.series([
      // 0755 = 493
      mkdirp.bind(null, path.join(self.logRoot, region), 493),

      function(callback) {
        self._findNewestRegionDeployment(region, function(err, number) {
          self.newestDeployments[region] = number;
          callback(err);
        });
      }
    ], callback);
  }, callback);
};


Stack.prototype.emit = function(id, data) {
  this.dreadnot.emit(sprintf('stacks.%s.%s', this.name, id), data);
};


Stack.prototype._getCached = function(name, ttl, getter, callback) {
  var self = this,
      now = Date.now(),
      both = this._cache[name];

  if (this._waiting[name] !== undefined) {
    // Cache is being refreshed, wait for it
    this._waiting[name].push(callback);
  } else if (!both || now > both[0]) {
    // Cache needs refresh
    this._waiting[name] = [callback];

    getter(function(err, val) {
      if (err) {
        delete self._cache[name];
        self._waiting[name].forEach(function(callback) {
          callback(err);
        });
      } else {
        self._cache[name] = [Date.now() + ttl, val];
        self._waiting[name].forEach(function(callback) {
          callback(null, val);
        });
      }
      delete self._waiting[name];
    });
  } else {
    // Cache is fresh
    callback(null, both[1]);
  }
};


Stack.prototype.getRepoUrl = function() {
  return this.stackConfig.git_url ||
      sprintf('git@github.com:%s/%s.git', this.config.github.organization, this.name);
};


Stack.prototype.getGitHubBaseUrl = function() {
  return this.stackConfig.github_base_url ||
      sprintf('https://github.com/%s/%s', this.config.github.organization, this.name);
};


Stack.prototype.getGitHubCommitUrl = function(rev) {
  return sprintf('%s/commit/%s', this.getGitHubBaseUrl(), rev);
};

Stack.prototype.getGitHubDiffUrl = function(revFrom, revTo) {
  return sprintf('%s/compare/%s...%s', this.getGitHubBaseUrl(), revFrom, revTo);
};


/**
 * Get all the Targets for the stack.
 * @return {Array} All the tasks for a given stack.
 */
Stack.prototype.getTarget = function(name) {
  return this.module.targets[name] || DEFAULT_TARGETS[name];
};


/**
 * Run a given target.
 * @param {String} name The target to run.
 * @param {String} region The region to deploy to.
 * @param {String} revision The revision to deploy.
 * @param {String} user The name of the user responsible.
 * @param {Function} finalCallback Completion callback(err).
 */
Stack.prototype.run = function(name, region, revision, user, finalCallback) {
  var self = this,
      target = self.getTarget(name),
      finallyTarget = self.getTarget('finally'),
      baton = {},
      args = {
        dryrun: this.stackConfig.dryrun,
        environment: this.config.env,
        region: region,
        revision: revision,
        user: user
      },
      lockNames, start, number, tasks, finallyTasks;

  if (this.newestDeployments[region] === undefined) {
    finalCallback(new errors.NotFoundError('Region not found'));
    return;
  }

  if (target === undefined) {
    finalCallback(new errors.NotFoundError('Target not found'));
    return;
  }

  async.waterfall([
        self.getRegionSummary.bind(self, region),

        function run(summary, callback) {
          var epath, current, err;

          if (self.current) {
            finalCallback(new errors.StackLockedError(self.current));
            return;
          }

          number = (self.newestDeployments[region] + 1).toString();
          start = Date.now();

          current = {
            name: number,
            stackName: self.name,
            region: region,
            environment: self.config.env,
            from_revision: summary.deployed_revision,
            to_revision: revision,
            time: start,
            user: user,
            finished: false,
            success: false,
            log: []
          };

          if ((err = self.dreadnot.lock(self._getLockNames(args), current)) !== null) {
            finalCallback(err);
            return;
          }

          self.newestDeployments[region]++;
          self.current = current;

          epath = ['stacks', self.name, 'regions', region, 'deployments', number, 'log'].join('.');

          function onLog(item) {
            self.current.log.push(item);
          }

          self.dreadnot.emitter.on(epath, onLog);

          self.dreadnot.emit('deployments', {
            user: user,
            stack: self.name,
            stackName: self.name,
            region: region,
            environment: self.config.env,
            deployment: number,
            from_revision: summary.deployed_revision,
            to_revision: revision,
            github_href: self.getGitHubBaseUrl(),
            time: start
          });

          baton.log = logmagic.local(sprintf('deploy.stack.%s.%s.%s', self.name, region, number));

          tasks = target.map(function(taskName) {
            return function(callback) {
              var startTime, endTime;

              baton.log.infof('executing task ${task}', {
                task: taskName
              });

              startTime = misc.getUnixTimestamp();
              self.module[taskName](self, baton, args, function onEnd(err) {
                var args = arguments, logObj;
                endTime = misc.getUnixTimestamp();

                logObj = {
                  task: taskName,
                  start_time: startTime,
                  end_time: endTime,
                  took: (endTime - startTime)
                };

                if (err) {
                  logObj.err = err;
                }

                baton.log.infof('task ${task} finished', logObj);

                callback.apply(self, args);
              });
            };
          });

          if (finallyTarget) {
            finallyTasks = finallyTarget.map(function(taskName) {
              return function(callback) {
                var startTime, endTime;

                baton.log.infof('executing task ${task}', {
                  task: taskName
                });

                startTime = misc.getUnixTimestamp();
                self.module[taskName](self, baton, args, function onEnd(err) {
                  var args = arguments, logObj;
                  endTime = misc.getUnixTimestamp();

                  logObj = {
                    task: taskName,
                    start_time: startTime,
                    end_time: endTime,
                    took: (endTime - startTime)
                  };

                  if (err) {
                    logObj.err = err;
                  }

                  baton.log.infof('task ${task} finished', logObj);

                  callback.apply(self, args);
                });
              };
            });
          }

          baton.log.infof('Starting deployment ${deployment} of target \'${target}\'', {
            deployment: number,
            target: name
          });

          async.series(tasks, function(err) {
            var seconds = (Date.now() - start) / 1000;

            if (finallyTasks) {
              if (err) {
                baton.log.errorf('Target \'${target}\' FAILED in ${seconds}s', {
                  target: name,
                  seconds: seconds,
                  err: err.toString()
                });
              }
              async.series(finallyTasks, function(_err) {
                var finallySeconds = (Date.now() - start) / 1000;

                if (_err) {
                  baton.log.errorf('Target \'${target}\' FAILED in ${seconds}s', {
                    target: 'finally',
                    seconds: seconds,
                    err: _err.toString()
                  });
                } else if (err) {
                  baton.log.errorf('Target \'finally\' SUCCESS in ${seconds}s, but target \'${target}\' FAILED', {
                    target: name,
                    seconds: finallySeconds,
                    err: err.toString()
                  });
                } else {
                  self.current.success = true;
                  baton.log.infof('Target \'${target}\' SUCCESS in ${seconds}s', {
                    target: name,
                    seconds: seconds
                  });
                }
                self.emit(['regions', region, 'deployments', number, 'end'].join('.'), self.current.success);

                self.dreadnot.emitter.removeListener(epath, onLog);
                self.current.finished = true;

                callback();
              });
            } else {
              if (err) {
                baton.log.errorf('Target \'${target}\' FAILED in ${seconds}s', {
                  target: name,
                  seconds: seconds,
                  err: err.toString()
                });
              } else {
                self.current.success = true;
                baton.log.infof('Target \'${target}\' SUCCESS in ${seconds}s', {
                  target: name,
                  seconds: seconds
                });
              }

              self.emit(['regions', region, 'deployments', number, 'end'].join('.'), self.current.success);

              self.dreadnot.emitter.removeListener(epath, onLog);
              self.current.finished = true;

              callback();
            }
          });

          // Don't return to the user until the summary is generated and the
          // deployment is started
          finalCallback(null, number);
        },

        function(callback) {
          var logPath = path.join(self.logRoot, region, sprintf('%s.json', number));
          fs.writeFile(logPath, JSON.stringify(self.current, null, 4), callback);
        }
      ],

      function(err) {
        self.current = null;
        self.dreadnot.unlock(self._getLockNames(args));
      });
};


/**
 * Retrieve the deployed version
 * @param {String} region The region to check.
 * @param {Function} callback A callback fired with (err, rev).
 */
Stack.prototype.getDeployedRevision = function(region, callback) {
  var args = {
    environment: this.config.env,
    region: region
  };
  this.module.get_deployedRevision.call(this, args, callback);
};


Stack.prototype.getSummary = function(callback) {
  var self = this, getter;

  if (this.module.get_latestRevision) {
    getter = this.module.get_latestRevision.bind(this, {environment: this.config.env});
  } else  {
    getter = git.getLatestRevision.bind(git, this.getRepoUrl(), this.stackConfig.tip);
  }

  this._getCached('latest_revision', this.stackConfig.tip_ttl, getter, function(err, rev) {
    callback(err, err ? null : {
      name: self.name,
      github_href: self.getGitHubBaseUrl(),
      latest_revision: rev
    });
  });
};


/**
 * Get the names of any named locks a stack specifies for the given arguments.
 * @param {Object} args The arguments to be used to name the locks.
 */
Stack.prototype._getLockNames = function(args) {
  var formats = this.stackConfig.named_locks || [];

  return formats.map(function(format) {
    return sprintf(format, args);
  });
};


/**
 * Find the newest deployment for a region.
 */
Stack.prototype._findNewestRegionDeployment = function(region, callback) {
  var logRoot = path.join(this.logRoot, region);

  fs.readdir(logRoot, function(err, files) {
    var i, max = 0;

    if (err) {
      callback(err);
    } else {
      for (i = 0; i < files.length; i++) {
        if (files[i].match(/^\d+\.json$/)) {
          max = Math.max(max, parseInt(files[i].split('.')[0], 10));
        }
      }
      callback(null, max);
    }
  });
};


Stack.prototype.getRegionSummary = function(region, callback) {
  var self = this;

  if (self.newestDeployments[region] === undefined) {
    callback(new errors.NotFoundError('Region not found'));
    return;
  }

  self.getDeployedRevision(region, function(err, revision) {
    callback(err, err ? null : {
      name: region,
      deployed_revision: revision,
      latest_deployment: self.newestDeployments[region].toString() || null
    });
  });
};


Stack.prototype.getRegionSummaries = function(callback) {
  var self = this;

  async.map(this.stackConfig.regions, function(region, callback) {
    self.getRegionSummary(region, callback);
  }, callback);
};


Stack.prototype._getDeploymentSummary = function(region, number, callback) {
  var self = this,
      summary = {},
      k;

  if (this.newestDeployments[region] === undefined) {
    callback(new errors.NotFoundError('Region not found'));
    return;
  }

  if (number > this.newestDeployments[region]) {
    callback(new errors.NotFoundError('Deployment not found'));
    return;
  }

  if (this.current && this.current.region === region && this.current.name === number) {
    for (k in this.current) {
      if (this.current.hasOwnProperty(k)) {
        summary[k] = this.current[k];
      }
    }
    callback(null, summary);
  } else {
    fs.readFile(path.join(this.logRoot, region, sprintf('%s.json', number)), 'utf8', function(err, data) {
      if (err) {
        callback(err);
        return;
      }

      try {
        summary = JSON.parse(data);
      } catch (e) {
        callback(e);
        return;
      }

      callback(null, summary);
    });
  }
};


Stack.prototype.getDeploymentSummary = function(region, number, callback) {
  this._getDeploymentSummary(region, number, function(err, summary) {
    if (summary) {
      delete summary.log;
    }
    callback(err, summary);
  });
};


Stack.prototype.getDeploymentSummaries = function(region, callback) {
  var self = this,
      newest = this.newestDeployments[region],
      numbers = [],
      i;

  if (newest === undefined) {
    callback(new errors.NotFoundError('Region not found'));
    return;
  }

  for (i = newest; i > Math.max(newest - PAGE_SIZE, 0); i--) {
    numbers.push(i.toString());
  }

  async.map(numbers, function(number, callback) {
    self.getDeploymentSummary(region, number, callback);
  }, callback);
};


Stack.prototype.getDeploymentLog = function(region, number, options, callback) {
  var self = this,
      depPath = ['stacks', self.name, 'regions', region, 'deployments', number].join('.'),
      logPath = [depPath, 'log'].join('.'),
      endPath = [depPath, 'end'].join('.'),
      fromIdx, stream;

  if (!callback) {
    callback = options;
    options = {};
  }

  fromIdx = options.fromIdx || 0;
  stream = options.stream !== undefined ? options.stream : true;

  self._getDeploymentSummary(region, number, function(err, summary) {
    var depLog = new events.EventEmitter(),
        idx = 0,
        block = true;

    callback(err, depLog);

    function emitEntry(entry) {
      if (idx++ >= fromIdx) {
        depLog.emit('data', entry);
        block = false;
      }
    }

    if (!err) {
      // Emit all immediately available log entries
      summary.log.forEach(emitEntry);

      if (stream) {
        if (!summary.finished) {
          self.dreadnot.emitter.on(logPath, emitEntry);
          self.dreadnot.emitter.once(endPath, function(success) {
            self.dreadnot.emitter.removeListener(logPath, emitEntry);
            depLog.emit('end', success);
          });
        } else {
          depLog.emit('end', summary.success);
        }
      } else {
        if (summary.finished) {
          depLog.emit('end', summary.success);
        } else if (block) {
          self.dreadnot.emitter.once(logPath, function(entry) {
            emitEntry(entry);
            depLog.emit('segment');
          });
        } else {
          depLog.emit('segment');
        }
      }
    }
  });
};


Stack.prototype.runningStatus = function(callback) {
  if (this.current) {
    var info = misc.merge({}, this.current),
        diffUrl = this.getGitHubDiffUrl(info.from_revision, info.to_revision);
    delete info.log;
    callback(null, { running: true, info: info, diffUrl: diffUrl });
  } else {
    callback(null, { running: false });
  }
};


/** Export Stack */
exports.Stack = Stack;
