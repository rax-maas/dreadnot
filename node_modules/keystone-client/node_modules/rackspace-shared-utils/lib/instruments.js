/*
 *  Copyright 2012 Rackspace
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

var util = require('util');

var Timer = require('metrics-ck').Timer;
var Counter = require('metrics-ck').Counter;
var Meter = require('metrics-ck').Meter;


/**
 * Storage for live metrics.
 */
var workMetrics = {};
var eventMetrics = {};


/**
 * Used when metrics are disabled.
 */
function noop() {}


/**
 * Instantiate a work metric if it doesn't exist.
 * @param {String} label The metric to instantiate.
 */
function ensureWorkMetric(label) {
  if (!workMetrics[label]) {
    workMetrics[label] = {
      active: new Counter(),
      timer: new Timer(),
      errorMeter: new Meter()
    };
  }
}


/**
 * Record work directly, skipping active counter.
 * @param {String} label The label for the work.
 * @param {Number} duration The duration of the work in ms.
 */
exports.measureWork = function(label, duration) {
  ensureWorkMetric(label);
  workMetrics[label].timer.update(duration);
};


/**
 * Record the occurrence of an event.
 * @param {String} label A label identifying the event.
 */
exports.recordEvent = function(label) {
  if (!eventMetrics[label]) {
    eventMetrics[label] = new Meter();
  }

  eventMetrics[label].mark(1);
};



/**
 * Used to track when work starts/stops across method invocations.
 * @constructor
 * @param {string} label the metric that will be tracked.
 */
function Work(label) {
  this.label = label;
  this.startTime = null;
  this.stopTime = null;
  ensureWorkMetric(this.label);
}


/**
 * Start measuring work.
 */
Work.prototype.start = function() {
  this.startTime = Date.now();
  workMetrics[this.label].active.inc();
};


/**
 * Stop measuring work and record it.
 * @param {boolean} error Whether an error occurred.
 * @return {Number} Number of seconds between stop and start call.
 */
Work.prototype.stop = function(error) {
  var delta;

  this.stopTime = Date.now();

  delta = (this.stopTime - this.startTime);
  workMetrics[this.label].active.dec();
  workMetrics[this.label].timer.update(delta);

  if (error) {
    workMetrics[this.label].errorMeter.mark(1);
  }

  return delta;
};



/**
 * Dummy work object. Each method call is a no-op.
 * @constructor
 * @param {{string}} label the metric that will be tracked.
 */
function DummyWork(label) {}

util.inherits(DummyWork, Work);


/** no-op. */
DummyWork.prototype.start = noop;


/** no-op. */
DummyWork.prototype.stop = noop;


/**
 * Retrieve a specific work metric.
 * @param {String} label The label of the metric to retrieve.
 * @return {Object} The work metric data.
 */
exports.getWorkMetric = function(label) {
  var metric = workMetrics[label], pct;

  if (metric) {
    pct = metric.timer.percentiles([0.01, 0.25, 0.5, 0.75, 0.99]);
    return {
      label: label,
      ops_count: metric.timer.count(),
      rate_1m: metric.timer.oneMinuteRate(),
      rate_5m: metric.timer.fiveMinuteRate(),
      rate_15m: metric.timer.fifteenMinuteRate(),
      mean_rate: metric.timer.meanRate(),
      min: metric.timer.min(),
      max: metric.timer.max(),
      mean_time: metric.timer.mean(),
      std_dev: metric.timer.stdDev(),
      pct_1: pct['0.01'],
      pct_25: pct['0.25'],
      pct_50: pct['0.5'],
      pct_75: pct['0.75'],
      pct_99: pct['0.99'],
      active: metric.active.count,
      errors: metric.errorMeter.count,
      err_rate_1m: metric.errorMeter.oneMinuteRate(),
      err_rate_5m: metric.errorMeter.fiveMinuteRate(),
      err_rate_15m: metric.errorMeter.fifteenMinuteRate(),
      err_mean_rate: metric.errorMeter.meanRate()
    };
  } else {
    return {
      label: label,
      ops_count: 0,
      rate_1m: 0,
      rate_5m: 0,
      rate_15m: 0,
      mean_rate: 0,
      min: 0,
      max: 0,
      mean_time: 0,
      std_dev: 0,
      pct_1: 0,
      pct_25: 0,
      pct_50: 0,
      pct_75: 0,
      pct_99: 0,
      active: 0,
      errors: 0,
      err_rate_1m: 0,
      err_rate_5m: 0,
      err_rate_15m: 0,
      err_mean_rate: 0
    };
  }
};


