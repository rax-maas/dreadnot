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

var sprintf = require('sprintf').sprintf;


/**
 * Regular expression object cache.
 * @type {Object}.
 */
var REGEXP_CACHE = {};


/**
 * Figure the boolean XOR function, since JavaScript doesn't have it.
 * @param {Boolean} a First param.
 * @param {Boolean} b Second param.
 * @return {Boolean} Logical XOR.
 */
exports.logicalXOR = function(a, b) {
  return ((a || b) && !(a && b));
};


/**
 * Generate a random number between lower and upper bound.
 *
 * @param {Number} min Lower bound.
 * @param {Number} max Upper bound.
 * @return {Number} Random number between lower and upper bound.
 */
exports.getRandomInt = function(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};


/**
 * Generate a random string of upper lower case letters and decimal digits.
 *
 * @param {Number} len  The length of the string to return;.
 * @return {String} Random string.
 */
exports.randstr = function(len) {
  var chars, r, x;

  chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  r = [];

  for (x = 0; x < len; x++) {
    r.push(chars[exports.getRandomInt(0, chars.length - 1)]);
  }

  return r.join('');
};


/**
 * Trim leading and trailing whitespace from a string.
 *
 * @param {String} text Original String.
 * @return {string} String with trimmed whitespace.
 */
exports.trim = function trim(text) {
  return (text || '').replace(/^\s+|\s+$/g, '');
};


/**
 * Very simple object merging.
 * Merges two or more objects together, returning the first object containing a
 * superset of all attributes.  There is a hiearchy of precedence starting with
 * left side and moving right.
 *
 * @return {Object} The merged object.
 */
exports.fullMerge = function() {
  var args = Array.prototype.slice.call(arguments),
      first,
      a,
      attrname,
      i, l;

  if (args.length < 2) {
    throw new Error('Incorrect use of the API, use at least two operands');
  }

  first = args[0];

  for (i = 1, l = args.length; i < l; i++) {
    a = args[i];
    for (attrname in a) {
      if (a.hasOwnProperty(attrname)) {
        first[attrname] = a[attrname];
      }
    }
  }
  return first;
};


/**
 * Very simple object merging.
 * Merges two objects together, returning a new object containing a
 * superset of all attributes.  Attributes in b are prefered if both
 * objects have identical keys.
 *
 * @param {Object} a Object to merge.
 * @param {Object} b Object to merge, wins on conflict.
 * @return {Object} The merged object.
 */
exports.merge = function(a, b) {
  return exports.fullMerge({}, a, b);
};


/**
 * Returns unique elements in an array.  The elements of the source array
 * should be strings or numbers; the results are undefined if the array
 * contains objects.
 *
 * @param {Array} src Source array.
 * @return {Array} A copy of the source array, with duplicate elements removed.
 */
exports.unique = function(src) {
  var i,
      elem,
      hash = {},
      result = [];

  for (i = 0; i < src.length; i = i + 1) {
    hash[src[i]] = src[i];
  }
  for (elem in hash) {
    if (hash.hasOwnProperty(elem)) {
      result.push(hash[elem]);
    }
  }
  return result;
};


/**
 * Reverse version of the Object.keys method.
 *
 * @param {Object} object from which the values should be extracted.
 * @return {Array} All the values.
 */
exports.getValues = function(object) {
  var key,
      values = [];

  for (key in object) {
    if (object.hasOwnProperty(key)) {
      values.push(object[key]);
    }
  }

  return values;
};


/**
 * Escape characters in a string which Javascript RegExp object considers as special.
 *
 * @param {String} string Input string.
 * @return {String} String with all the special characters escaped.
 */
exports.escapeRegexpString = function(string) {
  var regexp = new RegExp('[.*+?|()\\[\\]{}\\\\\\$]', 'g');

  return string.replace(regexp, '\\$&');
};


