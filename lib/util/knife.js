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

var fs = require('fs');

var async = require('async');

var misc = require('./misc');
var sprintf = require('./sprintf');


function knife(args, options) {
  return function(callback) {
    var env = misc.copyEnv();
    var knife_path = '/usr/local/bin/knife';
    options = options || {};

    // Support for these must be implemented in your knife.rb
    if (options.server) {
      env['CHEF_URL'] = options.server;
    }

    if (options.user) {
      env['CHEF_USER'] = options.user;
    }

    if (env['KNIFE_PATH']) {
      knife_path = env['KNIFE_PATH'];
    }
    else if (options.knife_path) {
      knife_path = options.knife_path;
    }

    if (options.knife_config) {
      args = args.concat(['-c', options.knife_config]);
    }

    args = [knife_path].concat(args);

    misc.spawn(args, {env: env}, function(err, stdout, stderr) {
      var payload;

      if (err) {
        callback(err);
        return;
      }

      if (args.indexOf('json') >= 0) {
        try {
          payload = JSON.parse(stdout);
        } catch (e) {
          callback(e);
          return;
        }
      }

      callback(null, payload);
    });
  };
}


function knifeSearch(index, query, options, callback) {
  if (!callback) {
    callback = options;
    options = null;
  }
  knife(['search', index, query, '-F', 'json'], options)(callback);
}


function dataBagGet(bagName, item, options, callback) {
  if (!callback) {
    callback = options;
    options = null;
  }
  knife(['data', 'bag', 'show', '-F', 'json', bagName, item], options)(callback);
}


function dataBagFromFile(bagName, fileName, options, callback) {
  if (!callback) {
    callback = options;
    options = null;
  }
  knife(['data', 'bag', 'from', 'file', bagName, fileName], options)(callback);
}


function dataBagSet(bagName, obj, options, callback) {
  if (!callback) {
    callback = options;
    options = null;
  }
  var filename = sprintf('/tmp/databag-%s.json', misc.randstr(8));
  async.series([
    fs.writeFile.bind(null, filename, JSON.stringify(obj)),
    dataBagFromFile.bind(null, bagName, filename, options),
    fs.unlink.bind(null, filename)
  ], callback);
}


function nodeGet(nodeName, options, callback) {
  if (!callback) {
    callback = options;
    options = null;
  }
  knife(['node', 'show', '-l', '-F', 'json', nodeName], options)(callback);
}


function nodeFromFile(nodeName, fileName, options, callback) {
  if (!callback) {
    callback = options;
    options = null;
  }
  knife(['node', 'from', 'file', fileName], options)(callback);
}


function nodeSet(nodeName, obj, options, callback) {
  if (!callback) {
    callback = options;
    options = null;
  }
  var filename = sprintf('/tmp/node-%s.json', misc.randstr(8));
  async.series([
    fs.writeFile.bind(null, filename, JSON.stringify(obj)),
    nodeFromFile.bind(null, nodeName, filename, options),
    fs.unlink.bind(null, filename)
  ], callback);
}


function knifeNodeList(options, callback) {
  if (!callback) {
    callback = options;
    options = null;
  }
  knife(['node', 'list', '-F', 'json'], options)(callback);
}


function queryAndRun(baton, args, query, cmd, msg, options, callback, output_parser) {
  if (!output_parser && !callback) {
    callback = options;
    options = null;
  }

  var getHostParams = options && options.getHostParams ? options.getHostParams : function(hostObj) {
    return {
      ip: hostObj.automatic.fqdn
    };
  };

  query = sprintf(query, args);

  function execute(hostObj, callback) {
    var name = hostObj.name,
        hostParams, curCmd;

    try {
      hostParams = getHostParams(hostObj);
    } catch (e) {
      baton.log.errorf('error retrieving host parameters for ${name}: ${err}', {
        name: hostObj.name,
        err: e
      });
      callback(null, e);
      return;
    }

    function onComplete(err, stdout, stderr) {
      if (!err) {
        baton.log.infof(msg, misc.merge({name: name}, hostParams));
      }

      if (stderr) {
        callback(null, new Error(stderr));
        return;
      }

      if (output_parser) {
        callback(null, output_parser(stdout, stderr));
        return;
      }

      // Never short circuit on error
      callback(null, err);
    }

    if (typeof cmd === 'function') {
      cmd(hostObj, onComplete);
    } else {
      curCmd = cmd.map(function(arg) {
        return sprintf(arg, misc.merge(args, hostParams));
      });

      misc.taskSpawn(baton, args, curCmd, null, onComplete);
    }
  }

  baton.log.infof('searching for nodes: ${query}', {
    query: query
  });

  exports.search('node', query, options, function(err, results) {
    if (err) {
      callback(err);
      return;
    }
    baton.log.infof('found ${length} nodes', {
      length: results.rows.length
    });

    async.map(results.rows, execute, function(_, errors) {
      var failed = errors.filter(function(err) {
        return err;
      }).length;

      if (failed > 0) {
        baton.log.errorf('${type} failed on ${failed} out of ${length} nodes', {
          type: (typeof cmd === 'function') ? 'function' : 'command',
          failed: failed,
          length: results.rows.length
        });
        callback(new Error('queryAndRun failed'));
      } else {
        callback();
      }
    });
  });
}


/** Export Data Bag */
exports.dataBag = {
  'set': dataBagSet,
  'get': dataBagGet,
  'setFromFile': dataBagFromFile
};


/** Export Search */
exports.search = knifeSearch;


/** Export Node */
exports.node = {
 list: knifeNodeList,
 set: nodeSet,
 get: nodeGet,
 setFromFile: nodeFromFile
};


/** Export queryAndRun */
exports.queryAndRun = queryAndRun;
