var mod_fs = require('fs');
var mod_util = require('util');
var mod_vasync = require('../lib/vasync');

console.log(mod_vasync.parallel({
    'funcs': [
	function f1 (callback) { mod_fs.stat('/tmp', callback); },
	function f2 (callback) { mod_fs.stat('/noexist', callback); },
	function f3 (callback) { mod_fs.stat('/var', callback); }
    ]
}, function (err, results) {
	console.log('error: %s', err.message);
	console.log('results: %s', mod_util.inspect(results, null, 3));
}));
