#!/bin/bash

apt-get -qq update
apt-get install -y git nodejs npm

# ubuntu calls it nodejs because package name collision
if [ ! -f "/usr/bin/node" ]; then
  ln -s /usr/bin/nodejs /usr/bin/node
fi

# this repo is hardcoded in example/local_settings.js
if [ ! -d "/data/tapkick" ]; then
  git clone https://github.com/philips/tapkick.git /data/tapkick
  cd /data/tapkick && git reset --hard 'HEAD^^^'
  chown -R vagrant:vagrant /data/tapkick
fi

# Dreadnot Upstart service
cat <<EOH > /etc/init/dreadnot.conf
description "dreadnot"
start on runlevel [2345]
respawn 
exec su - vagrant --command "/home/vagrant/dreadnot/bin/dreadnot \
    -c /home/vagrant/dreadnot/example/local_settings.js \
    -s /home/vagrant/dreadnot/example/stacks -p 8000 2>&1"
EOH

initctl reload-configuration
start dreadnot || restart dreadnot

