var test = require('tape');

var sprintf = require('../lib/util/sprintf');

test('sprintf', function(t) {
  t.equal(sprintf('test %s', 'test'), 'test test', 'supports %s');
  t.equal(sprintf('test %j', {foo: 'bar'}), 'test {"foo":"bar"}', 'supports %j');
  t.equal(sprintf('this is a \'%s\'', 'string'), 'this is a \'string\'', 'escapes single quotes');
  t.equal(sprintf('this is a %s\nline of text', 'broken'), 'this is a broken\nline of text', 'escapes newlines');
  t.equal(sprintf('%(foo)s %(bar)s', {foo: 'first', bar: 'second'}), 'first second', 'supports named arguments');
  t.end();
});
