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
  var hrefa = exports.ghCommitUrl(base, reva),
      shorta = exports.trimRevision(reva),
      hrefd = exports.ghDiffUrl(base, reva, revb);

  if (reva === revb) {
    return sprintf(COMMIT_LINK_FMT, hrefa, shorta);
  } else {
    return sprintf('%s %s', sprintf(COMMIT_LINK_FMT, hrefa, shorta), sprintf(DIFF_LINK_FMT, hrefd));
  }
}


exports.buildDiffSegment = function(base, reva, revb) {
  var linka = sprintf(COMMIT_LINK_FMT, exports.ghCommitUrl(base, reva), exports.trimRevision(reva)),
      linkb = sprintf(COMMIT_LINK_FMT, exports.ghCommitUrl(base, revb), exports.trimRevision(revb)),
      linkd = sprintf(DIFF_LINK_FMT, exports.ghDiffUrl(base, reva, revb));

  return sprintf('%s &rarr; %s %s', linka, linkb, linkd);
};
