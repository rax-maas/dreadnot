/*
 *  Copyright 2012 Rackspace
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

var parse = require('url').parse;
var http = require('http');
var https = require('https');
var constants = require('constants');

var sprintf = require('sprintf').sprintf;
var async = require('async');

var misc = require('./misc');
var UnexpectedStatusCodeError = require('./errors').UnexpectedStatusCodeError;


/**
 * Check a status code versus a variant array.
 *
 * @param {Integer, String, RegExp} statusCode the status code to check.
 * @param {Array<Integer, String, RegExp>} expectedStatusCodes list of list of mixed status Codes.
 * @return {Boolean} true/false depending on a match.
 */
exports.checkStatusCodes = function(statusCode, expectedStatusCodes) {
  var i,
      comparator;

  for (i = 0; i < expectedStatusCodes.length; i++) {
    comparator = expectedStatusCodes[i];
    if (comparator instanceof RegExp) {
      if (statusCode.toString().match(comparator)) {
        return true;
      }
    } else if (typeof comparator === 'string' || comparator instanceof String) {
      if (comparator === statusCode.toString()) {
        return true;
      }
    } else {
      if (comparator === statusCode) {
        return true;
      }
    }
  }
  return false;
};


/** Generate Authentication Header
 * @param {String} username The Username.
 * @param {String} password The Password.
 * @return {String} The header string for authentication.
 */
exports.getAuthHeader = function(username, password) {
  var auth;

  if (!username || !password) {
    throw new Error('Missing username or password');
  }

  auth = 'Basic ' + new Buffer(username + ':' + password).toString('base64');
  return auth;
};


/**
 * Build a cURL command with the provided options.
 *
 * @param {String} url target url.
 * @param {String} method HTTP methpd (get, post, put, etc.).
 * @param {Object} headers Request headers.
 * @param {?String} body Optional body.
 * @return {String} cURL command.
 */
exports.buildCurlCommand = function(url, method, headers, body) {
  var key, value, parts = ['curl', '-i'];

  parts.push('-X');
  parts.push(misc.shellQuote(method.toUpperCase()));

  for (key in headers) {
    if (headers.hasOwnProperty(key)) {
      value = headers[key];

      if (key.toLowerCase() === 'content-length' && parseInt(value, 10) === 0) {
        continue;
      }

      parts.push('-H');
      parts.push(misc.shellQuote(sprintf('%s: %s', key, value)));
    }
  }

  if (body) {
    parts.push('--data-binary');
    parts.push(misc.shellQuote(body));
  }

  parts.push(misc.shellQuote(url));

  return parts.join(' ');
};


/**
 * Perform an HTTP request to the specified URL.
 *
 * @param {String} url target url.
 * @param {String} method HTTP methpd (get, post, put, etc.).
 * @param {?String} body Optional body.
 * @param {Object} options Different request options.
 * @param {Function} callback Callback called with (err, result).
 */
function request(url, method, body, options, callback) {
  body = body || '';
  var defaultOptions = {
    'parse_json': false, // Parse body as JSON
    'expected_status_codes': [], // Array of expected status codes, each element can be either
                         // a _string, number or regexp_
    'username': null, // Optional username for basic auth
    'password': null, // Optional password for basic auth
    'headers': {}, // Optional request headers.
    'timeout': 20000, // request timeout in milliseconds,
    'return_response': false, // wait for body and return response object even if an unexpected status code is returned
    'hooks': {},

    'key': null,
    'cert': null
  },
      reqOptions, reqFunc, auth, req, customAgent = false,
      agent = false, ssl = false, parsed = parse(url);

  options = misc.merge(defaultOptions, options);

  if (parsed.protocol === 'https:') {
    ssl = true;
    reqFunc = https.request.bind(https);
  }
  else {
    ssl = false;
    reqFunc = http.request.bind(http);
  }

  reqOptions = {
    host: parsed.hostname || parsed.host,
    path: parsed.pathname + (parsed.search || ''),
    method: method,
    headers: options.headers
  };

  if (parsed.port) {
    reqOptions.port = parseInt(parsed.port, 10);
  }
  else {
    reqOptions.port = (parsed.protocol === 'https:') ? 443 : 80;
  }

  if (options.key) {
    customAgent = true;
    reqOptions.key = options.key;
  }

  if (options.cert) {
    customAgent = true;
    reqOptions.cert = options.cert;
  }

  // Add content-length (if body is provided)
  if (body.length > 0 && !reqOptions.hasOwnProperty('Content-Length')) {
    reqOptions.headers['content-length'] = Buffer.byteLength(body, 'utf8');
  }

  // Add authorization headers
  if (options.username && options.password) {
    auth = 'Basic ' + new Buffer(options.username + ':' + options.password).toString('base64');
    options.headers.authorization = auth;
  }


  function reqTimeoutHandler(req) {
    var err = new Error('ETIMEDOUT, Operation timed out via reqTimeoutHandler');
    err.errno = constants.ETIMEDOUT;
    err.code = 'ETIMEDOUT';

    try {
      req.socket.destroy(err);
    }
    catch (e) {}
  }

  function setReqTimeout(req, timeout) {
    // TODO: Requires a hack to work on freebsd.
    var timeoutId = setTimeout(reqTimeoutHandler.bind(null, req), timeout);

    req.on('response', clearTimeout.bind(null, timeoutId));
    req.on('continue', clearTimeout.bind(null, timeoutId));
    req.on('error', clearTimeout.bind(null, timeoutId));
  }

  /* TODO: cache reqOptions.agent */
  if (customAgent) {
    if (ssl) {
      agent = new https.Agent(reqOptions);
    }
    else {
      agent = new http.Agent(reqOptions);
    }

    reqOptions.agent = agent;
  }

  async.waterfall([
    function preRequestHook(callback) {
      if (!options.hooks.hasOwnProperty('pre_request')) {
        callback(null, reqOptions);
        return;
      }

      // Each hooks gets passed in request options and must pass
      // (err, modifiedRequestOptions) to its callback
      options.hooks.pre_request(reqOptions, callback);
    },

    function performRequest(reqOptions, callback) {
      // Perform the request
      try {
        req = reqFunc(reqOptions);
        setReqTimeout(req, options.timeout);
      }
      catch (err) {
        callback(err);
        return;
      }

      req.on('error', callback);
      req.on('response', function(res) {
        var data = '', statusCode, err = null;

        res.setEncoding('utf8');

        res.on('data', function(chunk) {
          data += chunk;
        });

        if (!exports.checkStatusCodes(res.statusCode, options.expected_status_codes)) {
          err = new UnexpectedStatusCodeError(options.expected_status_codes, res.statusCode);
          err.statusCode = res.statusCode;

          if (!options.return_response) {
            res.removeAllListeners('data');
            callback(err);
            return;
          }
        }

        res.on('end', function() {
          var result = {};

          if (options.parse_json && data.length > 0) {
            try {
              data = JSON.parse(data);
            }
            catch (err) {
              err.originalData = data;
              callback(err);
              return;
            }
          }

          result.headers = res.headers;
          result.statusCode = res.statusCode;
          result.body = data;

          if (err && options.return_response) {
            err.response = result;
          }

          callback(err, result);
        });
      });

      req.end(body);
    }], callback);
}


/** request function */
exports.request = request;
