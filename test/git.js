'use strict';

var expect = require('chai').expect,
  rewire = require('rewire'),
  git = rewire('../lib/util/git'),
  miscSpawnCalls,
  mkdirpCalls;

git.__set__('misc', {
  spawn: function () {
    var args = Array.prototype.slice.call(arguments),
      cb = args[args.length-1];

    miscSpawnCalls.push({ args: args });
    process.nextTick(function () {
      cb();
    });
  }
});

git.__set__('mkdirp', function () {
  var args = Array.prototype.slice.call(arguments),
    cb = args[args.length-1];

  mkdirpCalls.push({ args: args });
  process.nextTick(function () {
    cb();
  });
});

git.__set__('path', {
  exists: function () {
    var cb = arguments[1];

    process.nextTick(function () {
      cb(null, true);
    });
  },
  dirname: function () {
    return '/var/lol/repo';
  }
});

describe('util.git', function () {
  beforeEach(function () {
    miscSpawnCalls = [];
    mkdirpCalls = [];
  });

  describe('.fetch', function () {
    it('runs git fetch', function (done) {
      git.fetch('test-repo', function (err) {
        if (err) {
          return done(err);
        }
        expect(miscSpawnCalls[0].args[0]).to.eql([
          'git',
          '--git-dir=test-repo/.git',
          '--work-tree=test-repo',
          'fetch'
        ]);
        done();
      });
    });
  });

  describe('.checkout', function () {
    it('runs git checkout', function (done) {
      git.checkout('additional', 'pylons', function (err) {
        if (err) {
          return done(err);
        }
        expect(miscSpawnCalls[0].args[0]).to.eql([
          'git',
          '--git-dir=additional/.git',
          '--work-tree=additional',
          'checkout',
          'pylons'
        ]);
        done();
      });
    });
  });

  describe('.resetHard', function () {
    it('runs git reset --hard', function (done) {
      git.resetHard('angular', 'HEAD^', function (err) {
        if (err) {
          return done(err);
        }
        console.log(miscSpawnCalls[0].args[0])
        expect(miscSpawnCalls[0].args[0]).to.eql([
          'git',
          '--git-dir=angular/.git',
          '--work-tree=angular',
          'reset',
          '--hard',
          'HEAD^'
        ]);
        done();
      });
    });
  });

  describe('.clone', function () {
    it('makes the directory', function (done) {
      git.clone('/var/lol/repo/foo.git', 'https://github/yolo/swag',
        function (err) {
          if (err) {
            return done(err);
          }
          expect(mkdirpCalls[0].args.slice(0, 2)).to.eql([
            '/var/lol/repo',
            parseInt('0755', 8)
          ]);
          done();
        }
      );
    });

    it('runs git clone', function (done) {
      git.clone('/var/lol/repo/foo.git', 'https://github/yolo/swag',
        function (err) {
          if (err) {
            return done(err);
          }
          expect(miscSpawnCalls[0].args[0]).to.eql([
            'git',
            'clone',
            'https://github/yolo/swag',
            '/var/lol/repo/foo.git'
          ]);
          done();
        }
      );
    });
  });
});
