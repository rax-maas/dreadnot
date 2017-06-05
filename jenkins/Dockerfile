FROM node:4
MAINTAINER Rackspace Monitoring ele-dev@lists.rackspace.com

RUN useradd -ms /bin/bash jenkins
USER jenkins

ADD . /home/jenkins/dreadnot

WORKDIR /home/jenkins
