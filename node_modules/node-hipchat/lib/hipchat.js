(function() {
  var HipChatClient, exports, https, querystring, _;
  https = require('https');
  querystring = require('querystring');
  _ = require('underscore');
  HipChatClient = (function() {
    HipChatClient.prototype.host = 'api.hipchat.com';
    function HipChatClient(apikey) {
      this.apikey = apikey;
    }
    HipChatClient.prototype.listRooms = function(callback) {
      var options;
      options = this._prepareOptions({
        method: 'get',
        path: '/v1/rooms/list'
      });
      return this._sendRequest(options, callback);
    };
    HipChatClient.prototype.showRoom = function(room, callback) {
      var options;
      options = this._prepareOptions({
        method: 'get',
        path: '/v1/rooms/show',
        query: {
          room_id: room
        }
      });
      return this._sendRequest(options, callback);
    };
    HipChatClient.prototype.getHistory = function(params, callback) {
      var options, _ref, _ref2;
      options = this._prepareOptions({
        method: 'get',
        path: '/v1/rooms/history',
        query: {
          room_id: params.room,
          date: (_ref = params.date) != null ? _ref : 'recent',
          timezone: (_ref2 = params.timezone) != null ? _ref2 : 'UTC'
        }
      });
      return this._sendRequest(options, callback);
    };
    HipChatClient.prototype.postMessage = function(params, callback) {
      var options, _ref, _ref2;
      options = this._prepareOptions({
        method: 'post',
        path: '/v1/rooms/message',
        data: {
          room_id: params.room,
          from: (_ref = params.from) != null ? _ref : 'node-hipchat',
          message: params.message,
          notify: params.notify ? 1 : 0,
          color: (_ref2 = params.color) != null ? _ref2 : 'yellow'
        }
      });
      return this._sendRequest(options, callback);
    };
    HipChatClient.prototype._prepareOptions = function(op) {
      op.host = this.host;
      if (op.query == null) {
        op.query = {};
      }
      op.query['auth_token'] = this.apikey;
      op.query = querystring.stringify(op.query);
      op.path += '?' + op.query;
      if (op.method === 'post' && (op.data != null)) {
        op.data = querystring.stringify(op.data);
        if (op.headers == null) {
          op.headers = {};
        }
        op.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        op.headers['Content-Length'] = op.data.length;
      }
      return op;
    };
    HipChatClient.prototype._sendRequest = function(options, callback) {
      var req;
      req = https.request(options);
      req.on('response', function(res) {
        var buffer;
        buffer = '';
        res.on('data', function(chunk) {
          return buffer += chunk;
        });
        return res.on('end', function() {
          var value;
          if (callback != null) {
            if (res.statusCode === 200) {
              value = options.json === false ? buffer : JSON.parse(buffer);
              return callback(value, null);
            } else {
              return callback(null, buffer);
            }
          }
        });
      });
      if (options.data != null) {
        req.write(options.data);
      }
      return req.end();
    };
    return HipChatClient;
  })();
  exports = module.exports = HipChatClient;
}).call(this);