/**
 * Prefix a string with (level * chr) indentation characters.
 *
 * @param {String} str String to indent.
 * @param {Number} level Current nesting level.
 * @param {?String} chr Character which is used for indentation. Defaults to
 * 4 spaces ('    ').
 * @return {String} Indented string.
 */
function indent(str, level, chr) {
  chr = chr || '    ';
  var newStr = '', i = 0, j = 0;

  while (i < level) {
    newStr += chr;
    i++;
  }

  newStr += str;
  return newStr;
}


/**
 * Randomly select an IP address and port from a poll of the addresses.
 *
 * @param {Array} addresses An array from which a random member will be
 *                          selected.
 * @return {Array} [ip, address] pair.
 */
function getRandomAddress(addresses) {
  var index = exports.getRandomInt(0, addresses.length - 1),
      address = addresses[index];

  return exports.splitAddress(address);
}


/**
 * Display a backtrace.
 */
exports.backtrace = function() {
  console.log(new Error('Backtrace').stack);
};


/**
 * Reverse of Object.keys.
 *
 * @param {Object} obj Object to reverse.
 * @return {Object} Reversed object.
 */
exports.reverseObject = function(obj) {
  var newObj = {},
      key, value;

  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      value = obj[key];
      newObj[value] = key;
    }
  }

  return newObj;
};


/**
 * Splice and return a random element from an array.
 * @param {Array} elements The array from which to splice.
 * @return {Object} The element spliced from the array.
 */
exports.spliceRandomElement = function(elements) {
  var idx = exports.getRandomInt(0, elements.length - 1);
  return elements.splice(idx, 1)[0];
};


/**
 * Split a host:port address into a host and port. This is basically python's
 * 'rpslit'.
 * @param {String} addr The address to split.
 * @return {Array} A [host, port] pair.
 */
exports.splitAddress = function(addr) {
  var idx = addr.lastIndexOf(':');

  if (idx === -1) {
    throw new Error('Address does not contain a colon (:)');
  }

  return [addr.slice(0, idx), addr.slice(idx + 1)];
};


/**
 * Construct a new object of type klass.
 * @param {Function} klass Class to construct.
 * @param {Array} args Arguments which are passed to the constructor.
 * @return {Object} A new instance of 'klass'.
 */
exports.construct = function(klass, args) {
  var obj = Object.create(klass.prototype);
  klass.apply(obj, args);
  return obj;
};


/**
 * indent function.
 */
exports.indent = indent;


/**
 * getRandomAddress function.
 */
exports.getRandomAddress = getRandomAddress;


function strip(str) {
  return str.replace(/^\s+|\s+$/g, '');
}


/** Convert arguments from the commandline to a javascript object
 *
 * @param {Object} args an array of parameters.
 * @return {Object} a converted object.
 */
exports.argsToObject = function(args) {
  var obj = {}, tmp, v, i, key, t;

  args.forEach(function(data) {
    /* parse for key/value pairs */
    v = data.split('=');
    key = strip(v[0]);
    if (v[1][0] === '[') {
      /* arrays */
      tmp = v[1].substring(1, v[1].length - 1).split(',');
      obj[key] = [];
      for (i = 0; i < tmp.length; i++) {
        /* strip string and push onto the array */
        obj[key].push(strip(tmp[i]));
      }
    } else if (v[1][0] === '{') {
      /* arrays */
      tmp = v[1].substring(1, v[1].length - 1).split(',');
      obj[key] = {};
      for (i = 0; i < tmp.length; i++) {
        t = tmp[i].split(':');
        /* strip string and push onto the array */
        obj[key][strip(t[0])] = strip(t[1]);
      }
    } else {
      /* parse for key value pairs */
      obj[key] = strip(v[1]);
    }
  });
  return obj;
};


/**
 * convert a buffer to a 32bit uint
 * @param {Buffer} buffer to operate on.
 * @param {Int} offset start the buffer on.
 * @param {String} endian to use during conversion.
 * @return {Int} val the value.
 */
