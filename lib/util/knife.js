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
  knife(['data', 'bag', 'show', '-F', 'json', bagName, item])(callback);
}


function dataBagSet(bagName, obj, options, callback) {
  if (!callback) {
    callback = options;
    options = null;
  }
  var filename = sprintf('/tmp/databag-%s.json', misc.randstr(8));
  async.series([
    fs.writeFile.bind(null, filename, JSON.stringify(obj)),
    knife(['data', 'bag', 'from', 'file', bagName, filename], options).bind(null),
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


/** Export Data Bag */
exports.dataBag = {
  'set': dataBagSet,
  'get': dataBagGet
};


/** Export Search */
exports.search = knifeSearch;


/** Export Node */
exports.node = {
 list: knifeNodeList
};
