// Copyright (c) 2012, Mark Cavage. All rights reserved.

var EventEmitter = require('events').EventEmitter;
var util = require('util');

var assert = require('assert-plus');
var dtrace = require('dtrace-provider');
var once = require('once');
var vasync = require('vasync');



///--- Globals

var sprintf = util.format;

var DEFAULT_EVENTS = ['close', 'end', 'error', 'timeout'];
var DTPS = {};
var MAX_INT = Math.pow(2, 32) - 1;

var SEQUENCE = 0;



///--- Errors

function DeadClientError() {
        this.message = 'client is dead';
        this.name = this.constructor.name;

        Error.captureStackTrace(this, DeadClientError);
}
util.inherits(DeadClientError, Error);


function PoolClosedError() {
        this.message = 'pool is closed';
        this.name = this.constructor.name;

        Error.captureStackTrace(this, PoolClosedError);
}
util.inherits(PoolClosedError, Error);


function PoolShuttingDownError() {
        this.message = 'pool is shutting down';
        this.name = this.constructor.name;

        Error.captureStackTrace(this, PoolShuttingDownError);
}
util.inherits(PoolShuttingDownError, Error);



///--- Internal Functions

function createDTraceProbes(name) {
        assert.string(name, 'name');

        if (DTPS[name]) {
                return (DTPS[name]);
        }

        var dtp = dtrace.createDTraceProvider(name);
        var probes = {
                // these are all object_id, state
                release: dtp.addProbe('release', 'int', 'json'),
                remove: dtp.addProbe('remove', 'int', 'json'),
                kill: dtp.addProbe('kill', 'int', 'json'),
                create: dtp.addProbe('create', 'int', 'json'),

                // additionally create_time of object
                acquire: dtp.addProbe('acquire', 'int', 'json', 'char *'),

                // additionally "ok"
                assert: dtp.addProbe('assert', 'int', 'json', 'int'),

                // just num_items to check and state
                check: dtp.addProbe('check', 'int', 'json'),

                // arg0 is the current number of checked out connections
                shutdown: dtp.addProbe('shutdown', 'int', 'json'),

                // just the current state (ignore arg0)
                queue: dtp.addProbe('queue', 'int', 'json'),

                _provider: dtp
        };
        DTPS[name] = probes;

        dtp.enable();

        return (DTPS[name]);
}

function nextSequence() {
        if (++SEQUENCE >= MAX_INT)
                SEQUENCE = 1;

        return (SEQUENCE);
}


function enqueue(list, obj) {
        return (list.unshift(obj));
}


function dequeue(list) {
        var obj = list.pop();
        if (obj)
                obj.atime = Date.now();

        return (obj);
}


function createPoolObject(client, id) {
        var obj = {
                id: id || nextSequence(),
                alive: true,
                client: client,
                atime: Date.now(),
                ctime: new Date().toISOString()
        };

        return (obj);
}


function getPoolObject(list, client, ignoreHealth) {
        for (var i = 0; i < list.length; i++) {
                if (list[i].client === client) {
                        list[i].atime = Date.now();
                        return (list[i]);
                }
        }
}


function removePoolObject(list, obj) {
        var l = list.filter(function (i) {
                if (i === obj) {
                        obj.alive = false;
                        obj.dtime = new Date().toISOString();
                        return (false);
                }

                return (true);
        });

        return (l);
}




///--- API

function Pool(options) {
        assert.object(options, 'options');
        assert.optionalFunc(options.assert, 'options.assert');
        assert.func(options.check, 'options.check');
        assert.number(options.checkInterval, 'options.checkInterval');
        assert.func(options.create, 'options.create');
        assert.object(options.log, 'options.log');
        assert.number(options.max, 'options.max');
        assert.number(options.maxIdleTime, 'options.maxIdleTime');
        assert.string(options.name, 'options.name');

        EventEmitter.call(this, options);

        this.available = [];
        this.assert = options.assert;
        this.create = options.create;
        this.check = options.check;
        this.checkInterval = options.checkInterval;
        this.destroy = options.destroy || false;
        this.events = (options.events || DEFAULT_EVENTS).slice();
        this.log = options.log.child({pool: options.name}, true);
        this.max = options.max;
        this.maxIdleTime = options.maxIdleTime;
        this.name = options.name;
        this.pendingResources = 0;
        this.probes = createDTraceProbes(this.name);
        this.queue = [];
        this.resources = [];
        this.stopped = false;
        this.stopping = false;
        this.timer = false;

        this._scheduleReaper();
}
util.inherits(Pool, EventEmitter);
module.exports = Pool;


