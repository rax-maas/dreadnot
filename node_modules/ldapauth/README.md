A simple node.js lib to authenticate against an LDAP server.


# Usage

    var LdapAuth = require('ldapauth');
    var options = {
        url: 'ldaps://ldap.example.com:663',
        ...
    };
    var auth = new LdapAuth(options);
    ...
    auth.authenticate(username, password, function(err, user) { ... });
    ...
    auth.close(function(err) { ... })


# Install

    npm install ldapauth


# License

MIT. See "LICENSE" file.


# `LdapAuth` Config Options

[Use the source Luke](https://github.com/trentm/node-ldapauth/blob/master/lib/ldapauth.js#L25-53)


# express/connect basicAuth example

    var connect = require('connect');
    var LdapAuth = require('ldapauth');

    // Config from a .json or .ini file or whatever.
    var config = {
      ldap: {
        url: "ldaps://ldap.example.com:636",
        adminDn: "uid=myadminusername,ou=users,o=example.com",
        adminPassword: "mypassword",
        searchBase: "ou=users,o=example.com",
        searchFilter: "(uid={{username}})"
      }
    };

    var ldap = new LdapAuth({
      url: config.ldap.url,
      adminDn: config.ldap.adminDn,
      adminPassword: config.ldap.adminPassword,
      searchBase: config.ldap.searchBase,
      searchFilter: config.ldap.searchFilter,
      //log4js: require('log4js'),
      cache: true
    });

    var basicAuthMiddleware = connect.basicAuth(function (username, password, callback) {
      ldap.authenticate(username, password, function (err, user) {
        if (err) {
          console.log("LDAP auth error: %s", err);
        }
        callback(err, user)
      });
    });


# Development

Check coding style before commit:

    make check

To cut a release (tagging, npm publish, etc., see
<https://github.com/trentm/cutarelease> for details):

    make cutarelease
