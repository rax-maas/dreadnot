var async = require('async');

var flowCtrl = require('../lib/flow_control');


exports['test_retryOnError_success'] = function(test, assert) {
  var options = { 'max_retries': 2 }, payload = {};

  function run(callback) {
    callback();
  }

  flowCtrl.retryOnError(run, null, null, null, function(err) {
    assert.ifError(err);
    test.finish();
  });
};


exports['test_retryOnError_retry_success'] = function(test, assert) {
  var args = [1], i = 0, options = { 'max_retries': 3 };

  function run(failures, callback) {
    i++;
    if (i <= failures) {
      callback(new Error('failure'));
      return;
    }
    callback();
  }

  flowCtrl.retryOnError(run, null, args, options, function(err) {
    assert.ifError(err);
    assert.equal(i, 2);
    test.finish();
  });
};


exports['test_retryOnError_retry_failure'] = function(test, assert) {
  var args = [2], i = 0, options = { 'max_retries': 1 };

  function run(failures, callback) {
    i++;
    if (i <= failures) {
      callback(new Error('failure'));
      return;
    }
    callback();
  }

  flowCtrl.retryOnError(run, null, args, options, function(err) {
    assert.ok(err);
    assert.equal(i, 2);
    test.finish();
  });
};


exports['test_wrapCallback'] = function(test, assert) {
  function callbackError(callback) {
    callback(new Error());
  }

  function callbackSuccess(callback) {
    callback(null, 1, 2);
  }

  async.series([
    function testError(callback) {
      callbackError(flowCtrl.wrapCallback(function() {
        assert.ok(arguments.length === 1);
        callback();
      }, ['foo', 'bar'], false));
    },

    function testSuccessOne(callback) {
      callbackSuccess(flowCtrl.wrapCallback(function() {
        assert.ok(arguments.length === 3);
        assert.deepEqual(Array.prototype.slice.call(arguments), [null, 'foo', 'bar']);
        callback();
      }, ['foo', 'bar'], false));
    },

    function testSuccessOne(callback) {
      callbackSuccess(flowCtrl.wrapCallback(function() {
        assert.ok(arguments.length === 5);
        assert.deepEqual(Array.prototype.slice.call(arguments), [null, 'foo', 'bar', 1, 2]);
        callback();
      }, ['foo', 'bar'], true));
    }
  ], test.finish);
};
