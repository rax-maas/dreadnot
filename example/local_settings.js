exports.config = {
  name: 'Tapkick Deploy',
  env: 'production',
  data_root: './data',
  auth_method: 'ldap', // ldap or htpasswd
  htpasswd_file: './htpasswd',
  secure: false,
  login_required: false,
  stacks: {
    tapkick: {
      git_url: 'git://github.com/philips/tapkick.git',
      tip: 'master',
      tip_ttl: 120 * 1000,
      regions: ['all']
    },
  },
  tapkick_dir: '/data/tapkick',
  github: {
    organization: 'philips'
  },
  ldap:{
    url:"ldap://ipa:389",
    adminDn: "uid=freeipa-bin,cn=users,cn=accounts,dc=somecompany,dc=com",
    adminPassword: "secret",
    searchBase: "cn=users,cn=accounts,dc=somecompany,dc=com",
    searchFilter: "(&(memberOf=cn=dreadnot,cn=groups,cn=accounts,dc=somecompany,dc=com)(uid={{username}}))"
  },
};
