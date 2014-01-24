# lazy-socket

[![Build Status](https://secure.travis-ci.org/felixge/node-lazy-socket.png)](http://travis-ci.org/felixge/node-lazy-socket)

A stateless socket that always lets you write().

If there is an error, all previous `write()` callbacks will be honored. A new
connection will be established as soon as the next `write()` occurs. Writes
will not be retried.

## Install

```
npm install lazy-socket
```

## Usage

```js
var LazySocket = require('lazy-socket');
var socket = LazySocket.createConnection(80, 'example.org');
socket.write('something', 'utf-8', function(err) {
  // Even if example.org is down, this callback is guaranteed to fire, and
  // there is no more error handling to do on your end.
});
```

## License

This module is licensed under the MIT license.
