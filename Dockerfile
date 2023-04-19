# node > 14.6.0 is required for the SFDX-Git-Delta plugin
FROM node:lts-alpine

WORKDIR /usr/app

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
      jq \
      chromium

# install node packages
RUN npm install @salesforce/sfdx-scanner --global
      npm install --global dxb && \
      npm install --global sfdx-cli --force && \
      sfdx plugins:link $(npm root -g)/dxb && \
      sfdx plugins:link $(npm root -g)/@salesforce/sfdx-scanner && \
      npm install --global vlocity && \
      export PUPPETEER_SKIP_DOWNLOAD=true && \
      npm install --global puppeteer --unsafe-perm

RUN sfdx --version
RUN sfdx dxb --help
RUN vlocity help