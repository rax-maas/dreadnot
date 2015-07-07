![travis-ci](https://travis-ci.org/chenka/node-slackr.svg)

Summary
=======
A simple node.js library for send notifications to [Slack](https://slack.com/) via Incoming WebHooks.


Installation
=======
You can also install via npm:
```sh
npm install node-slackr
```

Initialize client:

```js
Slack = require('node-slackr');
slack = new Slack('https://<incoming-hook-url>');
```

Initialize with options:
```js
slack = new Slack('https://<incoming-hook-url>',{
  channel: "#development",
  username: "slack-bot",
  icon_url: "http://domain.com/image.png",
  icon_emoji: ":ghost:"  
});
```

###Send message:

If channel is not set default channel is *#general*
```js
slack.notify("Message"); //without callback
slack.notify("Message", function(err, result){
    console.log(err,result);
});

```

###Customized Appearance:

You can customize the name and icon of your Incoming Webhook.

```js
messages = {
    text: "Message",
    channel: "#random",
    username: "new-bot-name",
    icon_url: "https://slack.com/img/icons/app-57.png"
}
    
slack.notify(messages);
```

Send multiple channels:
```js
messages = {
    text: "Message",
    channel: ["#channel1","#channel2","#channel3"]
}
    
slack.notify(messages);
```


###Message Attachments:
To display a richly-formatted message attachment in Slack, you can use the same JSON payload as above, but add in an attachments array. Each element of this array is a hash containing the following parameters:

```js
messages = {
  text: "Server Down",
  channel: "#alert"
  attachments: [
    {
      fallback: "Detected server down",
      color: "#36a64f", // Can either be one of 'good', 'warning', 'danger'
      fields: [
        {
          title: "Uptime",
          value: "30 Hours",
          short: false 
        },
        {
          title: "Downtime",
          value: "20 Minutes",
          short: false 
        }
      ]
    }
  ]
};

slack.notify(messages, function(err, result) {
    console.log(err, result);
});

```

###Documentation

For more information such as send URL link, Message Formatting, @mention and Parsing modes,  please follow the link below

[Formatting](https://api.slack.com/docs/formatting)

[Incomg Webook](https://my.slack.com/services/new/incoming-webhook)


