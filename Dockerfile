FROM node:18

RUN npm install --global @salesforce/sfdx-scanner
RUN npm install --global dxb
RUN npm install --global @cparra/apexdocs
RUN npm install --global sfdx-cli --force
RUN sfdx plugins:link $(npm root -g)/dxb
RUN sfdx plugins:link $(npm root -g)/@salesforce/sfdx-scanner
RUN npm install --global vlocity
RUN export PUPPETEER_SKIP_DOWNLOAD=true && npm install --global puppeteer --unsafe-perm

#add usefull tools
RUN apt-get update && apt-get install -y jq && apt-get -y install default-jdk

RUN apt-get update -qq && \
  apt-get -qqy install gnupg wget && \
  wget --quiet --output-document=- https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /etc/apt/trusted.gpg.d/google-archive.gpg && \
  sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' && \
  apt-get -qqy --no-install-recommends install chromium && \
  rm -f -r /var/lib/apt/lists/*

RUN /usr/bin/chromium --no-sandbox --version > /etc/chromium-version