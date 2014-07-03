var async = require('async');

var request = require('rackspace-shared-utils/lib/request').request;
var KeystoneClient = require('../lib/client').KeystoneClient;

exports.test_validateTokenForTenant = function(test, assert) {
  var client = new KeystoneClient('http://127.0.0.1:23542/v2.0');

  async.waterfall([
    function testInexistentTenantId(callback) {
      client.validateTokenForTenant('inexistent', 'foo', function(err, data) {
        assert.ok(err);
        assert.equal(err.statusCode, 501);
        assert.match(err.response.body.reason, /missing user in map auth map/);
        callback();
      });
    },

    function testInvalidToken(callback) {
      client.validateTokenForTenant('7777', 'foo', function(err, data) {
        assert.ok(err);
        assert.equal(err.statusCode, 502);
        assert.match(err.response.body.reason, /invalid token/);
        callback();
      });
    },

    function testValidToken(callback) {
      client.validateTokenForTenant('7777', 'dev', function(err, data) {
        assert.ifError(err);
        assert.ok(data);
        callback();
      });
    }
  ],

  function(err) {
    test.finish();
  });
};

exports.test_getTenantInfo = function(test, assert) {
  var client = new KeystoneClient('http://127.0.0.1:23542/v2.0');

  async.waterfall([
    function testInexistentTenantId(callback) {
      client.getTenantInfo('inexistent', {}, function(err, data) {
        assert.ok(err);
        assert.equal(err.statusCode, 404);
        callback();
      });
    },

    function testValidTenantId(callback) {
      client.getTenantInfo('7777', {}, function(err, data) {
        assert.ifError(err);
        assert.ok(data);
        callback();
      });
    }
  ],

  function(err) {
    test.finish();
  });
};

exports.test_getServiceCatalog = function(test, assert) {
  var client = new KeystoneClient('http://127.0.0.1:23542/v2.0', {'username': 'joe', 'apiKey': 'dev'});

  client.getServiceCatalog({}, function(err, data) {
    assert.ifError(err);
    assert.ok(data);
    assert.ok(data.length > 1);
    test.finish();
  });
};

exports.test_getTenantIdAndToken = function(test, assert) {
  var client = new KeystoneClient('http://127.0.0.1:23542/v2.0', {'username': 'joe', 'apiKey': 'dev'});

  client.getTenantIdAndToken({}, function(err, data) {
    assert.ifError(err);
    assert.ok(data);
    assert.equal(data.token, 'dev');
    assert.equal(data.tenantId, '7777');
    test.finish();
  });
};
