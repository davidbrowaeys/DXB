# node > 14.6.0 is required for the SFDX-Git-Delta plugin
FROM node:14

WORKDIR /usr/app

#add usefull tools
RUN apt-get update
RUN apt-get install -y jq

# install node packages
RUN npm install --global dxb && npm install --global sfdx-cli --force && sfdx plugins:link $(npm root -g)/dxb && npm install --global vlocity && export PUPPETEER_SKIP_DOWNLOAD=true && npm install --global puppeteer --unsafe-perm
# RUN npm install @salesforce/sfdx-scanner --global
#       npm install --global dxb && \
#       npm install --global sfdx-cli --force && \
#       sfdx plugins:link $(npm root -g)/dxb && \
#       sfdx plugins:link $(npm root -g)/@salesforce/sfdx-scanner && \
#       npm install --global vlocity && \
#       export PUPPETEER_SKIP_DOWNLOAD=true && \
#       npm install --global puppeteer --unsafe-perm

RUN sfdx --version
RUN sfdx dxb --help
RUN vlocity help