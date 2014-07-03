var assert = require('assert');

var sprintf = require('sprintf').sprintf;
var async = require('async');

// verifies that expected fields are present on a metrics object.
function hasProperties(obj, expectedProperties, assert) {
  expectedProperties.forEach(function(field) {
    assert.ok(obj.hasOwnProperty(field), 'expected field: ' + field + ' not present');
  });
}


function isWithinRange(actual, expected, allowedDeviation, assert) {
  var min = (expected - 2 * allowedDeviation);
  var max = (expected + 2 * allowedDeviation);
  var isGreaterThanMin = actual >= min;
  var isLessThanMax = actual <= max;
  assert.ok(isGreaterThanMin && isLessThanMax, sprintf('!(%s <= %s <= %s)',
                                                       min, actual, max));
}


function looseCompare(good, suspect, ignoredKeys) {
  ignoredKeys = ignoredKeys || [];
  var key;

  for (key in good) {
    if (ignoredKeys.indexOf(key) !== -1) {
      continue;
    }

    assert.deepEqual(good[key], suspect[key]);
  }
}

exports.hasProperties = hasProperties;
exports.isWithinRange = isWithinRange;
exports.looseCompare = looseCompare;
