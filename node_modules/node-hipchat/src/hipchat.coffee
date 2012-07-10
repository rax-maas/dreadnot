https       = require 'https'
querystring = require 'querystring'
_           = require 'underscore'

class HipChatClient
	
	host:    'api.hipchat.com'
	
	constructor: (@apikey) ->
		
	listRooms: (callback) ->
		options = @_prepareOptions
			method: 'get'
			path:   '/v1/rooms/list'
		@_sendRequest options, callback
	
	showRoom: (room, callback) ->
		options = @_prepareOptions
			method: 'get'
			path:   '/v1/rooms/show'
			query:
				room_id: room
		@_sendRequest options, callback

	getHistory: (params, callback) ->
		options = @_prepareOptions
			method: 'get'
			path:   '/v1/rooms/history'
			query:
				room_id:  params.room
				date:     params.date ? 'recent'
				timezone: params.timezone ? 'UTC'
		@_sendRequest options, callback

	postMessage: (params, callback) ->
		options = @_prepareOptions
			method: 'post'
			path:   '/v1/rooms/message'
			data:
				room_id: params.room
				from:    params.from ? 'node-hipchat'
				message: params.message
				notify:  if params.notify then 1 else 0
				color:   params.color ? 'yellow'
		@_sendRequest options, callback
	
	_prepareOptions: (op) ->
		op.host = @host
		
		op.query = {} unless op.query?
		op.query['auth_token'] = @apikey
		op.query = querystring.stringify(op.query)
		op.path += '?' + op.query
		
		if op.method is 'post' and op.data?
			op.data = querystring.stringify(op.data)
			op.headers = {} unless op.headers?
			op.headers['Content-Type']   = 'application/x-www-form-urlencoded'
			op.headers['Content-Length'] = op.data.length
		
		return op
	
	_sendRequest: (options, callback) ->
		req = https.request(options)
		
		req.on 'response', (res) ->
			buffer = ''
			res.on 'data', (chunk) ->
				buffer += chunk
			res.on 'end', ->
				if callback?
					if res.statusCode is 200
						value = if options.json is false then buffer else JSON.parse(buffer)
						callback(value, null)
					else
						callback(null, buffer)

		if options.data? then req.write(options.data)
		req.end()

exports = module.exports = HipChatClient