Pool.prototype.acquire = function acquire(callback) {
        assert.func(callback, 'callback');

        callback = once(callback);

        if (this.stopping) {
                callback(new PoolShuttingDownError());
                return;
        }
        if (this.stopped) {
                callback(new PoolClosedError());
                return;
        }

        var log = this.log;
        var obj;
        var self = this;

        if (log.trace())
                log.trace({state: self._state()}, 'acquire entered');

        while ((obj = dequeue(this.available))) {
                if (this._ensure(obj)) {
                        this.probes.acquire.fire(function () {
                                return ([obj.id, self._state(true), obj.ctime]);
                        });
                        callback(null, obj.client);
                        return;
                }
        }

        if (this.resources.length + this.pendingResources >= this.max) {
                enqueue(this.queue, callback);
                this.probes.queue.fire(function () {
                        return ([0, self._state(true)]);
                });
                return;
        }

        this._create(function onCreatedClient(err, object) {
                if (err) {
                        callback(err);
                        return;
                }

                self.probes.acquire.fire(function () {
                        return ([object.id, self._state(true), object.ctime]);
                });
                callback(null, object.client);
        });
};


Pool.prototype.release = function release(client) {
        assert.object(client, 'client');

        var log = this.log;
        var obj;
        var self = this;
        var waiter;

        if (log.trace()) {
                log.trace({
                        state: self._state(),
                        client: client.toString()
                }, 'release: entered');
        }

        if (!(obj = getPoolObject(this.resources, client)))
                return;

        this.probes.release.fire(function () {
                return ([obj.id, self._state(true)]);
        });

        if (this.stopping || this.stopped) {
                this._kill(obj);
                this._emitDrain();
                return;
        }

        if (!this._ensure(obj))
                return;

        enqueue(this.available, obj);
        if ((waiter = dequeue(this.queue))) {
                process.nextTick(self.acquire.bind(self, waiter));
        } else {
                this._emitDrain();
        }
};


Pool.prototype.remove = function remove(client) {
        assert.object(client, 'client');

        var obj;
        var self = this;

        if (this.log.trace()) {
                this.log.trace({
                        state: this._state(),
                        client: client.toString()
                }, 'remove: entered');
        }

        if ((obj = getPoolObject(this.resources, client))) {
                this.probes.remove.fire(function () {
                        return ([obj.id, self._state(true)]);
                });
                this._kill(obj);
        }
};


Pool.prototype.shutdown = function shutdown(callback) {
        assert.optionalFunc(callback, 'callback');

        var cb = once(callback || function () {});
        var log = this.log;
        var self = this;

        function end() {
                while (self.resources.length !== 0) {
                        self._kill(self.resources[0]);
                }

                if (!self.stopped) {
                        log.trace('emitting end');
                        self.emit('end');
                }

                self.stopped = true;
                self.stopping = false;
                self._deadbeef = true;

                cb();
        }

        if (log.trace())
                log.trace({state: self._state()}, 'shutdown entered');

        if (this.stopped)
                return (end());

        self.probes.shutdown.fire(function () {
                var out = self.resources.length - self.available.length;
                return ([out, self._state(true)]);
        });

        this.stopping = true;
        if (this.timer)
                clearTimeout(this.timer);

        if (DTPS[self.name]) {
                var d = DTPS[self.name];
                Object.keys(d).forEach(function (k) {
                        if (k === '_provider')
                                return;

                        if (d._provider.removeProbe)
                                d._provider.removeProbe(d[k]);
                });

                if (d._provider.disable)
                        d._provider.disable();

                delete DTPS[self.name];
        }

        this.queue.forEach(function (w) {
                process.nextTick(function () {
                        w(new PoolShuttingDownError());
                });
        });
        this.queue.length = 0;

        if (this.available.length === this.resources.length) {
                process.nextTick(end);
        } else {
                this.once('drain', end);
        }

        return (undefined);
};


Pool.prototype.toString = function toString() {
        return (sprintf('[object Pool <%j>]', this._state()));
};



///--- Private methods

Pool.prototype._create = function _create(cb) {
        var nextId = nextSequence();
        var self = this;

        this.pendingResources++;

        this.create(function createCallback(err, client) {
                self.pendingResources = Math.max(self.pendingResources - 1, 0);

                // Handle shutdown being called while a
                // new client was being made
                if (err || self.stopped || self.stopping) {
                        if (client) {
                                if (typeof (self.destroy) === 'function')
                                        self.destroy(client);
                        }
                        cb(err || new PoolShuttingDownError());
                        return;
                }

                var obj = createPoolObject(client, nextId);

                self._watch(client);
                enqueue(self.resources, obj);

                self.probes.create.fire(function () {
                        return ([nextId, self._state(true)]);
                });

                cb(null, obj);
        });
};


