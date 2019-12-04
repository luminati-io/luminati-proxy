// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const path = require('path');
const fs = require('fs');
const tls = require('tls');
const forge = require('node-forge');
const pki = forge.pki;
const lpm_file = require('../util/lpm_file.js');
const {spawn} = require('child_process');
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
        cert.setExtensions([{
            name: 'subjectAltName',
            altNames: [{
                type: 2,
                value: name,
            }],
        }]);
        cert.sign(pki.privateKeyFromPem(opt.ca.key), forge.md.sha256.create());
        hosts[name] = tls.createSecureContext({
            key: opt.keys.privateKey,
            cert: pki.certificateToPem(cert),
            ca: opt.ca.cert,
        });
        cb(null, hosts[name]);
    }};
}

E.gen_cert = function(){
    const key_path = lpm_file.get_file_path('lpm.key');
    const crt_path = lpm_file.get_file_path('lpm.crt');
    const child = spawn('openssl', ['req', '-x509', '-newkey', 'rsa:4096',
        '-keyout', key_path, '-out', crt_path, '-days', '365', '-nodes',
        '-subj', '/C=IL/ST=IL/L=/O=Luminati/OU=Org/CN=luminati.io'], {
        stdio: ['inherit', 'inherit', 'inherit'],
    });
};
