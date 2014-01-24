var common     = require('../common');
var assert     = require('assert');
var net        = require('net');
var LazySocket = common.LazySocket;
var data       = '';

var num = 0;
var server = net.createServer(function(socket) {
  socket
    .on('data', function(chunk) {
      data += chunk;
    });

  num++;
  if (num === 1) {
    socket
      .on('end', sendSecondMessage)
      .end();

    server.close();
  }

  if (num === 2) {
    socket.on('end', function() {
      server.close();
    });
  }
});

server.listen(common.port, sendFirstMessage);

var socket = LazySocket.createConnection(common.port);
function sendFirstMessage() {
  server.removeAllListeners('listening')
  socket.write('first', 'utf-8', function(err) {
    assert.ok(!err);
  });
}

function sendSecondMessage() {
  socket.write('second ', 'utf-8', function(err) {
    assert.ok(err);
    server.listen(common.port, sendThirdMessage);
  });
}

function sendThirdMessage() {
  socket.write('third', 'utf-8', function(err) {
    assert.ok(!err);
    socket.end();
  });
}

process.on('exit', function() {
  assert.equal(data, 'firstthird');
});
