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

var ValidationFailureError = require('./errors').ValidationFailureError;



/**
 * @constructor
 * arbitrary unsigned integer.  I haven't taken pains to make it time or space efficient. I just focused on getting
 * the operations right.
 * todo: operations could be optimized to be more space-efficient.
 * @param {int} sz number of bytes.
 * @param {int} val initial value of this Uint. Mind your mannars.
 */
function Uint(sz, val) {
  val = val || 0;
  if (sz < 1) {
    throw new Error('Ints must be at least one byte');
  }
  this.sz = sz;
  this.buf = new Buffer(sz);

  // if val is > 32 bits, we'll be doing a disservice by performing bitwise operations on it.  Use successive
  // subtraction to determine which bits are asserted.
  var cur = 0,
      i = 0,
      pow = 0;
  for (i = 0; i < this.sz * 8; i++) {
    pow = Math.pow(2, this.sz * 8 - i - 1);
    cur <<= 1;

    if (val - pow >= 0) {
      val -= pow;
      cur |= 1;
    }

    // if we've cross a byte boundary, set the byte and initialize for the next one.
    if ((i - 7) % 8 === 0) {
      this.buf[Math.floor(i / 8)] = cur;
      cur = 0;
    }
  }
}


/**
 * @return {string} a hex formatted version of this uint.
 */
Uint.prototype.hexValue = function() {
  var hex = '',
      i = 0,
      str = null;
  for (i = 0; i < this.sz; i++) {
    str = this.buf[i].toString(16);
    while (str.length < 2) {
      str = '0' + str;
    }
    hex += str;
  }
  return hex;
};


/**
 * @param {string} sep (optional) optional field used to separate every byte.
 * @return {string} binary formatted version of this uint.
 */
Uint.prototype.binaryValue = function(sep) {
  sep = sep || '';
  var bin = '',
      i = 0,
      str = null;
  for (i = 0; i < this.sz; i++) {
    str = this.buf[i].toString(2);
    while (str.length < 8) {
      str = '0' + str;
    }
    bin += str + sep;
  }
  return bin.trim();
};


/**
 * shifts zeros into the bits in a buffer.
 * @param {Buffer} buf the buffer to shift.
 * @param {int} num number of bits to shift.
 * @param {boolean} isLeft a shift is either left or right.
 */
function shiftBuf(buf, num, isLeft) {
  if (num === 0) {
    return;
  } else {
    num = num || 1;
  }

  // break big shifts into a series of little shifts.
  while (num > 8) {
    shiftBuf(buf, 8, isLeft);
    num -= 8;
  }

  var next = 0,
      cur = 0,
      i = 0;
  for (i = 0; i < buf.length; i++) {
    if (isLeft) {
      cur = (buf[buf.length - 1 - i] << num) | next;
      next = buf[buf.length - 1 - i] >>> (8 - num);
      buf[buf.length - 1 - i] = cur;
    } else {
      cur = (buf[i] >>> num) | next;
      next = buf[i] << (8 - num);
      buf[i] = cur;
    }
  }
}


/**
 * shifts zeros in from the left.
 * @param {int} num number of bits to shift.
 * @return {Uint} the shifted result.
 */
Uint.prototype.shiftLeft = function(num) {
  var twin = this.clone();
  shiftBuf(twin.buf, num, true);
  return twin;
};


/**
 * shifts zeros in from the right.
 * @param {int} num number of bits to shift.
 * @return {Uint} the shifted result.
 */
Uint.prototype.shiftRight = function(num) {
  var twin = this.clone();
  shiftBuf(twin.buf, num, false);
  return twin;
};


/**
 * @return {Number} JS number format of this uint.  Remember, the coach turns into a pumpkin at 2^52.
 */
Uint.prototype.intValue = function() {
  // don't use bit operations on val here, else you lose precision at 32 bits.
  // this method still craps out after 52 bits, but hey: we're working with IEEE754 floats.
  var val = 0,
      i = 0,
      bite = 0;
  for (i = 0; i < 8 * this.sz; i++) {
    bite = this.buf[Math.floor(i / 8)];
    bite <<= (i % 8);
    bite &= 0x00ff;
    bite >>>= 7;
    if (bite > 0) {
      val += Math.pow(2, 8 * this.sz - i - 1);
    }
  }
  return val;
};


/**
 * clone this uint.
 * @param {int} sz number of bytes to have in the returned uint.
 * @return {Uint} copy of this.
 */
Uint.prototype.clone = function(sz) {
  sz = sz || this.sz;
  var uint = new Uint(sz, 0);
  // make sure to account for smaller and larger dest buffers.
  this.buf.copy(uint.buf, sz > this.sz ? sz - this.sz : 0, Math.max(this.sz - sz, 0), this.sz);
  return uint;
};