exports.bufferToUint32 = function(buffer, offset, endian) {
  var val;

  if (endian === 'big') {
    val = buffer[offset + 1] << 16;
    val |= buffer[offset + 2] << 8;
    val |= buffer[offset + 3];
    val = val + (buffer[offset] << 24 >>> 0);
  } else {
    val = buffer[offset + 2] << 16;
    val |= buffer[offset + 1] << 8;
    val |= buffer[offset];
    val = val + (buffer[offset + 3] << 24 >>> 0);
  }
  return val;
};


/**
 * convert a 32bit int to a buffer
 * @param {Int} value to convert to buffer.
 * @param {Buffer} buffer to operate on.
 * @param {Int} offset start the buffer on.
 * @param {String} endian to use during conversion.
 */
exports.uint32ToBuffer = function(value, buffer, offset, endian) {
  if (endian === 'big') {
    buffer[offset] = (value >>> 24) & 0xff;
    buffer[offset + 1] = (value >>> 16) & 0xff;
    buffer[offset + 2] = (value >>> 8) & 0xff;
    buffer[offset + 3] = value & 0xff;
  } else {
    buffer[offset + 3] = (value >>> 24) & 0xff;
    buffer[offset + 2] = (value >>> 16) & 0xff;
    buffer[offset + 1] = (value >>> 8) & 0xff;
    buffer[offset] = value & 0xff;
  }
};


/** XML Escape a String.
 * @param {String} str The string for convert.
 * @return {String} The converted string.
 */
exports.escapeXML = function(str) {
  return str.replace('"', '&quote;')
    .replace('\'', '&apos;')
    .replace('<', '&lt;')
    .replace('>', '&gt;')
    .replace('&', '&amp;');
};


/**
 * Return unix timestamp
 *
 * @param  {Date} date Date object to convert to Unix timestamp. If no date is
                       provided, current time is used.
 * @return {Number} Number of seconds passed from Unix epoch.
 */
exports.getUnixTimestamp = function(date) {
  var dateToFormat = date || new Date();

  return Math.round(dateToFormat / 1000);
};


/**
 * Convert a date string to unix timestamp.
 *
 * @param {String} dateStr Date and time string.
 * @return {Number} Number of seconds since unix epoch.
 */
exports.dateStrToUnixTimestamp = function(dateStr) {
  return Math.round((Date.parse(dateStr) / 1000));
};


/** Functions bellow are take from Nodejs code base. */


/**
 * Check if two objects are equal.
 *
 * @param {Object|Array} a Object 1.
 * @param {Object|Array} b Object 2.
 * @return {Boolean} true / false.
 */
exports.deepEqual = function deepEqual(a, b) {
  var i;

  // 7.1. All identical values are equivalent, as determined by ===.
  if (a === b) {
    return true;

  } else if (Buffer.isBuffer(a) && Buffer.isBuffer(b)) {
    if (a.length !== b.length) {
      return false;
    }

    for (i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }

    return true;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();

  // 7.3. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (typeof a !== 'object' && typeof b !== 'object') {
    return a === b;

  // 7.4. For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return exports.objEquiv(a, b);
  }
};


/**
 * Check if value is null or undefined.
 *
 * @param {*} value Value to check.
 * @return {Boolean} true / false.
 */
function isUndefinedOrNull(value) {
  return value === null || value === undefined;
}


/**
 * Check if object is an arguments object.
 *
 * @param {Object} object Object to check.
 * @return {Boolean} true / false.
 */
function isArguments(object) {
  return Object.prototype.toString.call(object) === '[object Arguments]';
}


/**
 * Check if two objects are equal.
 *
 * @param {Object|Array} a Object 1.
 * @param {Object|Array} b Object 2.
 * @return {Boolean} true / false.
 */
