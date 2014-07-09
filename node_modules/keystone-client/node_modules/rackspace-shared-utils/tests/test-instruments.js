var instruments = require('../lib/instruments');

var expectedProperties = ('ops_count rate_1m rate_5m rate_15m ' +
    'mean_rate min max mean_time std_dev pct_1 pct_25 ' +
    'pct_75 pct_99 active errors err_rate_1m err_rate_5m ' +
    'err_rate_15m err_mean_rate').split(' ');

exports['test_clean_shutdown'] = function(test, assert) {
  var seconds = 2;
  var perSecond = 100;
  var sleepTime = 1000 / perSecond;
  var iterations = seconds * perSecond;
  var curIt = 0;
  var interval = setInterval(function() {
    instruments.measureWork('foo', 5);
    instruments.measureWork('bar', 10);
    instruments.measureWork('baz', 20);
    curIt += 1;
    if (curIt >= iterations) {
      clearInterval(interval);
      instruments.releaseWork('foo');
      instruments.releaseWork('bar');
      instruments.releaseWork('baz');

      test.finish();
    }

  }, sleepTime);
};


exports['test_update_rates'] = function(test, assert) {
  var seconds = 2;
  var updatesPerSecond = 100;
  var sleepTime = 1000 / updatesPerSecond;
  var iterations = seconds * updatesPerSecond;
  var curIt = 0;
  var interval = null;
  var duration = 10;
  function measure() {
    instruments.measureWork('foo2', duration);
    curIt += 1;
    if (!interval) {
      interval = setInterval(measure, sleepTime);
    } else if (curIt >= iterations) {
      clearInterval(interval);
      assert.ok(true);
      var met = instruments.getWorkMetric('foo2');
      instruments.releaseWork('foo2');
      assert.hasProperties(met, expectedProperties, assert);
      assert.strictEqual(iterations, met.ops_count);
      assert.isWithinRange(met.mean_rate, updatesPerSecond, 6, assert);
      assert.strictEqual(duration, met.min);
      assert.strictEqual(duration, met.max);
      assert.strictEqual(duration, met.mean_time);
      assert.strictEqual(0, met.std_dev);

      test.finish();
    }
  }
  measure();
};


exports['test_err_rates'] = function(test, assert) {
  var seconds = 2;
  var updatesPerSecond = 100;
  var sleepTime = 1000 / updatesPerSecond;
  var iterations = seconds * updatesPerSecond;
  var curIt = 0;
  var work = new instruments.Work('error_rates');
  work.start();
  var interval = setInterval(function() {
    work.stop(true);
    curIt += 1;
    if (curIt == iterations) {
      clearInterval(interval);
      var met = instruments.getWorkMetric('error_rates');
      instruments.releaseWork('error_rates');
      assert.hasProperties(met, expectedProperties, assert);
      assert.isWithinRange(met.err_mean_rate, updatesPerSecond, 6, assert);
      // can't test the specific minute rates because they only get updated
      // after 5 secs.
      test.finish();
    } else {
      work = new instruments.Work('error_rates');
      work.start();
    }
  }, sleepTime);
};


exports['test_get_all_metrics'] = function(test, assert) {
  instruments.measureWork('one', 20);
  instruments.measureWork('one', 40);
  instruments.measureWork('two', 60);
  var all_metrics = instruments.getWorkMetrics().reduce(function(hash, metric) {
    hash[metric.label] = metric;
    return hash;
  }, {});
  instruments.releaseWork('one');
  instruments.releaseWork('two');
  assert.hasProperties(all_metrics.one, expectedProperties, assert);
  assert.hasProperties(all_metrics.two, expectedProperties, assert);
  assert.strictEqual(all_metrics.one.ops_count, 2);
  assert.strictEqual(all_metrics.two.ops_count, 1);

  test.finish();
};


exports['test_distributions'] = function(test, assert) {
  var data = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10,
              1, 1, 1, 1, 1,
              100];
  for (var i = 0; i < data.length; i++) {
    instruments.measureWork('test.distributions', data[i]);
  }

  var met = instruments.getWorkMetric('test.distributions');
  instruments.releaseWork('test.distributions');
  assert.hasProperties(met, expectedProperties, assert);
  assert.strictEqual(data.length, met.ops_count);
  assert.strictEqual(1, met.min);
  assert.strictEqual(100, met.max);

  // get it on. verify mean and stddev
  var sum = function(x, y) { return x + y; };
  var mean = data.reduce(sum) / data.length;
  var deviations = data.map(function(x) { return x - mean;});
  var stddev = Math.sqrt(deviations.map(
      function(x) {return x * x}).reduce(sum) / (data.length - 1));
  assert.strictEqual(mean, met.mean_time);
  assert.strictEqual(stddev, met.std_dev);

  test.finish();
};


exports['test_active_counters'] = function(test, assert) {
  var i, work;
  var count = 10;
  var workers = [];
  var assertions = [];

  for (i = 0; i < count; i++) {
    work = new instruments.Work('active_counters');
    work.start();
    workers.push(work);
  }
  assertions.push(function(met) {
    return function() {
      assert.hasProperties(met, expectedProperties, assert);
      assert.strictEqual(met.active, count);
    };
  }(instruments.getWorkMetric('active_counters')));

  for (i = 0; i < count; i++) {
    work = workers.pop();
    work.stop();
    assertions.push(function(met, index) {
      return function() {
        assert.hasProperties(met, expectedProperties, assert);
        assert.strictEqual(met.active, count - index - 1);
      };
    }(instruments.getWorkMetric('active_counters'), i));
  }

  instruments.releaseWork('active_counters');

  // test assertions here.
  assert.strictEqual(assertions.length, 11);
  for (var i = 0; i < assertions.length; i++) {
    assertions[i]();
  }

  test.finish();
};


exports['test_events'] = function(test, assert) {
  var i, metrics;

  for (i = 0; i < 10; i++) {
    instruments.recordEvent('foo');
  }

  // Rates don't populate until 5 seconds, we overwrite the mean because
  // it changes depending on timing
  metrics = instruments.getEventMetrics();
  metrics[0].rate_mean = 0;

  assert.deepEqual(metrics, [
    {
      label: 'foo',
      count: 10,
      rate_1m: 0,
      rate_5m: 0,
      rate_15m: 0,
      rate_mean: 0
    }
  ]);

  instruments.releaseEvent('foo');
  test.finish();
};


exports['test_DummyWork'] = function(test, assert) {
  var work = new instruments.DummyWork('test_disabled'),
      key, value, count = 0;

  work.start();
  setTimeout(function() {
    var met;

    work.stop(true);

    met = instruments.getWorkMetric('test_disabled');
    for (key in met) {
      if (met.hasOwnProperty(key) && ['label', 'serializerType'].indexOf(key) === -1) {
        count++;
        value = met[key];
        assert.equal(value, 0);
      }
    }

    assert.equal(count, Object.keys(met).length - 1);
    test.finish();
  }, 100);
};
