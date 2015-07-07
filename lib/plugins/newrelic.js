var request = require('request');


var log = require('logmagic').local('plugins.newrelic');

exports.run = function(dreadnot) {
  var config = dreadnot.config.plugins.newrelic;


  log.info('loaded');

  dreadnot.emitter.on('deployments', function(deployment) {
    var endPath = [
      'stacks',
      deployment.stack,
      'regions',
      deployment.region,
      'deployments',
      deployment.deployment,
      'end'
    ].join('.');

    dreadnot.emitter.once(endPath, function(success) {
      if(success)
      {
        var app_ids = dreadnot.config.stacks[deployment.stack].newrelic_app_ids
        if (app_ids)
        {
          app_ids.forEach(function(app_id)
          {
            var post_options = {
              method: 'POST',
              url: 'https://api.newrelic.com/deployments.xml',
              headers : {
                'x-api-key': config.api_key,
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              formData: {
                'deployment[application_id]': app_id,
                'deployment[revision]': deployment.to_revision,
                'deployment[user]': deployment.user + ' ('+ (config.name) + ')'
              }
            };
            request(post_options, function(error, response, body) {
              log.info(JSON.stringify(body, null, 4));
            });
          });
        }
        else{
          log.info('No New Relic App Id for ' + deployment.stack);
        }
      }
    });
  });
};

