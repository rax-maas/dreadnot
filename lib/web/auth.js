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

var crypto = require('crypto');
var fs = require('fs');

var AP_MD5PW_ID  = "$apr1$";

var ITOA64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

var TUPLES = [
  [0, 6, 12],
  [1, 7, 13],
  [2, 8, 14],
  [3, 9, 15],
  [4, 10, 5],
];


function AuthDB(users) {
  this.users = users;
}


AuthDB.prototype.validate = function(username, password, callback) {
  if (!this.users[username]) {
    callback(null, false);
  } else if (this.users[username].indexOf('{SHA}') === 0) {
    callback(null, this._validateSHA(password, this.users[username]));
  } else if (this.users[username].indexOf('$apr1$') === 0) {
    callback(null, this._validateMD5(password, this.users[username]));
  } else {
    callback(null, false);
  }
};


AuthDB.prototype._validateSHA = function(password, hash) {
  return sha1crypt(password) === hash;
};


AuthDB.prototype._validateMD5 = function(password, hash) {
  var all = hash.split('$');
  return md5crypt(password, all[2], '$apr1$') === hash;
};


AuthDB.prototype.updateUsers = function(users) {
  this.users = users;
};

function sha1crypt(password) {
  return '{SHA}' + crypto.createHash('sha1').update(password).digest('base64');
}



// Ported to javascript from http://code.activestate.com/recipes/325204-passwd-file-compatible-1-md5-crypt/
function md5crypt(password, salt, magic) {
  var rearranged = '',
      mixin, final, m, v, i;

  m = crypto.createHash('md5');
  m.update(password + magic + salt);
  mixin = crypto.createHash('md5').update(password + salt + password).digest("binary");

  for (i = 0; i < password.length; i++) {
    m.update(mixin[i % 16]);
  }

  // Weird shit..
  for (i = password.length; i > 0; i >>= 1) {
    if (i & 1) {
      m.update('\x00');
    } else {
      m.update(password[0]);
    }
  }

  final = m.digest("binary");

  // Slow it down there...
  for (i = 0; i < 1000; i ++) {
    m = crypto.createHash('md5');

    if (i & 1) {
      m.update(password);
    } else {
      m.update(final);
    }

    if (i % 3) {
      m.update(salt);
    }

    if (i % 7) {
      m.update(password);
    }

    if (i & 1) {
      m.update(final);
    } else {
      m.update(password);
    }

    final = m.digest("binary");
  }


  for (i = 0; i < TUPLES.length; i++) {
    v = final.charCodeAt(TUPLES[i][0]) << 16 | final.charCodeAt(TUPLES[i][1]) << 8 | final.charCodeAt(TUPLES[i][2]);
    rearranged += ITOA64[v & 0x3f]; v >>= 6;
    rearranged += ITOA64[v & 0x3f]; v >>= 6;
    rearranged += ITOA64[v & 0x3f]; v >>= 6;
    rearranged += ITOA64[v & 0x3f]; v >>= 6;
  }

  v = final.charCodeAt(11);
  rearranged += ITOA64[v & 0x3f]; v >>= 6;
  rearranged += ITOA64[v & 0x3f]; v >>= 6;

  return magic + salt + '$' + rearranged;
}

function getUsers(filePath) {
  var contents = fs.readFileSync(filePath, 'utf-8'),
      users = {},
      lines, both, i;

  lines = contents.split('\n').map(function(line) {
    return line.trim();
  });

  for (i = 0; i < lines.length; i++) {
    if (lines[i] && lines[i].indexOf('#') !== 0) {
      both = lines[i].split(':');
      users[both[0]] = both[1];
    }
  }
  return users;
}

function loadDBFromFile(filePath) {
  fs.watch(filePath, {
    'persistent': false
  }, process.kill.bind(null, process.pid, 'SIGHUP'));

  var db = new AuthDB(getUsers(filePath));

  process.on('SIGHUP', function() {
    db.updateUsers(getUsers(filePath));
  });

  return db;
}

exports.loadDBFromFile = loadDBFromFile;
