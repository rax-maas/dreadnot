# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure(2) do |config|
  config.vm.box = "boxcutter/ubuntu1404"

  config.vm.synced_folder ".", "/home/vagrant/dreadnot"

  config.vm.network "forwarded_port", guest: 8000, host: 8000
  config.vm.network "private_network", type: "dhcp"

  if Vagrant.has_plugin?("vagrant-cachier")
    config.cache.scope = :box
    config.cache.synced_folder_opts = {
      type: :nfs,
      mount_options: ['rw', 'vers=3', 'tcp', 'nolock']
    }
  end

  config.vm.provision "shell", path: "example/provision.sh"
end
