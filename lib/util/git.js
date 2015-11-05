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

var fs = require('fs');
var path = require('path');

var async = require('async');
var mkdirp = require('mkdirp');

var misc = require('./misc');
var sprintf = require('./sprintf');

var github = require('octonode');


function git(args, callback) {
  args = ['git'].concat(args);
  misc.spawn(args, null, callback);
}


function gitd(repo, args, callback) {
  args = [sprintf('--git-dir=%s/.git', repo), sprintf('--work-tree=%s', repo)].concat(args);
  git(args, callback);
}


exports.refresh = function(repo, url, remote, branch, callback) {
  var ref;

  if (arguments.length === 3) {
    /* (repo, url, callback) */
    callback = remote;
    remote = 'origin';
    branch = 'master';
    ref = sprintf('%s/%s', remote, branch);
  }
  else if (arguments.length === 4) {
    /* (repo, url, ref, callback) */
    ref = remote;
    callback = branch;
    branch = ref;
  }
  else {
    /* (repo, url, remote, branch, callback) */
    ref = sprintf('%s/%s', remote, branch);
  }

  path.exists(repo, function(exists) {
    if (exists) {
      async.series([
        exports.fetch.bind(null, repo),
        exports.checkout.bind(null, repo, branch),
        exports.resetHard.bind(null, repo, ref)
      ], callback);
    } else {
      async.series([
        exports.clone.bind(null, repo, url),
        exports.checkout.bind(null, repo, branch),
        exports.resetHard.bind(null, repo, ref)
      ], callback);
    }
  });
};


exports.hasChanges = function(repo, callback) {
  // When this succeeds but there are changes, it silently exits with code 1
  gitd(repo, ['diff-index', '--quiet', 'HEAD', '--'], function(err) {
    if (err) {
      if (err.message.indexOf('\nstderr:\n\nstdout:\n') < 0) {
        callback(err);
      } else {
        callback(null, true);
      }
    } else {
      callback(null, false);
    }
  });
};

exports.checkout = function(repo, branch, callback) {
  gitd(repo, ['checkout', branch], callback);
};

exports.add = function(repo, addPath, callback) {
  gitd(repo, ['add', addPath], callback);
};


exports.commit = function(repo, message, author, callback) {
  gitd(repo, ['commit', '-m', message, sprintf('--author=%s', author)], callback);
};


exports.push = function(repo, callback) {
  gitd(repo, ['push'], callback);
};


exports.resetHard = function(repo, ref, callback) {
  gitd(repo, ['reset', '--hard', ref], callback);
};


exports.merge = function(repo, ref, callback) {
  gitd(repo, ['merge', ref], callback);
};


exports.fetch = function(repo, callback) {
  gitd(repo, ['fetch'], callback);
};

exports.revParse = function(repo, ref, callback) {
  gitd(repo, ['rev-parse', ref], function(err, stdout) {
    if (err) {
      callback(err);
      return;
    }

    callback(null, stdout.replace(/^\s+|\s+$/g, ''));
  });
};


exports.commitMsg = function(repo, ref, callback) {
  gitd(repo, ['log', ref, '--oneline', '-1'], function(err, stdout) {
    if (err) {
      callback(err);
      return;
    }
    callback(null, stdout.replace(/(^\w{7}\s|\n)/g, ''));
  });
};


exports.clone = function(repo, url, callback) {
  async.series([
    // 0755 = 493
    mkdirp.bind(null, path.dirname(repo), 493),
    git.bind(null, ['clone', url, repo])
    ],
    function(err) {
      callback(err);
  });
};


exports.getLatestRevision = function(url, ref, callback) {
  git(['ls-remote', url, ref], function(err, stdout) {
    if (err) {
      callback(err);
    } else {
      callback(null, stdout.split('\t')[0]);
    }
  });
};


exports.trimRevision = function(rev) {
  return rev.slice(0, 7);
};


// Fetches the SHA of the latest commit, on master if a branch isn't specified.
// Uses the github api via a sdk called octonode, will not work for non github repositories.
exports.gitClientGetSha = function(owner, stackName, username, password, branch, callback) {
  if (typeof branch === 'function') {
    branch = null;
    callback = branch;
  }

  var repoUrl, latest_sha,
      gitClient = github.client({
        username: username,
        password: password
      });

  if (branch) {
    repoUrl = path.join('repos', owner, stackName, 'git', 'refs', 'heads', branch);
    gitClient.get(repoUrl, {}, function(err, status, data, headers) {
      if (err) {
        return callback(err);
      }

      latest_sha = data["latest_sha"]["object"]["sha"];
      return callback(null, latest_sha);
    });
  } else {
    repoUrl = path.join('repos', owner, stackName, 'commits');
    gitClient.get(repoUrl, {}, function(err, status, data, headers) {
      if (err) {
        return callback(err);
      }
      latest_sha = data[0]["sha"];
      return callback(null, latest_sha);
    });
  }
};
