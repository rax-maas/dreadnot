var common     = require('../common');
var assert     = require('assert');
var net        = require('net');
var LazySocket = common.LazySocket;
var data       = '';

var server = net.createServer(function(socket) {
  socket
    .on('data', function(chunk) {
      data += chunk;
    })
    .on('end', function() {
      server.close();
    });
});

server.listen(common.port, function() {
  var socket = LazySocket.createConnection(common.port);
  socket.write('high ', 'utf-8');
  socket.write('five', 'utf-8', function(err) {
    assert.ok(!err);
    socket.end();
  });
});

process.on('exit', function() {
  assert.equal(data, 'high five');
});
