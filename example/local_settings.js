exports.config = {
  name: 'Tapkick Deploy',
  env: 'production',
  data_root: './data',
  htpasswd_file: './htpasswd',
  secure: false,
  login_required: false,
  stacks: {
    tapkick: {
      git_url: 'https://github.com/philips/tapkick.git',
      tip: 'master',
      tip_ttl: 120 * 1000,
      regions: ['all']
    },
  },
  tapkick_dir: 'data/tapkick',
  github: {
    organization: 'philips'
  },
};
