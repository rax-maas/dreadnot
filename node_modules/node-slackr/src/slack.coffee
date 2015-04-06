request = require 'request'
_ = require 'lodash'

class Slack
  constructor: (@incomingUrl, @options) ->
    @validateArguments()
  
  validateArguments: ->
    return throw new Error "Incoming url required" unless @incomingUrl?

  notify: (message, callback)->

    if !message? or (_.isObject message and !message?.text?)
      return throw new Error 'Message required' 

    options = {}
    options.text = if typeof message is 'string' then message else message.text
    options.channel = unless message.channel? then '#general' else message.channel
    options = _.extend options, @options
    options = _.extend options, message


    if _.isArray(options.channel)
      total = options.channel.length
      count = 0
      for chn in options.channel
        options.channel = chn
        request.post @incomingUrl, body:JSON.stringify(options), (err, resp, body) ->
          count++
          if callback? and count is total
            if body is 'ok'
              callback null, body
            else
              callback err || body
      

    else
      request.post @incomingUrl, body:JSON.stringify(options), (err, resp, body) ->
        if callback?
          if body is 'ok'
            callback null, body
          else
            callback err || body

module.exports = Slack