/**
 * slice a few bits from this out into a new uint.
 * @param {int} start bit offset to start at.
 * @param {int} length number of bits to copy.
 * @return {Uint} slice of this.
 */
Uint.prototype.sliceBits = function(start, length) {
  var uint = this.shiftLeft(start);
  uint = uint.shiftRight(this.sz * 8 - length);
  return uint;
};

function safeGet(ui, idx) {
  if (idx < 0 || idx >= ui.sz) {
    return 0;
  } else {
    return ui.buf[idx];
  }
}


/**
 * perform a bitwise AND of two uints.
 * @param {Uint} uint to AND to this.
 * @return {Uint} return of AND operation.
 */
Uint.prototype.and = function(uint) {
  var twin = this.clone(),
      i = 0;
  for (i = 0; i < Math.min(uint.sz, this.sz); i++) {
    twin.buf[twin.sz - i - 1] &= uint.buf[uint.sz - i - 1];
  }
  return twin;
};


/**
 * perform a bitwise OR or two uints.
 * @param {Uint} uint to OR to this.
 * @return {Uint} return of OR operation.
 */
Uint.prototype.or = function(uint) {
  var twin = this.clone(),
      i = 0;
  for (i = 0; i < Math.min(uint.sz, this.sz); i++) {
    twin.buf[twin.sz - i - 1] |= uint.buf[uint.sz - i - 1];
  }
  return twin;
};


/**
 * Check whether a bit is asserted.
 * @param {Number} bit The bit to check.
 * @return {bool} Whether the bit is asserted.
 */
Uint.prototype.isBitAsserted = function(bit) {
  if (bit >= this.sz * 8) {
    return false;
  } else {
    return (this.buf[Math.floor(bit / 8)] & (1 << (7 - (bit % 8)))) !== 0;
  }
};


/**
 * add two uints.
 * @param {Uint} uint number to be added.
 * @return {Uint} result of addition.
 */
Uint.prototype.add = function(uint) {
  var added = new Uint(Math.max(uint.sz, this.sz)),
      carry = 0,
      i = 0,
      val = 0;
  for (i = 0; i < added.sz; i++) {
    val = safeGet(this, this.sz - i - 1) + safeGet(uint, uint.sz - i - 1) + carry;
    if (val > 255) {
      carry = 1;
      val -= 256;
    } else {
      carry = 0;
    }
    added.buf[added.sz - i - 1] = val;
  }
  if (carry !== 0) {
    throw new Error('Overflow. carry wasn\'t zero.');
  }
  return added;
};


/**
 * subtraction. in the case of underflow, it just returns -1.
 * @param {Uint} uint number to subtract.
 * @return {Uint} result of subtraction, or -1 if result would be negative.
 */
Uint.prototype.subtract = function(uint) {
  var subtracted = new Uint(Math.max(uint.sz, this.sz)),
      carry = 0,
      i = 0,
      val = 0;

  for (i = 0; i < subtracted.sz; i++) {
    val = safeGet(this, this.sz - i - 1) - safeGet(uint, uint.sz - i - 1) - carry;
    if (val < 0) {
      carry = 1;
      val += 256;
    } else {
      carry = 0;
    }
    subtracted.buf[subtracted.sz - i - 1] = val;
  }
  if (carry !== 0) {
    return -1;
  } else {
    return subtracted;
  }
};


/**
 * Divide this value by another.
 * @param {Uint} uint The number to divide by.
 * @return {Uint} The resulting value.
 */
Uint.prototype.divideBy = function(uint) {
  var sigbits = uint.sz * 8,
      shifter = uint.clone(),
      one = new Uint(uint.sz, 1),
      zero = new Uint(uint.sz, 0),
      res = new Uint(uint.sz, 0),
      accum, diff, i;

  while (!shifter.isBitAsserted(0)) {
    shifter = shifter.shiftLeft(1);
    sigbits -= 1;
  }

  accum = this.sliceBits(0, sigbits);

  for (i = 0; i < uint.sz * 8 - sigbits + 1; i += 1) {
    diff = accum.clone().subtract(uint);
    if (diff === -1) {
      res = res.shiftLeft(1).add(zero);
      accum = accum.shiftLeft(1).add(this.isBitAsserted(sigbits + i) ? one : zero);
    } else {
      res = res.shiftLeft(1).add(one);
      accum = diff.shiftLeft(1).add(this.isBitAsserted(sigbits + i) ? one : zero);
    }
  }

  return res;
};


/** an unsigned integer constructor */
exports.Uint = Uint;


/**
 * returns a randon unint
 * @param {int} sz number of bytes to use.
 * @return {Uint} a random unsigned integer.
 */
