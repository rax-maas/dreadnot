# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure(2) do |config|
  config.vm.box = "boxcutter/ubuntu1504"

  config.vm.network "forwarded_port", guest: 8000, host: 8000
  config.vm.network "private_network", type: "dhcp"

  if Vagrant.has_plugin?("vagrant-cachier")
    config.cache.scope = :box
    config.cache.synced_folder_opts = {
      type: :nfs,
      mount_options: ['rw', 'vers=3', 'tcp', 'nolock']
    }
  end

  config.vm.provision "shell", inline: <<-SHELL
    apt-get update
    apt-get install -y git nodejs npm
    # ubuntu calls it nodejs because package name collision
    ln -s /usr/bin/nodejs /usr/bin/node

    # this value is hardcoded in local_settings.js
    git clone git://github.com/philips/tapkick.git /data/tapkick
    cd /data/tapkick && git reset --hard 'HEAD^^^'

    /vagrant/bin/dreadnot \
      -c /vagrant/example/local_settings.js \
      -s /vagrant/example/stacks -p 8000
  SHELL
end
