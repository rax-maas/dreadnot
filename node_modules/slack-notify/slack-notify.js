/*

slack-notify
https://github.com/andrewchilds/slack-notify

*/

var exec = require('child_process').exec;
var _ = require('lodash');

module.exports = function (url) {
  var pub = {};

  pub.request = function (data) {
    if (!url) {
      console.log('No Slack URL configured.');
      return false;
    }

    var command = "curl -X POST --data 'payload=" + JSON.stringify(data) + "' " + url;
    exec(command, function (err, stdout, stderr) {
      if (err) {
        console.log('Error while sending Slack request:', err);
      }
    });
  };

  pub.send = function (options) {
    if (_.isString(options)) {
      options = { text: options };
    }

    // Merge options with defaults
    var defaults = {
      channel: '#general',
      username: 'Robot',
      text: '',
      icon_emoji: ':bell:'
    };
    var data = _.assign(defaults, options);

    // Move the fields into attachments
    if (options.fields) {
      if (!data.attachments) {
        data.attachments = [];
      }

      data.attachments.push({
        fallback: 'Alert details',
        fields: _.map(options.fields, function (value, title) {
          return {
            title: title,
            value: value,
            short: (value + '').length < 25
          };
        })
      });

      delete(data.fields);
    }

    // Remove the default icon_emoji if icon_url was set in options. Otherwise the default emoji will always override the url
    if (options.icon_url && !options.icon_emoji) {
      delete(data.icon_emoji);
    }

    pub.request(data);
  };

  pub.extend = function (defaults) {
    return function (options) {
      if (_.isString(options)) {
        options = { text: options };
      }

      pub.send(_.extend(defaults, options));
    };
  };

  pub.bug = pub.extend({
    channel: '#bugs',
    icon_emoji: ':bomb:',
    username: 'Bug'
  });

  pub.alert = pub.extend({
    channel: '#alerts',
    icon_emoji: ':warning:',
    username: 'Alert'
  });

  pub.note = pub.extend({
    channel: '#alerts',
    icon_emoji: ':bulb:',
    username: 'Note'
  });

  pub.success = pub.extend({
    channel: '#alerts',
    icon_emoji: ':trophy:',
    username: 'Hoorah'
  });

  return pub;
};
