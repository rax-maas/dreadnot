/**
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

var http = require('http');
var util = require('util');

var express = require('express');

var sprintf = require('sprintf').sprintf;

var misc = require('rackspace-shared-utils/lib/misc');

/**
 * Maps tokens to external ids.
 * @type {Object}
 * @const
 */

var TOKEN_TO_INFO = {
  'XXXXXXXXXXZZZZZZZ': ['reachdevsf', '666'],
  'blahahahbtoken': ['username1', '1111'],
  'toldmeicouldntcomeoverandplayanymore' : ['yourmom', '6666'],
  'dev': ['joe', '7777'],
  'never-cache-this': ['fooooo', '02222']
};

var USERNAME_TO_TOKEN_MAP = (function() {
  var k, rv = {};
  for (k in TOKEN_TO_INFO) {
    if (TOKEN_TO_INFO.hasOwnProperty(k)) {
      rv[TOKEN_TO_INFO[k][0]] = k;
    }
  }
  return rv;
})();

var USERNAME_TO_TENANT_ID_MAP = (function() {
  var k, rv = {};
  for (k in TOKEN_TO_INFO) {
    if (TOKEN_TO_INFO.hasOwnProperty(k)) {
      rv[TOKEN_TO_INFO[k][0]] = TOKEN_TO_INFO[k][1];
    }
  }
  return rv;
})();

var TENANT_ID_TO_USERNAME_MAP = (function() {
  var k, rv = {};
  for (k in TOKEN_TO_INFO) {
    if (TOKEN_TO_INFO.hasOwnProperty(k)) {
      rv[TOKEN_TO_INFO[k][1]] = TOKEN_TO_INFO[k][0];
    }
  }
  return rv;
})();

function handleRequest_v_1_1(req, res) {
  var token = req.params.tokenId,
      type = req.query.type,
      fail = req.query.fail || false,
      expiresTs = misc.getUnixTimestamp(), username, expires, statusCode, body;

  expires = new Date();
  expires.setTime((expiresTs + 100) * 1000);
  expires = expires.toString();
  username = TOKEN_TO_INFO[token][1];

  if (fail) {
    statusCode = 401;
    body = {};
  }
  else {
    if (!username) {
      username = "reachdevsf";
    }
    statusCode = 200;
    body = {
      'token' : {
        'id' : token,
        'userId' : username,
        'userURL' : '/users/' + username,
        'created' : '2010-11-01T03:32:15-05:00',
        'expires' : expires }
    };
    console.log(body);
  }

  res.writeHead(statusCode, {'Content-Type': 'application/json'});
  res.end(JSON.stringify(body));
}


function getToken_v2_0(req, res) {
  var type = req.query.type,
      fail = req.query.fail || false,
      expiresTs = misc.getUnixTimestamp(),
      username,
      tenantId,
      token,
      expires,
      statusCode,
      body,
      creds,
      providedToken,
      reason = 'api was asked to fail';

  expires = new Date();
  expires.setTime((expiresTs + 100) * 1000);
  expires = expires.toString();

  if (!req.body.auth) {
    fail = true;
    statusCode = 500;
    reason = 'missing auth in body: ' + JSON.stringify(req.body);
  }
  else {
    creds = req.body.auth;

    if (creds.hasOwnProperty('tenantName')) {
      tenantId = creds.tenantName;
      username = TENANT_ID_TO_USERNAME_MAP[tenantId];
      providedToken = req.body.auth.token.id;
    }
    else if (creds.hasOwnProperty('RAX-KSKEY:apiKeyCredentials')) {
      username = creds['RAX-KSKEY:apiKeyCredentials'].username;
      providedToken = creds['RAX-KSKEY:apiKeyCredentials'].apiKey;
      tenantId = USERNAME_TO_TENANT_ID_MAP[username];
    }

    token = USERNAME_TO_TOKEN_MAP[username];

    if (!token || !tenantId) {
      fail = true;
      statusCode = 501;
      reason = 'missing user in map auth map: ' + username + ' token:' + token + ' tenantId:'+ tenantId;
    }
    else if (token !== providedToken) {
      fail = true;
      statusCode = 502;
      reason = 'invalid token';
    }
  }

  if (fail) {
    statusCode = statusCode || 401;
    body = {'reason': reason};
  }
  else {
    statusCode = 200;

    body = {
        "access": {
            "token": {
                "id": token,
                "expires": expires,
                "tenant": {"id": tenantId, "name": tenantId}
            },
            "serviceCatalog": [
                {
                    "endpoints": [
                        {
                            "region": "ORD",
                            "tenantId": tenantId,
                            "publicURL": "https://storage101.ord1.clouddrive.com/v1/" + tenantId,
                            "internalURL": "https://snet-storage101.ord1.clouddrive.com/v1/"+ tenantId
                        }
                    ],
                    "name": "cloudFiles",
                    "type": "object-store"
                },
                {
                    "endpoints": [
                        {
                            "tenantId": tenantId,
                            "publicURL": "https://servers.api.rackspacecloud.com/v1.0/"+ tenantId,
                            "version": {
                                "versionInfo": "https://servers.api.rackspacecloud.com/v1.0/",
                                "versionList": "https://servers.api.rackspacecloud.com/",
                                "versionId": "1.0"
                            }
                        }
                    ],
                    "name": "cloudServers",
                    "type": "compute"
                },
                {
                    "endpoints": [
                        {
                            "region": "ORD",
                            "tenantId": tenantId,
                            "publicURL": "https://cdn2.clouddrive.com/v1/" + tenantId,
                            "version": {
                                "versionInfo": "https://cdn2.clouddrive.com/v1/",
                                "versionList": "https://cdn2.clouddrive.com/",
                                "versionId": "1"
                            }
                        }
                    ],
                    "name": "cloudFilesCDN",
                    "type": "object-store"
                }
            ],
            "user": {
                "id": "149058",
                "roles": [
                    {
                        "id": "identity:default",
                        "description": "Default Role.",
                        "name": "identity:default"
                    }
                ],
                "name": username
            }
        }
    };
  }

  body = JSON.stringify(body);
  console.log('getToken_v2_0, statusCode=%s, body=%s', statusCode, body);
  res.writeHead(statusCode, {'Content-Type': 'application/json'});
  res.end(body);
}


