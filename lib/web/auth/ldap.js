/*
 *  Copyright 2015 Pipedrive Inc (Martin Tajur)
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

var LdapAuthLib = require('ldapauth');

var LdapAuth = function(config) {
    this.config = config;
};

LdapAuth.prototype.validate = function(username, password, callback) {
    if (username && password) {
        username.replace('/[\s,]/ig','');

        var auth = new LdapAuthLib(this.config.ldap);
        auth.authenticate(username, password, function(err, authedUser) {
            callback(null, !err);
        });
    }

};

exports.initialize = function(config) {
    if (!config.ldap || !config.ldap.adminDn) {
        throw new Error('Auth method is set to LDAP but local_settings.js is missing LDAP configuration');
    }

    return new LdapAuth(config);
};
