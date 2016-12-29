#
# luminati-proxy Dockerfile
#
# https://github.com/luminati-io/luminati-proxy
#

# Pull base image.
FROM node:6

# Install Luminati Proxy Manager
RUN npm install -g luminati-io/luminati-proxy

# Define default command.
CMD ["luminati"]