Pool.prototype._emitDrain = function _emitDrain() {
        var self = this;

        if (this.stopped)
                return;

        if (self.available.length === self.resources.length)
                self.emit('drain');
};


Pool.prototype._ensure = function _ensure(obj) {
        var ok = false;
        var self = this;

        if (obj.alive) {
                try {
                        ok = this.assert(obj.client);
                        if (ok === undefined)
                                ok = true;
                } catch (e) {
                        ok = false;
                }
        }

        this.probes.assert.fire(function () {
                return ([obj.id, self._state(true), ok ? 1 : 0]);
        });

        if (!ok) {
                this._kill(obj);
                return (false);
        }

        return (true);
};


Pool.prototype._reap = function _reap() {
        if (this.stopped || this.stopping)
                return;

        var now = Date.now();
        var toCheck = [];
        var self = this;

        // Kind of ghetto - we temporarily purge the available list
        // and then run health checks over those that need it.
        this.available = this.available.filter(function (obj) {
                var skip = ((now - obj.atime) < self.maxIdleTime);
                if (!skip)
                        toCheck.push(obj);

                return (skip);
        });

        if (toCheck.length === 0) {
                self._scheduleReaper();
                return;
        }

        this.probes.check.fire(function () {
                return ([toCheck.length, self._state(true)]);
        });

        // Run over all the "locked" items in ||
        var opts = {
                func: function iterator(obj, cb) {
                        cb = once(cb);

                        if (!self._ensure(obj)) {
                                cb(new DeadClientError());
                                return;
                        }

                        try {
                                self.check(obj.client, function (err) {
                                        cb(err, obj);
                                });
                        } catch (e) {
                                cb(e);
                        }
                },
                inputs: toCheck
        };
        vasync.forEachParallel(opts, function (err, results) {
                results.operations.forEach(function (op) {
                        if (op.status === 'ok') {
                                self.available.push(op.result);
                        } else if (op.result) {
                                self._kill(op.result);
                        }
                });
                self._emitDrain();
                self._scheduleReaper();
        });
};


Pool.prototype._kill = function _kill(obj) {
        if (!obj)
                return;

        var log = this.log;
        var self = this;

        if (log.trace())
                log.trace({state: self._state()}, 'killing object: %d', obj.id);

        // Deregister
        if (obj.client instanceof EventEmitter) {
                self.events.forEach(function (e) {
                        (obj.client.listeners(e) || []).forEach(function (l) {
                                if (l.name === '__poolingWatch')
                                        obj.client.removeListener(e, l);
                        });
                });
        }

        this.available = removePoolObject(this.available, obj);
        this.resources = removePoolObject(this.resources, obj);

        this.probes.kill.fire(function () {
                return ([obj.id, self._state(true)]);
        });

        if (typeof (this.destroy) === 'function')
                this.destroy(obj.client);

        this.emit('death', obj.client);
};


Pool.prototype._scheduleReaper = function _scheduleReaper() {
        var self = this;

        if (this.stopped || this.stopping) {
                clearTimeout(this.timer);
                return;
        }

        if (this.checkInterval > 0 && this.checkInterval !== false) {
                this.timer = setTimeout(function healthCheck() {
                        self._reap();
                }, this.checkInterval);
        }
};


Pool.prototype._state = function _state(brief) {
        var self = this;

        return {
                available: self.available.length,
                resources: self.resources.length,
                queue: self.queue.length,
                max: self.max,
                pending: self.pendingResources,
                stopped: !brief ? self.stopped : undefined,
                stopping: !brief ? self.stopping : undefined
        };
};


Pool.prototype._watch = function _watch(client) {
        if (this.stopped || this.stopping)
                return;

        var log = this.log;
        var obj;
        var self = this;

        if (!(client instanceof EventEmitter))
                return;

        this.events.forEach(function (e) {
                client.once(e, function __poolingWatch() {
                        if (log.trace()) {
                                var a = Array.prototype.slice.call(arguments);
                                log.trace({
                                        args: a.join(', '),
                                        event: e,
                                        state: self._state()
                                }, 'client event triggering removal');
                        }

                        if ((obj = getPoolObject(self.resources, client, true)))
                                self._kill(obj);
                });
        });
};
