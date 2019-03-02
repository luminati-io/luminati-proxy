#
# luminati-proxy Dockerfile
#
# https://github.com/luminati-io/luminati-proxy
#

# Pull base image.
FROM node:10.10

USER node
RUN mkdir /home/node/.npm-global
ENV PATH=/home/node/.npm-global/bin:$PATH
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global


RUN npm install -g npm@6.4.1

# Install Luminati Proxy Manager
RUN npm install -g @luminati-io/luminati-proxy

# Mark environment as Docker for CLI output
ENV DOCKER 1

# Define default command.
CMD ["luminati", "--help"]