exports.objEquiv = function objEquiv(a, b) {
  var ka, kb, key, i;

  if (isUndefinedOrNull(a) || isUndefinedOrNull(b)) {
    return false;
  }

  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) {
    return false;
  }

  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = Array.prototype.slice.call(a);
    b = Array.prototype.slice.call(b);
    return exports.deepEqual(a, b);
  }
  try {
    ka = Object.keys(a);
    kb = Object.keys(b);
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length !== kb.length) {
    return false;
  }

  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] !== kb[i]) {
      return false;
    }
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!exports.deepEqual(a[key], b[key])) {
      return false;
    }
  }
  return true;
};


/**
 * Quote a string so it can be used in the shell command.
 *
 * @param {String} string String to quote.
 * @return {String} Quoted string.
 */
exports.shellQuote = function(string) {
  var quoted;

  if (typeof string !== 'string') {
    string = string.toString();
  }

  quoted = "'" + string.replace(/'/g, '"\'"') + "'";
  return quoted;
};


/**
 * Change a hash to a sorted list of objects with name, value as the attributes.
 * @param {Object} hash to operate on.
 * @return {List} an array of sorted hashes.
 */
exports.sortHash = function(hash) {
  var keys, i, l,
      container = [];

  keys = Object.keys(hash).sort();
  for (i = 0, l = keys.length; i < l; i++) {
    container[i] = { name: keys[i], value: hash[keys[i]] };
  }
  return container;
};


/**
 * prints and sets an exit code for nagios checks..
 * @param {String} service name of the process.
 * @param {String} state of the process, OK, WARNING, CRITICAL, UNKNOWN.
 * @param {String} msg about the service claim.
 */
exports.printStatusAndExit = function(service, state, msg) {
  var exitCode = 0;

  console.log('%s %s %s', state, service, msg.substring(0, 70));

  if (state === 'OK') {
    exitCode = 0;
  }
  else if (state === 'WARNING') {
    exitCode = 1;
  }
  else if (state === 'CRITICAL') {
    exitCode = 2;
  }
  else {
    exitCode = 3;
  }

  process.exit(exitCode);
};


/**
 * Return RFC3339 date string.
 *
 * @param {Date} date Date object.
 * @return {String} RFC339 formatted date string.
 */
exports.toRfc3339Date = function(date) {
  var str, values;

  function addZero(num) {
    if (num < 10) {
      return '0' + num;
    }

    return num;
  }

  values = {
    'year': date.getUTCFullYear(),
    'month': addZero(date.getUTCMonth() + 1),
    'day': addZero(date.getUTCDate()),
    'hours': addZero(date.getUTCHours()),
    'minutes': addZero(date.getUTCMinutes()),
    'seconds': addZero(date.getUTCSeconds())
  };

  return sprintf('%(year)s-%(month)s-%(day)sT%(hours)s:%(minutes)s:%(seconds)sZ', values);
};


/**
 * Bind a string with the provided values.
 *
 * @param {Object} placeholderMap Object which maps key in the values Object to
 * the placeholder name.
 * @param {String} string String to bind.
 * @param {Object} values Object with the values used for binding.
 * @return {String} bound string.
 */
exports.bindString = function bindString(placeholderMap, string, values) {
  var key, placeholder, value, regexp;

  for (key in values) {
    if (values.hasOwnProperty(key)) {
      placeholder = placeholderMap[key];
      value = values[key];

      if (!REGEXP_CACHE.hasOwnProperty(key)) {
        REGEXP_CACHE[key] = new RegExp(exports.escapeRegexpString(placeholder), 'g');
      }

      regexp = REGEXP_CACHE[key];

      string = string.replace(regexp, value);
    }
  }

  return string;
};


/**
 * Convert a string from underscore separated to camelCase format.
 *
 * @param {String} string String to convert.
 * @return {String} Converted string.
 */
exports.toCamelCase = function toCamelCase(string) {
  var components = string.split('_'), i = 0, result = string;

  if (components.length > 0) {
    result = '';
    components.forEach(function(component) {
      if (i === 0) {
        result += component;
      } else {
        result += component[0].toUpperCase() + component.slice(1);
      }
      i++;
    });
  }

  return result;
};
