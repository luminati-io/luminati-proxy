#
# luminati-proxy Dockerfile
#
# https://github.com/luminati-io/luminati-proxy
#

# Pull base image.
FROM node:10-alpine

USER root
RUN apk add --update python make g++
RUN npm install -g npm@6.4.1

# Install Luminati Proxy Manager
RUN npm install -g @luminati-io/luminati-proxy --unsafe-perm=true --allow-root

# Mark environment as Docker for CLI output
ENV DOCKER 1

# Define default command.
CMD ["luminati", "--help"]