Uint.random = function(sz) {
  var uint = new Uint(sz, 0),
      i = 0;
  for (i = 0; i < sz; i++) {
    uint.buf[i] = (Math.round(Math.random() * 10000)) % 256;
  }
  return uint;
};

// millis at 00:00:00.000 15 Oct 1582.
var START_EPOCH = -12219292800000;

var versionMask = new Uint(2, 4096); // 0x1000.

// we use a variant code of 0b10 in accordance with RFC 4122
var variantCode = new Uint(1, 0x80);

// we use the least significant 14 bits of clock
var clock = Uint.random(2);

var node = Uint.random(6);
var lastNanos = 0;
var lastNanoBuf = new Uint(8, 0);
var lastTs = 0;

// compute the nanosecond period portion to be used with a time uuid.  detect when the same period is used and add
// a small offset.
function nanos(ts) {
  // if we're going back in time, reset lastNanos. reset the clock too to ensure that different uuids get generated.
  if (ts < lastTs) {
    clock = Uint.random(2);
    lastNanos = 0;
    lastNanoBuf = new Uint(8, 0);
  }
  var nanosSince = (ts - START_EPOCH);
  if (nanosSince > lastNanos) {
    // time step has changed. we can reset.
    lastNanos = nanosSince;
    lastNanoBuf = new Uint(8, 0);
    // multiply nanosSince by 10000. converting to an int here would lose precistion, so use the shift and add method.
    // fwiw, the shifts are derived from the powers of 2 that sum to 10000.
    [4, 8, 9, 10, 13].forEach(function(shift) {
      lastNanoBuf = lastNanoBuf.add(new Uint(8, nanosSince).shiftLeft(shift));
    });
  } else {
    // increment by 1 so that a different timestamp is used.
    lastNanoBuf = lastNanoBuf.add(new Uint(1, 1));
  }
  lastTs = ts;
  return lastNanoBuf;
}



/** @constructor creates an empty uuid */
function UUID() {
  // does nothing.
}


/**
 * creates a time UUID based on the current timestamp.
 * @param {Number} ts timestamp to base UUID from.
 * @return {UUID} a uuid based on the current time.
 */
function uuidFromTimestamp(ts) {
  ts = ts || Date.now();
  var uuid = new UUID(),
      // pro-tip: don't be calling intValue() in time, you'll lose precision!
      time = nanos(ts);
  uuid.timeLo = time.sliceBits(32, 32).clone(4); // 4 bytes
  uuid.timeMid = time.sliceBits(16, 16).clone(2); // 2 bytes
  uuid.timeHiAndVersion = time.sliceBits(0, 16).clone(2).or(versionMask); // 2 bytes
  uuid.clockSeqHiAndReserved = clock.sliceBits(2, 6).clone(1).or(variantCode); // 1 byte
  uuid.clockSeqLo = clock.sliceBits(8, 8).clone(1); // 1 byte
  uuid.nodeId = node.clone(6); // 6 bytes
  return uuid;
}


/**
 * For a given timestamp generate a UUID that Cassandra will consider to be the
 * 'lowest' possible for that timestamp. This is useful on the low end of
 * inclusive range queries.
 * @param {Number} ts Timestamp to create the UUID from.
 * @return {UUID} A UUID based on the specified time.
 */
function lowUUIDFromTimestamp(ts) {
  var uuid = uuidFromTimestamp(ts);
  uuid.clockSeqHiAndReserved = variantCode.clone(1);
  uuid.clockSeqLo = new Uint(1, 0);
  uuid.nodeId = new Uint(6, 0);
  return uuid;
}


/**
 * For a given timestamp generate a UUID that Cassandra will consider to be the
 * 'highest' possible for that timestamp. This is useful on the high end of
 * inclusive range queries.
 * @param {Number} ts Timestamp to create the UUID from.
 * @return {UUID} A UUID based on the specified time.
 */
function highUUIDFromTimestamp(ts) {
  var uuid = uuidFromTimestamp(ts),
      maxedLowClock = new Uint(1, 0x3F);
  uuid.clockSeqHiAndReserved = maxedLowClock.or(variantCode);
  uuid.clockSeqLo = new Uint(1, 0xFF);
  uuid.nodeId = new Uint(6, 0xFFFFFFFFFFFF);
  return uuid;
}


/**
 * creates a time UUID from a 16-byte buffer.
 * @param {Buffer} buffer 16 bytes of data.
 * @return {UUID} a uuid generated from the buffer.
 */
