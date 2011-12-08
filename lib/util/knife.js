var fs = require('fs');

var async = require('async');

var misc = require('./misc');
var sprintf = require('./sprintf');


function knife(args) {
  return function(callback) {
    args = ['/usr/bin/knife'].concat(args);
    misc.spawn(args, function(err, data) {
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


function knifeSearch(index, query, callback) {
  knife(['search', index, query, '-F', 'json'])(callback);
}


function dataBagGet(bagName, item, callback) {
  knife(['data', 'bag', 'show', '-F', 'json', bagName, item])(callback);
}


function dataBagSet(bagName, obj, callback) {
  var filename = sprintf('/tmp/databag-%s.json', misc.randstr(8));
  async.series([
    fs.writeFile.bind(null, filename, JSON.stringify(obj)),
    knife(['data', 'bag', 'from', 'file', bagName, filename]).bind(null),
    fs.unlink.bind(null, filename)
  ], callback);
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
  'list': knife(['node', 'list', '-F', 'json'])
};
