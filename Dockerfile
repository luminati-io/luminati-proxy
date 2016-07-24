#
# luminati-proxy Dockerfile
#
# https://github.com/luminati-io/luminati-proxy
#

# Pull base image.
FROM node:onbuild

# Install Bower & Gulp
RUN npm install -g luminati-io/luminati-proxy

# Define default command.
CMD ["luminati", "--help"]
