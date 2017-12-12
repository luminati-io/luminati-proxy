// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const path = require('path');
const fs = require('fs');
const tls = require('tls');
const forge = require('node-forge');
const pki = forge.pki;
const E = module.exports = ssl;
let keys;
E.ca = {
    cert: fs.readFileSync(path.join(__dirname, '../bin/ca.crt')),
    key: fs.readFileSync(path.join(__dirname, '../bin/ca.key')),
};

function ssl(opt){
    opt = opt||{};
    if (!opt.keys)
    {
        if (!keys)
        {
            keys = pki.rsa.generateKeyPair(2048);
            keys.privateKeyPem = pki.privateKeyToPem(keys.privateKey);
            keys.publicKeyPem = pki.publicKeyToPem(keys.publicKey);
        }
        opt.keys = {
            privateKey: keys.privateKeyPem,
            publicKey: keys.publicKeyPem,
        };
    }
    if (!opt.ca)
        opt.ca = E.ca;
    const hosts = {};
    return {SNICallback: (name, cb)=>{
        if (hosts[name])
            return cb(null, hosts[name]);
        const cert = pki.createCertificate();
        cert.publicKey = pki.publicKeyFromPem(opt.keys.publicKey);
        cert.serialNumber = ''+Date.now();
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date(Date.now()+10*365*86400000);
        cert.setSubject([{name: 'commonName', value: name}]);
        cert.setIssuer(pki.certificateFromPem(opt.ca.cert).issuer.attributes);
        cert.sign(pki.privateKeyFromPem(opt.ca.key), forge.md.sha256.create());
        hosts[name] = tls.createSecureContext({
            key: opt.keys.privateKey,
            cert: pki.certificateToPem(cert),
            ca: opt.ca.cert,
        });
        cb(null, hosts[name]);
    }};
}
