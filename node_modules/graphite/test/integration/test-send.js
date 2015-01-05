var common         = require('../common');
var assert         = require('assert');
var graphite       = common.graphite;
var CarbonServer   = require('../helper/CarbonServer');

var server = new CarbonServer();
server.listen(common.port, function() {
  var client = graphite.createClient(common.carbonDsn);
  var metrics = {
    foo: 1,
    deep: {
      down: {
        a: 2,
        b: 3,
      }
    }
  };

  client.write(metrics, function(err) {
    assert.ok(!err);

    client.end();
  });
});

process.on('exit', function() {
  var metric = server.metrics.shift();
  assert.equal(metric.path, 'foo');
  assert.equal(metric.value, 1);
  assert.ok(metric.timestamp + 1 >= Date.now() / 1000);
  assert.ok(metric.timestamp - 1 <= Date.now() / 1000);

  metric = server.metrics.shift();
  assert.equal(metric.path, 'deep.down.a');
  assert.equal(metric.value, 2);
  assert.ok(metric.timestamp + 1 >= Date.now() / 1000);
  assert.ok(metric.timestamp - 1 <= Date.now() / 1000);

  metric = server.metrics.shift();
  assert.equal(metric.path, 'deep.down.b');
  assert.equal(metric.value, 3);
  assert.ok(metric.timestamp + 1 >= Date.now() / 1000);
  assert.ok(metric.timestamp - 1 <= Date.now() / 1000);
});

