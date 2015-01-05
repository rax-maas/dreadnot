/*
 * Copyright 2011 Joyent, Inc.  All rights reserved.
 *
 * An expiring LRU cache.
 *
 * Usage:
 *     var Cache = require('amon-common').Cache;
 *                                // size, expiry, log,  name
 *     this.accountCache = new Cache( 100,    300, log, 'account');
 *     this.accountCache.set('hamish', {...});
 *     ...
 *     this.accountCache.get('hamish')    // -> {...}
 */

var debug = console.warn;
var assert = require('assert');
var LRU = require('lru-cache');


/**
 * A LRU and expiring cache.
 *
 * @param size {Number} Max number of entries to cache.
 * @param expiry {Number} Number of seconds after which to expire entries.
 * @param log {log4js Logger} Optional.
 *    All logging is at the Trace level.
 * @param name {string} Optional name for this cache. Just used for logging.
 */
function Cache(size, expiry, log, name) {
  assert.ok(size !== undefined);
  assert.ok(expiry !== undefined);
  this.size = size;
  this.expiry = expiry * 1000;
  this.log = log;
  this.name = (name ? name + ' ' : '');
  this.items = LRU(this.size);
}

// Debugging stuff: .getAll isn't in official lru-cache
//Cache.prototype.getAll = function getAll() {
//  return this.items.getAll();
//}

Cache.prototype.reset = function reset() {
  if (this.log) {
    this.log.trace('%scache reset', this.name);
  }
  this.items.reset();
}

Cache.prototype.get = function get(key) {
  assert.ok(key !== undefined);
  var cached = this.items.get(key);
  if (cached) {
    if (((new Date()).getTime() - cached.ctime) <= this.expiry) {
      if (this.log) {
        this.log.trace('%scache hit: key="%s": %o', this.name, key, cached);
      }
      return cached.value;
    }
  }
  if (this.log) {
    this.log.trace('%scache miss: key="%s"', this.name, key);
  }
  return null;
}

Cache.prototype.set = function set(key, value) {
  assert.ok(key !== undefined);
  var item = {
    value: value,
    ctime: new Date().getTime()
  };
  if (this.log) {
    this.log.trace('%scache set: key="%s": %o', this.name, key, item);
  }
  this.items.set(key, item);
  return item;
}

Cache.prototype.del = function del(key) {
  if (this.log) {
    this.log.trace('%scache del: key="%s"', this.name, key);
  }
  this.items.del(key);
}


module.exports = Cache;
