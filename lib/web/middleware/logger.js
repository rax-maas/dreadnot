/*
 *  Copyright 2011 Rackspace
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

var log = require('logmagic').local('web.middleware.logger');


module.exports = function() {
  return function logger(req, res, next) {
    req._startTime = new Date();

    // mount safety
    if (req._logging) {
      return next();
    }

    // flag as logging
    req._logging = true;

    // proxy end to output loggging
    var end = res.end;
    res.end = function(chunk, encoding) {
      // Make sure the end function actually executes
      res.end = end;
      res.end(chunk, encoding);

      // Build our logging information
      var obj = {};
      obj['response-time'] = new Date() - req._startTime;
      obj['remote-addr'] = req.socket &&
          (req.socket.remoteAddress ||
          (req.socket.socket && req.socket.socket.remoteAddress));
      obj.method = req.method;
      obj['http-version'] = req.httpVersionMajor + '.' + req.httpVersionMinor;
      obj.status = res.statusCode;
      obj['content-length'] = res._headers['content-length'];
      obj.referrer = req.headers.referer;
      obj['user-agent'] = req.headers['user-agent'];
      obj.txnId = req.txnId;

      // Log using logmagic our access info
      log.info(req.originalUrl, obj);
    };
    next();
  };
};
