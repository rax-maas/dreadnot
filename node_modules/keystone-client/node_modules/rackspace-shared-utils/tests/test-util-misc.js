var misc = require('../lib/misc');


exports['test_object_merge'] = function(test, assert) {
  var a = {foo: 1};
  var b = {bar: 2};
  var c = {foo: 1, bar: 2};
  var out = misc.merge(a, b);
  assert.deepEqual(c, out);
  out = misc.merge(out, {});
  assert.deepEqual(c, out);
  out = misc.merge({}, out);
  assert.deepEqual(c, out);

  test.finish();
};


exports['test_empty_object_merge'] = function(test, assert) {
  var a = {};
  var b = {};
  var c = {};
  var out = misc.merge(a, b);
  assert.deepEqual(c, out);

  test.finish();
};

exports['test_indent'] = function(test, assert) {
  assert.equal(misc.indent('test', 1, ' '), ' test');
  assert.equal(misc.indent('test', 2, ' '), '  test');
  assert.equal(misc.indent('test', 2, '  '), '    test');
  assert.equal(misc.indent(' test', 2, '  '), '     test');
  test.finish();
};


exports['test_getValues'] = function(test, assert) {
  var values = [
    { 'obj': {'a': 'b', 'b': 'c', 'd': 'd'},
      'value': ['b', 'c', 'd']
    },
    { 'obj': {'a': 'b', 'b': 'c', 'd': 1, 'f': 1},
      'value': ['b', 'c', 1, 1]
    }
  ], key, obj, i, len;

  for (i = 0, len = values.length; i < len; i++) {
    obj = values[i];
    assert.deepEqual(misc.getValues(obj.obj), obj.value);
  }

  assert.equal(i, 2);
  test.finish();
};


exports['test_getRandomAddress'] = function(test, assert) {
  var addresses = ['1.2.3.4:1111', '1.2.3.5:2222', '1.2.3.5:5555'],
      ports = ['1111', '2222', '5555'],
      address = misc.getRandomAddress(addresses);

  assert.equal(address.length, 2);
  assert.ok(ports.indexOf(address[1]) !== -1);
  assert.ok(addresses.indexOf(address.join(':')) !== -1);
  test.finish();
};


exports['test_splitAddress'] = function(test, assert) {
  var addresses = ['127.0.0.1:5000', '55.55.55.55:12345',
                   '70:cd:60:ff:fe:ae:0a:88:8888', '70:cd:60:ff:fe:ae:0a:88:5555'],
      expected = [['127.0.0.1', '5000'], ['55.55.55.55', '12345'],
                  ['70:cd:60:ff:fe:ae:0a:88', '8888'], ['70:cd:60:ff:fe:ae:0a:88', '5555']],
      i;

  for (i = 0; i < addresses.length; i++) {
    assert.deepEqual(misc.splitAddress(addresses[i]), expected[i]);
  }

  test.finish();
};

exports['test_toRfc3339Date'] = function(test, assert) {
  assert.equal(misc.toRfc3339Date(new Date(Date.UTC(2012, 9, 24, 10, 10, 55, 22))), '2012-10-24T10:10:55Z');
  assert.equal(misc.toRfc3339Date(new Date(Date.UTC(2012, 6, 5, 10, 9, 55, 22))), '2012-07-05T10:09:55Z');
  test.finish();
};

