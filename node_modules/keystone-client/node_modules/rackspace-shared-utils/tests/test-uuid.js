var uint = require('../lib/uuid').Uint;
var uuidFromTimestamp = require('../lib/uuid').uuidFromTimestamp;
var uuidFromBuffer = require('../lib/uuid').uuidFromBuffer;

exports['test_zero'] = function(test, assert) {
  var sizes = [1, 4, 8, 16, 32, 64, 128];
  sizes.forEach(function(sz) {
    var x = new uint(sz);
    assert.strictEqual(x.intValue(), 0);
  });
  test.finish();
};

exports['test_invalid_sizes'] = function(test, assert) {
  var invalidSizes = [0, -1, -8];
  invalidSizes.forEach(function(sz) {
    try {
      var x = new uint(sz);
      assert.ok(false, 'you shouldn\'t be able to do that.');
    } catch (err) {
      assert.ok(err);
    }
  });
  test.finish();
};

exports['test_simple_left_shift'] = function(test, assert) {
  var x = new uint(4, 1);
  for (var i = 0; i < 32; i++) {
    assert.strictEqual(Math.pow(2, i), x.intValue());
    x = x.shiftLeft();
  }

  x = new uint(4, 1);
  for (i = 0; i < 16; i++) {
    assert.strictEqual(Math.pow(2, 2 * i), x.intValue());
    x = x.shiftLeft(2);
  }
  test.finish();
};

exports['test_simple_right_shift'] = function(test, assert) {
  var x = new uint(4, 2147483648); // Math.pow(2, 31)
  for (var i = 0; i < 32; i++) {
    assert.strictEqual(Math.pow(2, 31 - i), x.intValue());
    x = x.shiftRight();
  }

  var x = new uint(4, 2147483648);
  for (var i = 0; i < 16; i++) {
    assert.strictEqual(Math.pow(2, 31 - i * 2), x.intValue());
    x = x.shiftRight(2);
  }
  test.finish();
};

exports['test_complex_left_shift'] = function(test, assert) {
  var x = new uint(5, 1097363558964);
  var shiftValues = [
    1097363558964,
    1095215490152,
    1090919352528,
    1082327077280,
    1065142526784,
    1030773425792,
    962035223808,
    824558819840,
    549606011904,
    1099212023808,
    1098912419840,
    1098313211904,
    1097114796032,
    1094717964288,
    1089924300800,
    1080336973824,
    1061162319872
  ];
  shiftValues.forEach(function(testValue) {
    assert.strictEqual(testValue, x.intValue());
    x = x.shiftLeft();
  });

  x = new uint(5, 1097363558964);
  for (var i = 0; i < shiftValues.length / 2; i++) {
    assert.strictEqual(shiftValues[2 * i], x.intValue());
    x = x.shiftLeft(2);
  }

  // shift 8 is a whole byte
  x = new uint(5, 1097363558964);
  x = x.shiftLeft(8);
  assert.strictEqual(549606011904, x.intValue());

  test.finish();
};

exports['test_big_left_shift'] = function(test, assert) {
  var x = new uint(5, 1097363558964);
  x = x.shiftLeft(12);
  assert.strictEqual(1097114796032, x.intValue());
  test.finish();
};

exports['test_complex_right_shift'] = function(test, assert) {
  var x = new uint(5, 1097363558964);
  var shiftValues = [
    1097363558964,
    548681779482,
    274340889741,
    137170444870,
    68585222435,
    34292611217,
    17146305608,
    8573152804,
    4286576402,
    2143288201,
    1071644100,
    535822050,
    267911025,
    133955512,
    66977756,
    33488878,
    16744439
  ];
  shiftValues.forEach(function(testValue) {
    assert.strictEqual(testValue, x.intValue());
    x = x.shiftRight();
  });

  x = new uint(5, 1097363558964);
  for (var i = 0; i < shiftValues.length / 2; i++) {
    assert.strictEqual(shiftValues[2 * i], x.intValue());
    x = x.shiftRight(2);
  }

  // shift 8 is a whole byte
  x = new uint(5, 1097363558964);
  x = x.shiftRight(8);
  assert.strictEqual(4286576402, x.intValue());

  test.finish();
};

