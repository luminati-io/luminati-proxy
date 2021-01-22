// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const path = require('path');
const fs = require('fs');
const os = require('os');
const tls = require('tls');
const forge = require('node-forge');
const pki = forge.pki;
const lpm_file = require('../util/lpm_file.js');
const date = require('../util/date.js');
const logger = require('./logger.js');
const {spawn} = require('child_process');
const E = module.exports = ssl;
let keys;
let key_path;
let crt_path;
const cust_key_path = lpm_file.get_file_path('lpm.key');
const cust_crt_path = lpm_file.get_file_path('lpm.crt');
if (fs.existsSync(cust_key_path) && fs.existsSync(cust_crt_path))
{
    key_path = cust_key_path;
    crt_path = cust_crt_path;
}
else
{
    key_path = path.join(__dirname, '../bin/ca.key');
    crt_path = path.join(__dirname, '../bin/ca.crt');
}
E.ca = {cert: fs.readFileSync(crt_path), key: fs.readFileSync(key_path)};

let iface_ips = [].concat(...Object.values(os.networkInterfaces()));
iface_ips = iface_ips.filter(i=>i.family=='IPv4').map(i=>i.address);

let ip_cert;

function gen_cert(name, alt_names){
    const cert = pki.createCertificate();
    cert.publicKey = pki.publicKeyFromPem(keys.publicKeyPem);
    cert.serialNumber = ''+Date.now();
    cert.validity.notBefore = new Date(Date.now()-1*date.ms.DAY);
    cert.validity.notAfter = new Date(Date.now()+1*365*date.ms.DAY);
    cert.setSubject([{name: 'commonName', value: name}]);
    cert.setIssuer(pki.certificateFromPem(E.ca.cert).issuer.attributes);
    cert.setExtensions([{name: 'subjectAltName', altNames: alt_names}]);
    cert.sign(pki.privateKeyFromPem(E.ca.key), forge.md.sha256.create());
    return cert;
}

// XXX viktor: only first call matters, make it clear that it is impossible
// to set another rsa_keys and there is no need
function ssl(rsa_keys, extra_ssl_ips){
    keys = rsa_keys||keys;
    if (!keys)
    {
        keys = pki.rsa.generateKeyPair(2048);
        keys.privateKeyPem = pki.privateKeyToPem(keys.privateKey);
        keys.publicKeyPem = pki.publicKeyToPem(keys.publicKey);
    }
    if (Array.isArray(extra_ssl_ips))
        iface_ips = [...new Set(iface_ips.concat(extra_ssl_ips))];
    if (!ip_cert)
        ip_cert = gen_cert('localhost', iface_ips.map(ip=>({type: 7, ip})));
    const hosts = {};
    return {
        key: keys.privateKeyPem,
        cert: pki.certificateToPem(ip_cert),
        ca: E.ca.cert,
        SNICallback: (name, cb)=>{
            if (hosts[name])
                return cb(null, hosts[name]);
            const cert = gen_cert(name, [{type: 2, value: name}]);
            hosts[name] = tls.createSecureContext({
                key: keys.privateKeyPem,
                cert: pki.certificateToPem(cert),
                ca: E.ca.cert,
            });
            cb(null, hosts[name]);
        }
    };
}

E.gen_cert = function(){
    const child = spawn('bash', [path.join(__dirname, '../bin/cert_gen.sh'),
        cust_key_path, cust_crt_path], {
        stdio: ['inherit', 'inherit', 'inherit'],
    });
    child.on('exit', (code, signal)=>{
        if (code==0)
            logger.notice('CA generated successfully');
        else
            logger.warn('Could not generate CA');
    });
};
