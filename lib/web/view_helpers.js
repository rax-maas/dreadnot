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

var git = require('util/git');
var sprintf = require('util/sprintf');

var DIFF_LINK_FMT = '(<a href="%s">diff</a>)';
var COMMIT_LINK_FMT = '<a href="%s">%s</a>';

exports.trimRevision = function(ref) {
  return git.trimRevision(ref);
};


exports.ghCommitUrl = function(base, rev) {
  return sprintf('%s/commit/%s', base, rev);
};


exports.ghDiffUrl = function(base, reva, revb) {
  return sprintf('%s/compare/%s...%s', base, reva, revb);
};


exports.buildDiffLink = function(base, reva, revb) {
  return sprintf(DIFF_LINK_FMT, exports.ghDiffUrl(base, reva, revb));
};


exports.buildSingleDiffSegment = function(base, reva, revb) {
  if (!reva || !revb) { return '?'; } // handle invalid values / unknown status case

  var hrefa = exports.ghCommitUrl(base, reva),
      shorta = exports.trimRevision(reva),
      hrefd = exports.ghDiffUrl(base, reva, revb);

  if (reva === revb) {
    return sprintf(COMMIT_LINK_FMT, hrefa, shorta);
  } else {
    return sprintf('%s %s', sprintf(COMMIT_LINK_FMT, hrefa, shorta), sprintf(DIFF_LINK_FMT, hrefd));
  }
};


exports.buildDiffSegment = function(base, reva, revb) {
  if (!reva || !revb) { return '?'; } // handle invalid values / unknown status case

  var linka = sprintf(COMMIT_LINK_FMT, exports.ghCommitUrl(base, reva), exports.trimRevision(reva)),
      linkb = sprintf(COMMIT_LINK_FMT, exports.ghCommitUrl(base, revb), exports.trimRevision(revb));

  if (reva === revb) {
    return sprintf('%s &rarr; %s', linka, linkb);
  } else {
    return sprintf('%s &rarr; %s %s', linka, linkb, exports.buildDiffLink(base, reva, revb));
  }
};


function unitsAgo(seconds, denominator, units) {
  var number = Math.round(seconds / denominator);

  if (number === 1) {
    return sprintf('%s %s ago', number, units);
  } else {
    return sprintf('%s %ss ago', number, units);
  }
}


exports.prettyTimeSince = function(then) {
  var seconds = (Date.now() - then) / 1000;

  if (seconds < 90) {
    // Up to 90 seconds ago
    return 'just now';
  } else if (seconds < 60 * 60) {
    // Up to 1 hour ago
    return unitsAgo(seconds, 60, 'minute');
  } else if (seconds < 60 * 60 * 24) {
    // Up to 1 day ago
    return unitsAgo(seconds, 60 * 60, 'hour');
  } else {
    return unitsAgo(seconds, 60 * 60 * 24, 'day');
  }
};


exports.markdown = require('markdown').markdown;