exports['test_big_right_shift'] = function(test, assert) {
  var x = new uint(5, 1097363558964);
  x = x.shiftRight(12);
  assert.strictEqual(267911025, x.intValue());
  test.finish();
};

exports['test_clone'] = function(test, assert) {
  var x = new uint(2, 26046); // 0x65be

  // baseline.
  assert.strictEqual(x.intValue(), 26046);

  // clone into a smaller destination (grabs least significant portion that fits).
  var sliceClone = x.clone(1);
  assert.strictEqual(sliceClone.intValue(), 190);
  assert.strictEqual(sliceClone.sz, 1);

  // simple clone.
  var xClone = x.clone();
  assert.strictEqual(x.intValue(), xClone.intValue());
  assert.strictEqual(x.sz, xClone.sz);

  var bigXClone = x.clone(5);
  assert.strictEqual(x.intValue(), bigXClone.intValue());
  assert.strictEqual(5, bigXClone.sz);

  test.finish();
};

exports['test_hex_string'] = function(test, assert) {
  var x = new uint(8, 1097363558964);
  assert.strictEqual('000000ff7ff71234', x.hexValue());
  test.finish();
};

exports['test_slice_bits'] = function(test, assert) {
  var x = new uint(8, 1097363558964);

  var a = x.sliceBits(8, 8);
  assert.strictEqual(a.intValue(), 0);
  assert.strictEqual(a.sz, 8);
  assert.strictEqual(x.sliceBits(24, 8).intValue(), 255);
  assert.strictEqual(x.sliceBits(28, 8).intValue(), 247); // 1111-0111 (straddles a byte boundary.
  assert.strictEqual(x.sliceBits(18, 18).intValue(), 4087); // straddles two byte boundaries at odd places. 0xff7

  var y = new uint(2, 48);
  assert.strictEqual(y.intValue(), 48);
  assert.strictEqual(y.sliceBits(0, 16).intValue(), 48);

  y = new uint(8, 13532978640772000);
  assert.strictEqual(y.intValue(), 13532978640772000);
  assert.strictEqual(y.sliceBits(0, 16).intValue(), 48);

  test.finish();
};

exports['test_add'] = function(test, assert) {
  var a = new uint(2, 255);
  var b = new uint(2, 1);
  var c = new uint(2, 100);
  var d = new uint(1, 100);
  assert.strictEqual(d.sz, 1);

  assert.strictEqual(a.add(b).intValue(), 256);
  assert.strictEqual(a.add(a).intValue(), 510);
  assert.strictEqual(a.add(c).intValue(), 355);
  assert.strictEqual(a.add(d).intValue(), 355);
  assert.strictEqual(d.add(a).intValue(), 355);
  test.finish();
};

exports['test_subtract'] = function(test, assert) {
  var one = new uint(1, 1),
      zero = new uint(1, 0),
      twofiftyfive = new uint(1, 255),
      twofiftysix = new uint(2, 256);

  // Subtraction resulting in non-negative numbers returns the correct uuint
  assert.strictEqual(one.subtract(one).intValue(), 0);
  assert.strictEqual(one.subtract(zero).intValue(), 1);
  assert.strictEqual(twofiftysix.subtract(twofiftyfive).intValue(), 1);
  assert.strictEqual(twofiftysix.subtract(one).intValue(), 255);

  // Subtraction resulting in underflow results in -1
  assert.strictEqual(one.subtract(twofiftyfive), -1);
  assert.strictEqual(twofiftyfive.subtract(twofiftysix), -1);
  test.finish();
};

exports['test_is_bit_asserted'] = function(test, assert) {
  var one = new uint(1, 1),
      zero = new uint(1, 0),
      twofiftyfive = new uint(1, 255),
      twofiftysix = new uint(2, 256);

  // Given a uint and an array of indices, make sure only bits at those indices
  // are asserted
  function onlyAsserted(value, indices) {
    var i;

    // We intentionally go too far, these should return false
    for (i = 0; i < value.sz * 8 + 10; i++) {
      assert.equal(value.isBitAsserted(i), indices.indexOf(i) !== -1);
    }
  }

  onlyAsserted(zero, []);
  onlyAsserted(one, [7]);
  onlyAsserted(twofiftyfive, [0, 1, 2, 3, 4, 5, 6, 7]);
  onlyAsserted(twofiftysix, [7]);
  test.finish();
};

