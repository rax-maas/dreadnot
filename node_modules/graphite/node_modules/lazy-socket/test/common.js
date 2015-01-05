var common = exports;
var path   = require('path');

common.dir      = {};
common.dir.root = path.dirname(__dirname);
common.dir.lib  = path.join(common.dir.root, 'lib');

common.LazySocket = require(common.dir.root);
common.port       = 13432;
