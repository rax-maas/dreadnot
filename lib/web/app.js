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

var api = require('./api');
var handlers = require('./handlers');
var middleware = require('./middleware');

var STATIC_DIR = path.normalize(path.join(__dirname, '..', '..', 'static'));
var TEMPLATE_DIR = path.join(__dirname, 'views');

function buildAuthMiddleware(login_required) {
  return function(req, res, next) {
    var dest = '/login';

    if (req.url) {
      dest += '?next=' + req.url;
    }

    if (req.session && req.session.authed === true) {
      // Pass through authorized requests
      next();
    } else if (login_required === false) {
      // Automatically authorize requests if login_required === false
      req.session.authed = true;
      req.session.username = "login_not_required";
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
  app.get('/login', baton.webHandlers.getLogin.bind(baton.webHandlers));
  app.post('/login', baton.webHandlers.attemptLogin.bind(baton.webHandlers));
};


exports.registerPrivate = function(baton, app, auth) {
  app.get('/', auth, baton.webHandlers.getStacks.bind(baton.webHandlers));
  app.get('/logout', auth, baton.webHandlers.logout.bind(baton.webHandlers));
  app.get('/stacks/:stack/regions/:region', auth, baton.webHandlers.getDeployments.bind(baton.webHandlers));
  app.get('/stacks/:stack/regions/:region/deployments/:deployment', auth, baton.webHandlers.getDeployment.bind(baton.webHandlers));
  app.post('/stacks/:stack/regions/:region/deploy', auth, baton.webHandlers.deploy.bind(baton.webHandlers));
};


exports.registerAPI = function(app) {
  app.use('/api/1.0', api.register());
};


exports.registerSocketIO = function(baton, app) {
  var io = socketio.listen(app, {logger: log, authorization: authorizeStream(baton)});
  io.sockets.on('connection', baton.streamHandlers.handleConnection.bind(baton.streamHandlers));
};


exports.run = function(port, dreadnot) {
  var app = express.createServer(), io,
      FSStore = require('connect-fs')(connect),
      baton = {
        webHandlers: new handlers.WebHandlers(dreadnot),
        streamHandlers: new handlers.StreamingHandlers(dreadnot),
        sessionStore: new FSStore({'dir': '/tmp/dn-sessions'})
      };

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
  });

  var auth = buildAuthMiddleware(dreadnot.config.login_required);

  exports.registerPublic(baton, app);
  exports.registerPrivate(baton, app, auth);
  exports.registerAPI(app);
  exports.registerSocketIO(baton, app);


  log.info('running web server', {port: port});
  app.listen(port);
};
