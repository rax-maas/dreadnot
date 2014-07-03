var constants = require('constants');

var async = require('async');
var express = require('express');

var request = require('../lib/request');
var UnexpectedStatusCodeError = require('../lib/errors').UnexpectedStatusCodeError;

function getTestHttpServer(port, ip, callback) {
  ip = ip || '127.0.0.1';

  var server = express.createServer();
  server.listen(port, ip, callback.bind(server, server));
}

exports['test_request'] = function(test, assert) {
  var port = 7956, url = 'http://127.0.0.1:' + port,
      server = null, options;

  async.series([
    function startTestServer(callback) {
      getTestHttpServer(port, '127.0.0.1', function(server_) {
        function reqHandlerError(req, res) {
          res.writeHead(500, {});
          res.end('');
        }

        function reqHandlerBody(req, res) {
          res.writeHead(200, { 'content-type': 'application/json'});
          res.end(req.body);
        }

        function reqHandlerMalformedJson(req, res) {
          res.writeHead(200, { 'content-type': 'application/json'});
          res.end("{'foo 1: ");
        }

        server_.get('/test-url', reqHandlerError);
        server_.get('/test-url-body', reqHandlerBody);
        server_.get('/test-url-malformed-json', reqHandlerMalformedJson);

        server = server_;
        callback();
      });
    },

    function testConnRefused(callback) {
      request.request('http://127.0.0.1:34890', 'GET', null, {}, function onResponse(err, result) {
        assert.ok(err);
        assert.equal(err.code, 'ECONNREFUSED');
        assert.ok(!result);
        callback();
      });
    },

    function testSuccess(callback) {
      options = {
        'parse_json': false,
        'expected_status_codes': [500]
      };

      request.request(url + '/test-url', 'GET', null, options, function onResponse(err, result) {
        assert.ifError(err);
        callback();
      });
    },

    function testMalformedJson(callback) {
      options.parse_json = true;
      options.expected_status_codes = [200];

      request.request(url + '/test-url-malformed-json', 'GET', null, options, function onResponse(err, response) {
        assert.ok(err);
        assert.equal(err.originalData, "{'foo 1: ");
        assert.equal(err.type, 'unexpected_token');
        callback();
      });
    },

    function testUnexpectedStatusCode1(callback) {
      options.parse_json = false;
      options.expected_status_codes = [200];

      request.request(url + '/some-inextensitent-path', 'GET', null, options, function onResponse(err, response) {
        assert.ok(!response);
        assert.ok(err && (err instanceof UnexpectedStatusCodeError));
        assert.ok(err.statusCode, 404);
        assert.match(err.message, /unexpected status code/i);
        callback();
      });
    },

    function testUnexpectedStatusCode2(callback) {
      options.parse_json = true;
      options.expected_status_codes = [200];

      request.request(url + '/test-url', 'GET', null, options, function onResponse(err, response) {
        assert.ok(!response);
        assert.ok(err && (err instanceof UnexpectedStatusCodeError));
        assert.match(err.message, /unexpected status code/i);
        callback();
      });
    },

    function testUnexpectedStatusCodeReturnResponse(callback) {
      options.parse_json = false;
      options.expected_status_codes = [200];
      options.return_response = true;

      request.request(url + '/some-inextensitent-path', 'GET', null, options, function onResponse(err, response) {
        assert.ok(response);
        assert.match(response.body, /Cannot GET \/some-inextensitent-path/);
        assert.ok(err && (err instanceof UnexpectedStatusCodeError));
        assert.ok(err.statusCode, 404);
        assert.match(err.message, /unexpected status code/i);
        callback();
      });
    },

    function testReqTimeout(callback) {
      options.timeout = 500;
      request.request('http://google.com:8285', 'GET', null, options, function onResponse(err, response) {
        assert.ok(err);
        assert.equal(err.errno, constants.ETIMEDOUT);
        assert.match(err.message, /operation timed out/i);
        callback();
      });
    },

    function tesPreRequestHookDenied(callback) {
      function hook(reqOptions, callback) {
        if (reqOptions.host === 'google.com') {
          callback(new Error('PONIES'));
        }
        else {
          callback(null, reqOptions);
        }
      }

      options.hooks = {};
      options.hooks.pre_request = hook;
      request.request('http://google.com:8285', 'GET', null, options, function onResponse(err, response) {
        assert.ok(err);
        assert.ok(!response);
        assert.match(err.message, /ponies/i);
        callback();
      });
    },

    function tesPreRequestHookSuccess(callback) {
      request.request('http://127.0.0.1:34890', 'GET', null, {}, function onResponse(err, result) {
        assert.ok(err);
        assert.equal(err.code, 'ECONNREFUSED');
        assert.ok(!result);
        callback();
      });
    }
  ],

  function(err) {
    if (server) {
      server.close();
    }

    test.finish();
  });
};


exports['test_checkStatusCode'] = function(test, assert) {
  assert.ok(request.checkStatusCodes(200, ['300', '200']));
  assert.ok(request.checkStatusCodes(200, ['300', 200]));
  assert.ok(request.checkStatusCodes(200, [/3../, 200]));
  assert.ok(request.checkStatusCodes(220, [/[23]../]));
  assert.ok(request.checkStatusCodes(220, [/2[0-9]{2}/]));
  assert.ok(request.checkStatusCodes(299, [/2[0-9]{2}/]));
  assert.ok(request.checkStatusCodes(200, [/2[0-9]{2}/]));
  assert.ok(!request.checkStatusCodes(300, [/2[0-9]{2}/]));
  assert.ok(request.checkStatusCodes(500, [500]));

  test.finish();
};
