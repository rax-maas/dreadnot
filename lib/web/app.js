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

var path = require('path');

var connect = require('connect');
var express = require('express');
var socketio = require('socket.io');
var log = require('logmagic').local('web.app');

var misc = require('util/misc');

var errors = require('../errors');

var api = require('./api');
var auth = require('./auth');
var handlers = require('./handlers');
var middleware = require('./middleware');

var STATIC_DIR = path.normalize(path.join(__dirname, '..', '..', 'static'));
var TEMPLATE_DIR = path.join(__dirname, 'views');


function User(authorized, name) {
  this.authorized = authorized;
  this.name = name;
}



function buildAuthMiddleware(config, read) {
  return function(req, res, next) {
    var dest = '/login';

    if (req.url) {
      dest += '?next=' + req.url;
    }

    if (req.session && req.session.authed === true) {
      // Pass through authorized requests
      req.user = new User(true, req.session.username);
      next();
    } else if (config.login_required === false) {
      // Automatically authorize requests if login_required === false
      req.user = new User(true, 'login_not_required');
      next();
    } else if (read && config.unauthorized_read) {
      req.user = new User(false);
      next();
    } else {
      // Redirect to login page
      res.redirect(dest);
    }
  };
}

// Register socket.io routing
function authorizeStream(dreadnot, sessionStore) {
  return function(data, callback) {
    var cookie;

    if (dreadnot.config.login_required === false || dreadnot.config.unauthorized_read) {
      log.info('stream authorized by default');
      callback(null, true);
      return;
    }

    log.info('attempting to authorize stream', {
      cookie: data.headers.cookie
    });

    if (!data.headers.cookie) {
      callback(null, false);
      return;
    }

    cookie = connect.utils.parseCookie(data.headers.cookie);

    if (!cookie['connect.sid']) {
      callback(null, false);
      return;
    }

    sessionStore.get(cookie['connect.sid'], function(err, session) {
      log.info('attempted to retrieve session', {
        sid: cookie['connect.sid'],
        err: err,
        session: session
      });

      if (err || !session || !session.authed) {
        callback(null, false);
      } else {
        callback(null, true);
      }
    });
  };
}


exports.registerWeb = function(dreadnot, authdb) {
  var app = express.createServer(),
      webHandlers = handlers.web.getWebHandlers(dreadnot, authdb),
      readAuth = buildAuthMiddleware(dreadnot.config, true),
      writeAuth = buildAuthMiddleware(dreadnot.config, false);

  app.configure(function() {
    // Settings
    app.set('views', TEMPLATE_DIR);
    app.set('view engine', 'jade');
    app.set('view options', {layout: false});
  });

  // Public URLs
  app.get('/login', webHandlers.getLogin);
  app.post('/login', webHandlers.attemptLogin);

  // Private URLs
  app.get('/', readAuth, webHandlers.getStacks);
  app.get('/logout', readAuth, webHandlers.logout);
  app.get('/stacks/:stack/regions/:region', readAuth, webHandlers.getDeployments);
  app.post('/stacks/:stack/regions/:region', writeAuth, webHandlers.deploy);
  app.get('/stacks/:stack/regions/:region/deployments/:deployment', readAuth, webHandlers.getDeployment);
  app.get('/warning', writeAuth, webHandlers.getWarning);
  app.post('/warning', writeAuth, webHandlers.saveWarning);

  return app;
};


exports.registerAPI = function(dreadnot, authdb) {
  var app = express.createServer(),
      apiHandlers = api.getAPIHandlers(dreadnot),
      basic;

  // API is behind Basic auth
  basic = express.basicAuth(function(username, password, callback) {
    authdb.validate(username, password, function(err, valid) {
      if (err || !valid) {
        callback(err, null);
      } else {
        callback(null, new User(username, true));
      }
    });
  });

  // Register handlers
  app.get('/1.0/status', basic, apiHandlers.getStatus);

  return app;
};


exports.registerSocketIO = function(app, dreadnot, sessionStore) {
  var io = socketio.listen(app, {logger: log, authorization: authorizeStream(dreadnot, sessionStore)}),
      streamingHandlers = handlers.streaming.getStreamingHandlers(dreadnot);
  io.sockets.on('connection', streamingHandlers.handleConnection);
};


exports.run = function(port, dreadnot) {
  var app = express.createServer(),
      authdb = auth.loadDBFromFile(dreadnot.config.htpasswd_file),
      streamHandlers = handlers.streaming.getStreamingHandlers(dreadnot),
      sessionStore = new connect.session.MemoryStore({maxAge: 7 * 24 * 60 * 60 * 1000});

  app.configure(function() {
    // Middleware
    app.use(middleware.redirect(dreadnot.config.secure));
    app.use(middleware.logger());
    app.use(express.bodyParser());
    app.use(express.cookieParser());
    app.use(express.session({secret: misc.randstr(32), store: sessionStore}));
    //app.use(app.router);
  });

  app.use('/static', express.static(STATIC_DIR));
  app.use('/api', exports.registerAPI(dreadnot, authdb));
  app.use('/', exports.registerWeb(dreadnot, authdb));
  exports.registerSocketIO(app, dreadnot, sessionStore);

  // Catch 404s
  app.get('*', function(req, res, next) {
    next(new errors.NotFoundError());
  });

  log.info('running web server', {port: port});
  app.listen(port);
};
