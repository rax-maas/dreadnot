/**
 * Copyright 2011 (c) Trent Mick.
 *
 * LDAP auth.
 *
 * Usage:
 *    var LdapAuth = require('ldapauth');
 *    var auth = new LdapAuth({url: 'ldaps://ldap.example.com:663', ...});
 *    ...
 *    auth.authenticate(username, password, function (err, user) { ... });
 *    ...
 *    auth.close(function (err) { ... })
 */

var assert = require('assert');
var bcrypt = require('bcrypt');
var ldap = require('ldapjs');
var debug = console.warn;
var format = require('util').format;



/**
 * Create an LDAP auth class. Primary usage is the `.authenticate` method.
 *
 * @param opts {Object} Config options. Keys (required, unless says
 *      otherwise) are:
 *    url {String} E.g. 'ldaps://ldap.example.com:663'
 *    adminDn {String} E.g. 'uid=myapp,ou=users,o=example.com'
 *    adminPassword {String} Password for adminDn.
 *    searchBase {String} The base DN from which to search for users by
 *        username. E.g. 'ou=users,o=example.com'
 *    searchFilter {String} LDAP search filter with which to find a user by
 *        username, e.g. '(uid={{username}})'. Use the literal '{{username}}'
 *        to have the given username be interpolated in for the LDAP
 *        search.
 *    log4js {Module} Optional. The require'd log4js module to use for logging.
 *        logging. If given this will result in TRACE-level logging for
 *        ldapauth.
 *    verbose {Boolean} Optional, default false. If `log4js` is also given,
 *        this will add TRACE-level logging for ldapjs (quite verbose).
 *    cache {Boolean} Optional, default false. If true, then up to 100
 *        credentials at a time will be cached for 5 minutes.
 *    timeout {Integer} Optional, default Infinity. How long the client should
 *        let operations live for before timing out.
 *    connectTimeout {Integer} Optional, default is up to the OS. How long the
 *        client should wait before timing out on TCP connections.
 *    tlsOptions {Object} Additional options passed to the TLS connection layer
 *        when connecting via ldaps://. See
 *        http://nodejs.org/api/tls.html#tls_tls_connect_options_callback
 *        for available options
 */
function LdapAuth(opts) {
  this.opts = opts;
  assert.ok(opts.url);
  assert.ok(opts.adminDn);
  assert.ok(opts.searchBase);
  assert.ok(opts.searchFilter);

  this.log = opts.log4js && opts.log4js.getLogger('ldapauth');

  if (opts.cache) {
    var Cache = require('./cache');
    this.userCache = new Cache(100, 300, this.log, 'user');
  }

  var clientOpts = {url: opts.url};
  if (opts.log4js && opts.verbose) {
    clientOpts.log4js = opts.log4js;
  }
  if (opts.timeout) {
    clientOpts.timeout = opts.timeout;
  }
  if (opts.connectTimeout) {
    clientOpts.connectTimeout = opts.connectTimeout;
  }
  if (opts.tlsOptions) {
    clientOpts.tlsOptions = opts.tlsOptions;
  }
  this._adminClient = ldap.createClient(clientOpts);
  this._adminBound = false;
  this._userClient = ldap.createClient(clientOpts);

  this._salt = bcrypt.genSaltSync();
}


LdapAuth.prototype.close = function (callback) {
  if (! this._adminBound) {
    callback()
  } else {
    this._adminClient.unbind(function (err) {
      callback(err);
    });
  }
}


/**
 * Ensure that `this._adminClient` is bound.
 */
LdapAuth.prototype._adminBind = function (callback) {
  if (this._adminBound) {
    return callback();
  }
  var self = this;
  this._adminClient.bind(this.opts.adminDn, this.opts.adminPassword,
                         function (err) {
    if (err) {
      self.log && self.log.trace('ldap authenticate: bind error: %s', err);
      return callback(err);
    }
    return callback();
  });
}


/**
 * Find the user record for the given username.
 *
 * @param username {String}
 * @param callback {Function} `function (err, user)`. If no such user is
 *    found but no error processing, then `user` is undefined.
 *
 */
LdapAuth.prototype._findUser = function (username, callback) {
  var self = this;
  if (!username) {
    return callback("empty username");
  }
  self._adminBind(function (err) {
    if (err)
      return callback(err);

    var searchFilter = self.opts.searchFilter.replace('{{username}}', username);
    var opts = {filter: searchFilter, scope: 'sub'};
    self._adminClient.search(self.opts.searchBase, opts,
                             function (err, result) {
      if (err) {
        self.log && self.log.trace('ldap authenticate: search error: %s', err);
        return callback(err);
      }
      var items = [];
      result.on('searchEntry', function (entry) {
        items.push(entry.object);
      });
      result.on('error', function (err) {
        self.log && self.log.trace(
          'ldap authenticate: search error event: %s', err);
        return callback(err);
      });
      result.on('end', function (result) {
        if (result.status !== 0) {
          var err = 'non-zero status from LDAP search: ' + result.status;
          self.log && self.log.trace('ldap authenticate: %s', err);
          return callback(err);
        }
        switch (items.length) {
        case 0:
          return callback();
        case 1:
          return callback(null, items[0])
        default:
          return callback(format(
            'unexpected number of matches (%s) for "%s" username',
            items.length, username));
        }
      });
    });
  });
}


/**
 *
 */
LdapAuth.prototype.authenticate = function (username, password, callback) {
  var self = this;

  if (self.opts.cache) {
    // Check cache. 'cached' is `{password: <hashed-password>, user: <user>}`.
    var cached = self.userCache.get(username);
    if (cached && bcrypt.compareSync(password, cached.password)) {
      return callback(null, cached.user)
    }
  }

  // 1. Find the user DN in question.
  self._findUser(username, function (err, user) {
    if (err)
      return callback(err);
    if (!user)
      return callback(format('no such user: "%s"', username));
    // 2. Attempt to bind as that user to check password.
    self._userClient.bind(user.dn, password, function (err) {
      if (err) {
        self.log && self.log.trace('ldap authenticate: bind error: %s', err);
        return callback(err);
      }
      if (self.opts.cache) {
        bcrypt.hash(password, self._salt, function (err, hash) {
          self.userCache.set(username, {password: hash, user: user});
          return callback(null, user);
        });
      } else {
        return callback(null, user);
      }
    });
  });
}



module.exports = LdapAuth;