function uuidFromBuffer(buffer) {
  var uuid = new UUID(),
      i = 0;

  if (!Buffer.isBuffer(buffer)) {
    // Already a buffer
    return buffer;
  }

  // 0xFFFFFFFF00000000 time_low
  uuid.timeLo = new Uint(4, 0);
  for (i = 0; i < 4; i++) {
    uuid.timeLo = uuid.timeLo.shiftLeft(8).or(new Uint(1, buffer[i]));
  }

  // 0x00000000FFFF0000 time_mid
  uuid.timeMid = new Uint(2, 0);
  for (i = 0; i < 2; i++) {
    uuid.timeMid = uuid.timeMid.shiftLeft(8).or(new Uint(1, buffer[i + 4]));
  }

  // 0x000000000000F000 version
  // 0x0000000000000FFF time_hi
  uuid.timeHiAndVersion = new Uint(2, 0);
  for (i = 0; i < 2; i++) {
    uuid.timeHiAndVersion = uuid.timeHiAndVersion.shiftLeft(8).or(new Uint(1, buffer[i + 6]));
  }

  // ls long
  // 0xC000000000000000 variant
  // 0x3FFF000000000000 clock_seq
  uuid.clockSeqHiAndReserved = new Uint(1, buffer[8]);
  uuid.clockSeqLo = new Uint(1, buffer[9]);

  // 0x0000FFFFFFFFFFFF node
  uuid.nodeId = new Uint(6, 0);
  for (i = 0; i < 6; i++) {
    uuid.nodeId = uuid.nodeId.shiftLeft(8).or(new Uint(1, buffer[i + 10]));
  }
  return uuid;
}


/**
 * Creates a time UUID from a UUID string
 * @param {String} str The UUID string.
 * @return {UUID} a UUID generated from the string.
 */
function uuidFromString(str) {
  var uuid = new UUID(),
      timeLoStr = str.slice(0, 8),
      timeMidStr = str.slice(9, 13),
      timeHiAndVersionStr = str.slice(14, 18),
      clockSeqHiAndReservedStr = str.slice(19, 21),
      clockSeqLoStr = str.slice(21, 23),
      nodeIdStr = str.slice(24, 36);

  uuid.timeLo = new Uint(4, parseInt(timeLoStr, 16));
  uuid.timeMid = new Uint(2, parseInt(timeMidStr, 16));
  uuid.timeHiAndVersion = new Uint(2, parseInt(timeHiAndVersionStr, 16));
  uuid.clockSeqHiAndReserved = new Uint(1, parseInt(clockSeqHiAndReservedStr, 16));
  uuid.clockSeqLo = new Uint(1, parseInt(clockSeqLoStr, 16));
  uuid.nodeId = new Uint(6, parseInt(nodeIdStr, 16));

  return uuid;
}


/**
 * Attempt to validate a version 1 UUID string going to Cassandra.
 * @param {String} str A UUID string to attempt to validate.
 * @throws {ValidationFailureError} A validation error.
 */
function validateUUIDString(str) {
  if (!str.match(/^[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}$/)) {
    throw new ValidationFailureError('Invalid UUID');
  } else if ((parseInt(str.charAt(19), 16) & 12) !== 8) {
    throw new ValidationFailureError('Unsupported UUID variant');
  } else if (str.charAt(14) !== '1') {
    throw new ValidationFailureError('UUID is not version 1');
  }
}


/**
 * <time low> - <time mid> - <time high and version> - <var seq> - <node>.
 * @return {String} standard UUID formatted string.
 */
UUID.prototype.toString = function() {
  return this.timeLo.hexValue() + '-' +
         this.timeMid.hexValue() + '-' +
         this.timeHiAndVersion.hexValue() + '-' +
         this.clockSeqHiAndReserved.hexValue() + this.clockSeqLo.hexValue() + '-' +
         this.nodeId.hexValue();
};


/**
 * Retrieve the timestamp of a uuid.
 * @return {Number} The timestamp in milliseconds.
 */
UUID.prototype.getTimestamp = function() {
  var timeInNs = new Uint(8, 0), timeInMs;

  timeInNs = timeInNs.or(this.timeHiAndVersion.clone(2).and(new Uint(8, 4095)));
  timeInNs = timeInNs.shiftLeft(16).or(this.timeMid.clone(2));
  timeInNs = timeInNs.shiftLeft(32).or(this.timeLo.clone(4));

  timeInMs = timeInNs.divideBy(new Uint(8, 10000));

  return timeInMs.intValue() + START_EPOCH;
};


/** UUID class. */
exports.UUID = UUID;


/** UUID constuctor */
exports.uuidFromTimestamp = uuidFromTimestamp;


/** Generate a low selector uuid */
exports.lowUUIDFromTimestamp = lowUUIDFromTimestamp;


/** Generate a high selector uuid */
exports.highUUIDFromTimestamp = highUUIDFromTimestamp;


/** Attempt to validate a UUID string */
exports.validateUUIDString = validateUUIDString;


/** creates a uuid from a byte buffer */
exports.uuidFromBuffer = uuidFromBuffer;


/** creates a uuid from a uuid string */
exports.uuidFromString = uuidFromString;
