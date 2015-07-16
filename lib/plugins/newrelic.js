/*
 *  Copyright 2011 Rackspace
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

exports.run = function (dreadnot) {
    var config = dreadnot.config.plugins.newrelic,
        newrelic = require('pipedrive-newrelic');

    dreadnot.emitter.on('deployments', function (deployment) {
        var timestamp = new Date();
        console.log('DEBUG: measuring new deployment for NR', deployment);
        endPath = [
            'stacks',
            deployment.stack,
            'regions',
            deployment.region,
            'deployments',
            deployment.deployment,
            'end'
        ].join('.');

        dreadnot.emitter.once(endPath, function (success, asd) {
            var endTimestamp = new Date();

            newrelic.recordCustomEvent('Deployments', {
                'duration': (endTimestamp - timestamp) / 1000,
                'stack': deployment.stack,
                'region': deployment.region,
                'status': success ? 'success' : 'failed',
                'user': deployment.user,
                'team': 'unknown'
            });
        });

    });
};