exports['test_divide_by'] = function(test, assert) {
  var twothirty = new uint(1, 230),
      six = new uint(1, 6),
      ten = new uint(1, 10),
      twelve = new uint(1, 12),
      fourtyeight = new uint(1, 48),
      fourtynine = new uint(1, 49),
      eightbytefourtyeight = new uint(8, 48),
      eightbytetwelve = new uint(8, 12),
      eightbyteten = new uint(8, 10),
      largeishnumber = new uint(8, 58880);

  assert.equal(twothirty.divideBy(six).intValue(), 38);
  assert.equal(fourtyeight.divideBy(twelve).intValue(), 4);
  assert.equal(eightbytefourtyeight.divideBy(eightbytetwelve).intValue(), 4);
  assert.equal(fourtynine.divideBy(twelve).intValue(), 4);
  assert.equal(largeishnumber.divideBy(eightbyteten).intValue(), 5888);
  test.finish();
};

exports['test_or'] = function(test, assert) {
  var a = new uint(2, 196);
  var b = new uint(2, 170);
  // test mismatched ORing.
  var c = new uint(5, 170);
  assert.strictEqual(a.or(b).intValue(), 238);
  assert.strictEqual(a.or(c).intValue(), 238);
  assert.strictEqual(c.or(a).intValue(), 238);
  test.finish();
};

exports['test_uuid'] = function(test, assert) {
  var old = null;
  for (var i = 0; i < 10; i++) {
    var cur = uuidFromTimestamp(Date.now());
    if (old) {
      assert.ok(old.toString() < cur.toString());
    }
    old = cur;
  }
  test.finish();
};

exports['test_uuid_from_buffer'] = function(test, assert) {
  var buf = new Buffer('\u00ee\u00a1\u006c\u00c0\u00cf\u00bd\u0011\u00e0\u0017' +
          '\u000a\u00dd\u0026\u0075\u0027\u009e\u0008', 'binary');
  var uuid = uuidFromBuffer(buf);
  assert.strictEqual(uuid.toString(), 'eea16cc0-cfbd-11e0-170a-dd2675279e08');
  test.finish();
};

exports['test_uuid_backwards_in_time'] = function(test, assert) {
  var ts = 1314735336316;
  var uuidTs = uuidFromTimestamp(ts).toString();
  // this forces the nano tracker in uuid to get set way ahead.
  var uuidFuture = uuidFromTimestamp(ts + 5000).toString();
  // we want to verify that the nanos used reflect ts and not ts+5000.
  var uuidTsSame = uuidFromTimestamp(ts).toString();
  assert.ok(uuidTs !== uuidFuture); // duh
  assert.ok(uuidTs !== uuidTsSame); // generated from same TS after going back in time.
  // but time lo should definitely be the same.
  // this test would have failed before we started using the back-in-time reset block in UUID.nanos().
  assert.strictEqual(uuidTs.split('-')[0], uuidTsSame.split('-')[0]);
  test.finish();
};


exports['test_uuid_forward_reverse'] = function(test, assert) {
  var testAtYears = [-5, 0, 1, 10, 100];

  // Note: we assume a year is exactly 365 days, this shouldn't matter
  function testAtYearsInFuture(yearsInFuture) {
    var ts = (Date.now() + yearsInFuture * 365 * 24 * 60 * 60 * 1000),
        uuid, i;

    // Generate 100 uuids with each timestamp
    for (i = 0; i < 100; i++) {
      uuid = uuidFromTimestamp(ts);
      assert.strictEqual(uuid.getTimestamp(), ts);
    }
  }

  // Test at various points in time
  testAtYears.forEach(testAtYearsInFuture);

  // Go "back in time" from the latest tested point
  testAtYearsInFuture(0);

  test.finish();
};