function validateToken_v2_0(req, res) {
  var type = req.query.type,
      token = req.params.tokenId,
      tenantId,
      fail = req.query.fail ? true : false,
      expiresTs = misc.getUnixTimestamp(),
      username,
      expires,
      statusCode,
      body,
      creds,
      ti,
      reason = 'api was asked to fail';

  expires = new Date();
  expires.setTime((expiresTs + 100) * 1000);
  expires = expires.toString();

  if (!fail && !req.headers['x-auth-token']) {
    fail = true;
    statusCode = 500;
    reason = 'missing X-Auth-Token header';
  }
  else if (!fail) {
    ti = TOKEN_TO_INFO[token];

    if (!ti) {
      username = 'reachdevsf';
      tenantId = '666';
    }
    else {
      username = ti[0];
      tenantId = ti[1];
    }

    if (!username || !tenantId) {
      fail = true;
      statusCode = 501;
      reason = 'missing token in map auth map: ' + token + ' token:' + username + ' tenantId:' + tenantId;
    }
  }

  if (fail) {
    statusCode = statusCode || 401;
    body = {unauthorized: {code: statusCode, message: reason}};
  }
  else if (tenantId !== req.query.belongsTo) {
    statusCode = 404;
    body = {"itemNotFound":{"code":404,"message":"Token doesn't belong to Tenant with Id/Name: '"+ req.query.belongsTo +"' realTenantId:"+ tenantId}};
  }
  else {
    statusCode = 200;
    body = {
        "access": {
            "token": {
                "id": token,
                "expires": expires
            },
            "user": {
                "id": "149058",
                "roles": [
                    {
                        "id": "identity:default",
                        "description": "Default Role.",
                        "name": "identity:default"
                    }
                ],
                "name": username
            }
        }
    };
  }

  body = JSON.stringify(body);
  console.log('validateToken_v2_0, statusCode=%s, body=%s', statusCode, body);
  res.writeHead(statusCode, {'Content-Type': 'application/json'});
  res.end(body);
}


function getTenantInfo_v2_0(req, res) {
  if (TENANT_ID_TO_USERNAME_MAP[req.params.tenantId]) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({
      tenant: {
        enabled: true,
        description: 'None',
        name: 'some tenant\'s name'
      }
    }));
  } else {
    res.writeHead(404, {});
    res.end();
  }
}


/**
 * Run mock Auth 1.1 API http server.
 */
function run() {
  var ip = '127.0.0.1',
      port = 23542,
      server = express.createServer();

  server.use(express.bodyParser());
  server.get('/v1.1/token/:tokenId', handleRequest_v_1_1);
  server.post('/v2.0/tokens', getToken_v2_0);
  server.get('/v2.0/tokens/:tokenId', validateToken_v2_0);
  server.get('/v2.0/tenants/:tenantId', getTenantInfo_v2_0);
  server.listen(port, ip);
  util.puts(sprintf('Mock Auth HTTP server listening on IP %s port %s', ip, port));
}


exports.run = run;


exports.USERNAME_TO_TOKEN_MAP = USERNAME_TO_TOKEN_MAP;
exports.USERNAME_TO_TENANT_ID_MAP = USERNAME_TO_TENANT_ID_MAP;
