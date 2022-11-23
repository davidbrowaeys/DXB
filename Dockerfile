# node > 14.6.0 is required for the SFDX-Git-Delta plugin
FROM node:lts-alpine

#add usefull tools
RUN apk add --update --no-cache  \
      git \
      findutils \
      bash \
      unzip \
      curl \
      wget \
      npm \
      openjdk11 \
      openssh-client \
      perl \
      jq

# install node packages
RUN npm install sfdx-cli --global
RUN npm install --global puppeteer
RUN npm install --global vlocity

#install sfdx plugins
RUN sfdx --version
RUN echo 'y' | sfdx plugins:install dxb
RUN echo 'y' | sfdx plugins:install @sfdx-plugins-lab/plugin-apex-coverage
RUN sfdx plugins:install @salesforce/sfdx-scanner

RUN sfdx plugins