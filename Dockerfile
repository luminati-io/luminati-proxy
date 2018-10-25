#
# luminati-proxy Dockerfile
#
# https://github.com/luminati-io/luminati-proxy
#

# Pull base image.
FROM node:10

RUN npm install -g npm@4.6.1

# Install Luminati Proxy Manager
RUN npm install -g @luminati-io/luminati-proxy

# Mark environment as Docker for CLI output
ENV DOCKER 1

# Define default command.
CMD ["luminati", "--help"]
