var common       = require('../common');
var test         = require('utest');
var assert       = require('assert');
var sinon        = require('sinon');
var CarbonClient = require('../../lib/CarbonClient');

test('CarbonClient#end', {
  'closes socket if it has one': function() {
    var socket = sinon.stub({end: function() {}});
    var client = new CarbonClient({socket: socket});

    client.end();

    assert.equal(socket.end.callCount, 1);
  },

  'does not crash if it has no socket': function() {
    var client = new CarbonClient();
    client.end();
  },
});
