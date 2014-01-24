var LazySocket = require('lazy-socket');
var url        = require('url');

module.exports = CarbonClient;
function CarbonClient(properties) {
  properties = properties || {};

  this._dsn    = properties.dsn;
  this._socket = properties.socket || null;
}

CarbonClient.prototype.write = function(metrics, timestamp, cb) {
  this._lazyConnect();

  var lines = '';
  for (var path in metrics) {
    var value = metrics[path];
    lines += [path, value, timestamp].join(' ') + '\n';
  }

  this._socket.write(lines, 'utf-8', cb);
};

CarbonClient.prototype._lazyConnect = function() {
  if (this._socket) return;

  var dsn  = url.parse(this._dsn);
  var port = parseInt(dsn.port, 10) || 2003;
  var host = dsn.hostname;

  this._socket = LazySocket.createConnection(port, host);
};

CarbonClient.prototype.end = function() {
  if (this._socket) this._socket.end();
};