/**
 * Get all work metrics.
 * @return {Array} A list of work metrics.
 */
exports.getWorkMetrics = function() {
  var metrics = [], key;

  for (key in workMetrics) {
    if (workMetrics.hasOwnProperty(key)) {
      metrics.push(exports.getWorkMetric(key));
    }
  }
  return metrics;
};


/**
 * Retrieve metrics for a specific event.
 * @param {String} label The event to retrieve metrics for.
 * @return {Object} The event metric data.
 */
exports.getEventMetric = function(label) {
  var metric = eventMetrics[label];

  if (metric) {
    return {
      label: label,
      count: metric.count,
      rate_1m: metric.oneMinuteRate(),
      rate_5m: metric.fiveMinuteRate(),
      rate_15m: metric.fifteenMinuteRate(),
      rate_mean: metric.meanRate()
    };
  } else {
    return {
      label: label,
      count: 0,
      rate_1m: 0,
      rate_5m: 0,
      rate_15m: 0,
      rate_mean: 0
    };
  }
};


/**
 * Get all event metrics.
 * @return {Array} A list of event metrics.
 */
exports.getEventMetrics = function() {
  var metrics = [], key;

  for (key in eventMetrics) {
    if (eventMetrics.hasOwnProperty(key)) {
      metrics.push(exports.getEventMetric(key));
    }
  }
  return metrics;
};


/**
 * Get all metrics. This is fairly expensive, if you know what you want then
 * you should get that directly.
 * @return {Object} A map of metric types to metric lists.
 */
exports.getMetrics = function() {
  return {
    work: exports.getWorkMetrics(),
    events: exports.getEventMetrics()
  };
};


/** the work function. */
exports.Work = Work;


/** DummyWork class. */
exports.DummyWork = DummyWork;


/**
 * The metrics library calls setInterval but never clears it. This causes
 * tests, among other things, to hang. Traverse the object hierarchy, find the
 * interval (which has a specific name) and clear it.
 * @param {Object} obj The object to clear intervals from.
 */
function clearStrayIntervals(obj) {
  var field;

  for (field in obj) {
    if (field === '0') {
      continue;
    } else if (field === 'tickInterval') {
      clearInterval(obj[field]);
    } else {
      clearStrayIntervals(obj[field]);
    }
  }
}


/**
 * Release resources being used to track an operation.
 * @param {String} label A label identifying which resources to release.
 */
exports.releaseWork = function(label) {
  clearStrayIntervals(workMetrics[label].timer);
  clearStrayIntervals(workMetrics[label].errorMeter);
  delete workMetrics[label];
};


/**
 * Release resources being used to track an event.
 * @param {String} label A label identifying which resources to release.
 */
exports.releaseEvent = function(label) {
  clearStrayIntervals(eventMetrics[label]);
  delete eventMetrics[label];
};


/**
 * Release all resources.
 *
 * @param {Function} callback the completion callback.
 */
exports.shutdown = function(callback) {
  var label;

  callback = callback || noop;

  for (label in workMetrics) {
    if (workMetrics.hasOwnProperty(label)) {
      exports.releaseWork(label);
    }
  }

  for (label in eventMetrics) {
    if (eventMetrics.hasOwnProperty(label)) {
      exports.releaseEvent(label);
    }
  }

  callback();
};
