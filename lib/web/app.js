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
function authorizeStream(baton) {
  return function(data, callback) {
    var cookie;

    if (baton.config.login_required === false || baton.config.unauthorized_read) {
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

    baton.sessionStore.get(cookie['connect.sid'], function(err, session) {
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

exports.registerPublic = function(baton, app) {
  log.info('registering URLs');
  // Register Public URLs
  app.get('/login', baton.webHandlers.getLogin);
  app.post('/login', baton.webHandlers.attemptLogin);
};


exports.registerPrivate = function(baton, app) {
  var readAuth = buildAuthMiddleware(baton.config, true),
      writeAuth = buildAuthMiddleware(baton.config, false);
  app.get('/', readAuth, baton.webHandlers.getStacks);
  app.get('/logout', readAuth, baton.webHandlers.logout);
  app.get('/stacks/:stack/regions/:region', readAuth, baton.webHandlers.getDeployments);
  app.post('/stacks/:stack/regions/:region', writeAuth, baton.webHandlers.deploy);
  app.get('/stacks/:stack/regions/:region/deployments/:deployment', readAuth, baton.webHandlers.getDeployment);
  app.get('/warning', writeAuth, baton.webHandlers.getWarning);
  app.post('/warning', writeAuth, baton.webHandlers.saveWarning);
};


exports.registerAPI = function(baton, app) {
  // API is behind Basic auth
  var basic = express.basicAuth(function(username, password, callback) {
    baton.authdb.validate(username, password, function(err, valid) {
      if (err || !valid) {
        callback(err, null);
      } else {
        callback(null, new User(username, true));
      }
    });
  });

  // Register handlers
  app.get('/api/1.0/status', basic, baton.apiHandlers.getStatus);
};


exports.registerSocketIO = function(baton, app) {
  var io = socketio.listen(app, {logger: log, authorization: authorizeStream(baton)});
  io.sockets.on('connection', baton.streamHandlers.handleConnection);
};


exports.run = function(port, dreadnot) {
  var app = express.createServer(),
      authdb = auth.loadDBFromFile(dreadnot.config.htpasswd_file),
      baton = {
        config: dreadnot.config,
        authdb: authdb,
        apiHandlers: api.getAPIHandlers(dreadnot),
        webHandlers: handlers.web.getWebHandlers(dreadnot, authdb),
        streamHandlers: handlers.web.getStreamingHandlers(dreadnot),
        sessionStore: new connect.session.MemoryStore({maxAge: 7 * 24 * 60 * 60 * 1000})
      }, io;

  app.configure(function() {
    log.info('configuring web server', {static_dir: STATIC_DIR, template_dir: TEMPLATE_DIR});

    // Settings
    app.set('views', TEMPLATE_DIR);
    app.set('view engine', 'jade');
    app.set('view options', {layout: false});

    // Middleware
    app.use(middleware.redirect(dreadnot.config.secure));
    app.use(middleware.webhandler(baton.webHandlers));
    app.use(middleware.logger());
    app.use(express.bodyParser());
    app.use(express.cookieParser());
    app.use(express.session({secret: misc.randstr(32), store: baton.sessionStore}));
    app.use('/static', express.static(STATIC_DIR));
    app.use(app.router);
  });

  exports.registerPublic(baton, app);
  exports.registerPrivate(baton, app);
  exports.registerAPI(baton, app);
  exports.registerSocketIO(baton, app);

  // Catch 404s
  app.get('*', function(req, res, next) {
    next(new errors.NotFoundError());
  });

  log.info('running web server', {port: port});
  app.listen(port);
};
