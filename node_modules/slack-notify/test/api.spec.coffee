slack = null

describe 'No URL passed in', ->
  beforeEach ->
    spyOn(console, 'log')
    slack = require('../slack-notify.js')('')

  it 'should log to console that no URL is present', ->
    slack.send('Hello!')
    expect(console.log).toHaveBeenCalledWith('No Slack URL configured.')

describe 'API', ->
  url = 'https://myaccountname.slack.com/services/hooks/incoming-webhook?token=myToken'

  beforeEach ->
    slack = require('../slack-notify.js')(url)
    spyOn(slack, 'request')

  it 'slack.send', ->
    slack.send('Hello!')
    expect(slack.request).toHaveBeenCalledWith
      channel: '#general'
      username: 'Robot'
      text: 'Hello!'
      icon_emoji: ':bell:'

  it 'slack.success', ->
    slack.success('Hello!')
    expect(slack.request).toHaveBeenCalledWith
      channel: '#alerts'
      username: 'Hoorah'
      text: 'Hello!'
      icon_emoji: ':trophy:'

  it 'slack.bugs', ->
    slack.bug('Hello!')
    expect(slack.request).toHaveBeenCalledWith
      channel: '#bugs'
      username: 'Bug'
      text: 'Hello!'
      icon_emoji: ':bomb:'

  it 'slack.notes', ->
    slack.note('Hello!')
    expect(slack.request).toHaveBeenCalledWith
      channel: '#alerts'
      username: 'Note'
      text: 'Hello!'
      icon_emoji: ':bulb:'

  it 'slack.alerts', ->
    slack.alert('Hello!')
    expect(slack.request).toHaveBeenCalledWith
      channel: '#alerts'
      username: 'Alert'
      text: 'Hello!'
      icon_emoji: ':warning:'

  it 'slack.alerts with extra fields', ->
    slack.alert
      text: 'Hello!'
      fields:
        IP: '123.123.123.123'
        sha: '2fd4e1c67a2d28fced849ee1bb76e7391b93eb12'

    expect(slack.request).toHaveBeenCalledWith
      channel: '#alerts'
      username: 'Alert'
      text: 'Hello!'
      icon_emoji: ':warning:'
      attachments: [
        {
          fallback: 'Alert details'
          fields: [
            { title: 'IP', value: '123.123.123.123', short: true }
            { title: 'sha', value: '2fd4e1c67a2d28fced849ee1bb76e7391b93eb12', short: false }
          ]
        }
      ]

  it 'slack.extend', ->
    foo = slack.extend
      channel: '#foo'
      icon_emoji: ':saxophone:'
      username: 'Foo'

    foo('Hello!')
    expect(slack.request).toHaveBeenCalledWith
      channel: '#foo'
      username: 'Foo'
      text: 'Hello!'
      icon_emoji: ':saxophone:'

  it 'slack.send with icon_url', ->
    slack.send
      text: 'Hello!'
      icon_url: 'http://something.com/icon.png'

    expect(slack.request).toHaveBeenCalledWith
      channel: '#general'
      username: 'Robot'
      text: 'Hello!'
      icon_url: 'http://something.com/icon.png'

  it 'slack.send with attachments and extra fields', ->
    slack.send
      text: 'Hello!'
      attachments: [
        {
          fallback: 'Fallback'
          fields: [
            { title: 'CPU %', value: '90%', short: true }
            { title: 'RAM %', value: '47%', short: true }
          ]
        }
      ]
      fields:
        IP: '123.123.123.123'
        sha: '2fd4e1c67a2d28fced849ee1bb76e7391b93eb12'

    expect(slack.request).toHaveBeenCalledWith
      channel: '#general'
      username: 'Robot'
      text: 'Hello!'
      icon_emoji: ':bell:'
      attachments: [
        {
          fallback: 'Fallback'
          fields: [
            { title: 'CPU %', value: '90%', short: true }
            { title: 'RAM %', value: '47%', short: true }
          ]
        },
        {
          fallback: 'Alert details'
          fields: [
            { title: 'IP', value: '123.123.123.123', short: true }
            { title: 'sha', value: '2fd4e1c67a2d28fced849ee1bb76e7391b93eb12', short: false }
          ]
        }
      ]
