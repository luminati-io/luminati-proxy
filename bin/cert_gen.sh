#!/usr/bin/env bash
# LICENSE_CODE ZON ISC
openssl req -x509 -sha256 -newkey rsa:4096 -keyout $1 \
-out $2 -days 365 -nodes \
-subj /C=IL/ST=IL/O=BrightData/CN=brdtnet.com \
-config <(cat /etc/ssl/openssl.cnf <(
cat <<-EOF
[req]
x509_extensions  = v3_ca
[v3_ca]
keyUsage         = keyCertSign
extendedKeyUsage = serverAuth, clientAuth, codeSigning
EOF
))
