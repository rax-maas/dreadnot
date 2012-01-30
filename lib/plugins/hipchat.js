/*
 *  Copyright 2011 Brian McKinney (@tritonrc)
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

var Hipchat = require('node-hipchat')

var sprintf = require('util/sprintf')

exports.run = function(dreadnot) {
  var config = dreadnot.config.plugins.hipchat
    , hipchat = new Hipchat(config.apiKey)

  dreadnot.emitter.on('deployments', function(deployment) {
    var link = sprintf(
          '%s/stacks/%s/regions/%s/deployments/%s'
          , dreadnot.config.default_url
          , deployment.stack
          , deployment.region
          , deployment.deployment
        )
      , msg = sprintf(
          '%s is deploying %s to %s:%s - %s'
          , deployment.user
          , deployment.stack
          , dreadnot.config.env
          , deployment.region
          , link
        )
      , endPath = [
          'stacks'
          , deployment.stack
          , 'regions'
          , deployment.region
          , 'deployments'
          , deployment.deployment
          , 'end'
        ].join('.')

    config.rooms.forEach(function(room, ix) {
      hipchat.postMessage({room: room, from: config.name, message: msg})
    })

    dreadnot.emitter.once(endPath, function(success) {
      var endMsg = sprintf(
          'deployment #%s of %s to %s:%s %s'
          , deployment.deployment
          , deployment.stack
          , dreadnot.config.env
          , deployment.region
          , success ? 'succeeded' : '\u0002FAILED\u000f'
        )

      config.rooms.forEach(function(room, ix) {
        hipchat.postMessage({room: room, from: config.name, message: endMsg})
      })
    })
  })
}
