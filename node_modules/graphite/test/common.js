var common = exports;
var path   = require('path');

common.dir      = {}
common.dir.root = path.dirname(__dirname);
common.dir.lib  = path.join(common.dir.root, 'lib');

common.graphite  = require(common.dir.root);
common.port      = 12523;
common.carbonDsn = 'plaintext://localhost:' + common.port + '/';
