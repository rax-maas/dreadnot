/*!
 * Connect - FileSystem
 * Copyright(c) 2011 tnantoka <bornneet@livedoor.com>
 * MIT Licensed
 * forked from https://github.com/visionmedia/connect-redis 
 */

/**
 * Module dependencies.
 */

var fs = require('fs');
var path = require('path');
var events = require('events');

/**
 * One day in seconds.
 */

var oneDay = 86400;

/**
 * Return the `FSStore` extending `connect`'s session Store.
 *
 * @param {object} connect
 * @return {Function}
 * @api public
 */

module.exports = function(connect){

  /**
   * Connect's Store.
   */

  var Store = connect.session.Store;

  /**
   * Initialize FSStore with the given `options`.
   *
   * @param {Object} options
   * @api public
   */

  function FSStore(options) {
    options = options || {};
    Store.call(this, options);

    this.client = new events.EventEmitter();
    var self = this;

    this.dir = options.dir || './sessions';

    fs.stat(this.dir, function(err, stats) {
      // errno=2, 32: ENOENT, No such file or directory is not an error.
      if (err && err.errno != 2 && err.errno != 32) throw err;
      if (stats && stats.isDirectory()) {
        self.client.emit('connect');
      } else {
        fs.mkdir(self.dir, 0755, function(err) {
          if (err) throw err;
          self.client.emit('connect');
        });
      }
    });
  }
  
  /**
   * Inherit from `Store`.
   */

  FSStore.prototype.__proto__ = Store.prototype;

  /**
   * Attempt to fetch session by the given `sid`.
   *
   * @param {String} sid
   * @param {Function} fn
   * @api public
   */

  FSStore.prototype.get = function(sid, fn){
    var now = new Date().getTime();
    fs.readFile(path.join(this.dir, sid + '.json'), 'UTF-8', function(err, data) {
        // errno=2, 32: ENOENT, No such file or directory is not an error.
        if (err && err.errno != 2 && err.errno != 32) throw err;
        // AssesionError occurs !?
        //console.log(sid);
        //console.log(err);
        //try {
          if (!data) {
            // no session file
            if (err) return fn();
            // something wrong
            else return fn('something wrong');
          }
          data = JSON.parse(data);
          if (data.expired < now) {
            return fn();
          } else {
            delete data.expired;
            fn(null, data);
          }
        //} catch (e) {
        //  fn(e);
        //}
      }
    );
  };


  /**
   * Commit the given `sess` object associated with the given `sid`.
   *
   * @param {String} sid
   * @param {Session} sess
   * @param {Function} fn
   * @api public
   */

  FSStore.prototype.set = function(sid, sess, fn) {
    try {
      var maxAge = sess.cookie.maxAge;
      var now = new Date().getTime();
      var expired = maxAge ? now + maxAge : now + oneDay;
      sess.expired = expired;
      sess = JSON.stringify(sess);

      fs.writeFile(path.join(this.dir, sid + '.json'), sess, function(err) {
//        if (fn) fn.apply(this, arguments);
        if (fn) {
          if (err) fn(err);
          fn(null, true);
        }
      });
    } catch (e) {
      if (fn) fn(e);
    }
  };


  /**
   * Destroy the session associated with the given `sid`.
   *
   * @param {String} sid
   * @api public
   */

  FSStore.prototype.destroy = function(sid, fn){
    fs.unlink(path.join(this.dir, sid + '.json'), fn);
  };


  /**
   * Fetch number of sessions.
   *
   * @param {Function} fn
   * @api public
   */

  FSStore.prototype.length = function(fn){
    fs.readdir(this.dir, function(err, files) {
      if (err) fn(err);
      var length = 0;
      for (var i = 0; i < files.length; i++) {
        if (/\.json$/.test(files[i])) {
          length++;
        }
      }
      fn(null, length);
    });
  };


  /**
   * Clear all sessions.
   *
   * @param {Function} fn
   * @api public
   */

  FSStore.prototype.clear = function(fn){
    var self = this;
    var count = 0;
    this.length(function(err, length) {
      fs.readdir(self.dir, function(err, files) {
        if (err) fn(err);
        for (var i = 0; i < files.length; i++) {
          if (/\.json$/.test(files[i])) {
            fs.unlink(path.join(self.dir, files[i]), function(err) {
              if (err) fn(err);
              if (++count == length) fn(null, true);
            });
          }
        }
      });
    });
  };

  return FSStore;
};
