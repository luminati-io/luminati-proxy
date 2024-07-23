#
# luminati-proxy Dockerfile
#
# https://github.com/luminati-io/luminati-proxy
#

# Pull base image.
FROM node:20.12.1-bookworm

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

RUN apt-get update && apt-get install -y gconf-service libasound2 libatk1.0-0 \
    libcairo2 libcups2 libfontconfig1 libgdk-pixbuf2.0-0 libgtk-3-0 libnspr4 \
    libpango-1.0-0 libxss1 fonts-liberation libappindicator1 libnss3 \
    lsb-release xdg-utils ca-certificates

# Install latest chrome dev package and fonts to support major charsets (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
# Note: this installs the necessary libs to make the bundled version of Chromium that Puppeteer installs, work.
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
RUN sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
RUN wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
RUN dpkg -i google-chrome-stable_current_amd64.deb --fix-missing; apt-get -fy install
RUN rm -rf /var/lib/apt/lists/*
RUN rm google-chrome-stable_current_amd64.deb

USER root
RUN npm install -g npm@8.6.0
RUN npm config set user root

# Install Proxy Manager
RUN npm install -g @luminati-io/luminati-proxy --legacy-peer-deps

# Mark environment as Docker for CLI output
ENV DOCKER 1

# Define default command.
CMD ["luminati", "--help"]
