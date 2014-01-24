var common     = require('../common');
var test       = require('utest');
var assert     = require('assert');
var LazySocket = common.LazySocket;
var sinon      = require('sinon');
var net        = require('net');

test('LazySocket#createConnection', {
  'returns a new LazySocket': function() {
    var socket = LazySocket.createConnection();
    assert.ok(socket instanceof LazySocket);
  },

  'sets the passed host / port': function() {
    var socket = LazySocket.createConnection(8080, 'example.org');
    assert.equal(socket.port, 8080);
    assert.equal(socket.host, 'example.org');
  },
});

var socket;
var fakeSocket;
test('LazySocket', {
  before: function() {
    socket     = new LazySocket();
    fakeSocket = sinon.stub({
      once: function() {},
      destroy: function() {},
      end: function() {},
      write: function() {},
    });

    sinon.stub(net, 'createConnection').returns(fakeSocket);
    fakeSocket.once.returns(fakeSocket);

    // To establish a connection
    socket.write();
  },

  after: function() {
    net.createConnection.restore();
  },

  '#end when disconnected (does not blow up)': function() {
    socket = new LazySocket();
    socket.end();
  },

  '#end when connected': function() {
    socket.end();

    assert.ok(fakeSocket.end.calledOnce);
  },

  '#destroy when disconnected (does not blow up)': function() {
    var socket = new LazySocket();
    socket.destroy();
  },

  '#destroy when connected': function() {
    socket.destroy();

    assert.ok(fakeSocket.destroy.calledOnce);
  },
});
