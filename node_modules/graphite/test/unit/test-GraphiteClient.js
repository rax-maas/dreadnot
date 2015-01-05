var common         = require('../common');
var test           = require('utest');
var assert         = require('assert');
var sinon          = require('sinon');
var graphite       = common.graphite;
var GraphiteClient = graphite;

test('graphite.createClient', {
  'returns a new GraphiteClient': function() {
    var client = graphite.createClient();
    assert.ok(client instanceof GraphiteClient);
  },

  'takes carbon dsn first and creates lazy socket': function() {
    var client = graphite.createClient('plaintext://example.org:8080/');
  },
});

test('graphite.flatten', {
  'returns an already flat object as is': function() {
    var obj = {foo: 'bar'};
    assert.deepEqual(graphite.flatten(obj), {foo: 'bar'});
  },

  'returns a copy of the object': function() {
    var obj  = {foo: 'bar'};
    var flat = graphite.flatten(obj);

    assert.notStrictEqual(obj, flat);
  },

  'flattens a deep object': function() {
    var obj = {
      a: 1,
      deep: {
        we: {
          go: {
            b: 2,
            c: 3,
          }
        }
      },
      d: 4,
    };
    var flat = graphite.flatten(obj);

    assert.deepEqual(flat, {
      'a'            : 1,
      'deep.we.go.b' : 2,
      'deep.we.go.c' : 3,
      'd'            : 4,
    });
  },
});

var client;
var carbon;
test('GraphiteClient', {
  before: function() {
    carbon = sinon.stub({
      write: function() {},
    });
    client = new GraphiteClient({carbon: carbon});
  },

  '#write flattens metrics before passing to carbon': function() {
    var metrics = {foo: {bar: 1}};
    client.write(metrics);

    assert.ok(carbon.write.calledWith({'foo.bar': 1}));
  },

  '#write passes the current time to carbon': function() {
    client.write({});

    var now = Math.floor(Date.now() / 1000);
    assert.ok(carbon.write.getCall(0).args[1] >= now);
  },

  '#write lets you pass a timestamp to carbon': function() {
    client.write({}, 23000);

    assert.equal(carbon.write.getCall(0).args[1], 23);
  },

  '#write passes a callback to carbon': function() {
    var cb = function() {};
    client.write({}, null, cb);

    assert.equal(carbon.write.getCall(0).args[2], cb);
  },

  '#write takes callback as second argument as well': function() {
    var cb = function() {};
    client.write({}, cb);

    assert.equal(carbon.write.getCall(0).args[2], cb);
  },
});
