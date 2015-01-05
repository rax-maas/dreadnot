var mod_fs = require('fs');
var mod_util = require('util');
var mod_vasync = require('../lib/vasync');

console.log(mod_vasync.forEachParallel({
    'func': mod_fs.stat,
    'inputs': [ '/var', '/nonexistent', '/tmp' ]
}, function (err, results) {
	console.log('error: %s', err.message);
	console.log('results: %s', mod_util.inspect(results, null, 3));
}));
