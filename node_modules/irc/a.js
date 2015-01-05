var irc = require('./lib/irc');
var client = new irc.Client('irc.freenode.net', 'test378546',
    {
        channels:['#node.ks'],
        debug: true,
    }
);

//client.addListener('raw', function(message) { console.log('raw: ', message) });
//client.addListener('error', function(message) { console.log(color('error: ', 'red'), message) });
