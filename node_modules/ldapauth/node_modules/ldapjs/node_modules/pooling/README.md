# Overview

[pooling](https://github.com/mcavage/node-pooling) is a small general purpose
resource pooling library.  It is heavily inspired from
[James Cooper's](http://bitmechanic.com/) excellent
[generic-pool](https://github.com/coopernurse/node-pool) library.  This library
was written after using that library for some time and desiring extra
functionality (namely watching events and health checking).

# Usage

    var EventEmitter = require('events').EventEmitter;
    var pooling = require('pooling');

    var pool = pooling.createPool({
            checkInterval: 30000, // 30s (default is 30s)
            max: 10,              // Default is 1
            maxIdleTime: 120000,  // 2m (default is 1 hour)
            name: 'my pool',

            // Health check. Call the callback with an Error if you want
            // to indicate this client should die. destroy will still be
            // called (i.e., don't "double free").
            //
            // This function is called when an object is unused for
            // >= maxIdleTime.  If you don't provide a check function,
            // the default behavior is to mark the client for death.
            check: function check(client, callback) {
                    if ((client.id % 2) !== 0)
                                return callback(new Error());

                    return callback(null);
            },

            // callback is of the form function (err, client).
            create: function create(callback) {
                    var client = new EventEmitter();
                    client.id = Math.floor(Math.random() * 1000);
                    return callback(null, client);
            },

            // destroy is for you to do cleanup with; the pool will have already
            // discarded the object (hence no callback)
            destroy: function destroy(client) {
                    client.was = client.id;
                    client.id = -1;
            }
        });

        pool.on('create', function (client) {
                console.log('client %d created', client.id);
        });

        pool.on('death', function (client) {
                console.log('client %d was killed', client.was);
        });

        pool.on('drain', function () {
                console.log('pool has no backlog or outstanding clients');
        });

        pool.acquire(function (err, client) {
                if (err) {
                        console.error('Unable to acquire: %s', err.stack);
                        process.exit(1);
                }

                pool.release(client);
                client.emit('error', new Error('die now'));
        });

        // Gracefully block future acquire calls and wait for clients to be
        // released
        pool.shutdown(function () {
                console.log('done');
                process.exit(0);
        });

By default the pool will remove clients on `close`, `end`, `error` and `timeout`
events.  You can override this by passing in an `events` array at pool creation
time.  You can also pass in a [Bunyan](https://github.com/trentm/node-bunyan)
`Logger` - `pooling` logs everything at the `trace` level.

# Install

        npm install pooling

# Development

To run unit tests and lint/style checks, just run:

        make prepush

You can generate coverage data by running:

        make cover

And opening `./cover_data/index.html`.


# License

The MIT License (MIT)
Copyright (c) 2012 Mark Cavage

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
