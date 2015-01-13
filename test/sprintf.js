'use strict';

var expect = require('chai').expect,
  sprintf = require('../lib/util/sprintf');

describe('sprintf', function () {
  it('supports %s', function () {
    expect(sprintf('test %s', 'test')).to.equal('test test');
  });

  it('supports %j', function () {
    expect(sprintf('test %j', { foo: 'bar' })).to.equal('test {"foo":"bar"}');
  });

  it('escapes single quotes', function () {
    expect(sprintf('this is a \'%s\'', 'string'))
      .to.equal('this is a \'string\'');
  });

  it('escapes newlines', function () {
    expect(sprintf('this is a %s\nline of text', 'broken'))
      .to.equal('this is a broken\nline of text');
  });

  it('supports named arguments', function () {
    expect(sprintf('%(foo)s %(bar)s', { foo: 'first', bar: 'second' }))
      .to.equal('first second');
  });
});
