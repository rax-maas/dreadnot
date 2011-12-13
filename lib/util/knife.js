var fs = require('fs');

var async = require('async');

var misc = require('./misc');
var sprintf = require('./sprintf');


function knife(args, options) {
  return function(callback) {
    var env = misc.copyEnv();
    options = options || {};

    // Support for these must be implemented in your knife.rb
    if (options.server) {
      env['CHEF_URL'] = options.server;
    }

    if (options.user) {
      env['CHEF_USER'] = options.user;
    }

    args = ['/usr/bin/knife'].concat(args);

    misc.spawn(args, {env: env}, function(err, data) {
      var payload;

      if (err) {
        callback(err);
        return;
      }

      if (args.indexOf('json') >= 0) {
        try {
          payload = JSON.parse(data);
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


function knifeNodeList(options, callback) {
  if (!callback) {
    callback = options;
    options = null;
  }
  knife(['node', 'list', '-F', 'json'], options)(callback);
}


function queryAndRun(baton, args, query, cmd, msg, options, callback) {
  if (!callback) {
    callback = options;
    options = null;
  }

  query = sprintf(query, args);

  function execute(hostObj, callback) {
    var ip = hostObj.automatic.ipaddress,
        name = hostObj.name,
        curCmd;

    var curCmd = cmd.map(function(arg) {
      return sprintf(arg, misc.merge(args, {ip: ip}));
    });

    misc.taskSpawn(baton, args, curCmd, null, function(err, stdout, stderr) {
      if (!err) {
        baton.log.info(msg, {
          name: name,
          ip: ip
        });
      }
      callback(err, stdout, stderr);
    });
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
      length: results.rows.length,
    });
    async.forEach(results.rows, execute, callback);
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
 list: knifeNodeList
};


/** Export queryAndRun */
exports.queryAndRun = queryAndRun;
