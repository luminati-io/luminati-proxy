// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const path = require('path');
const fs = require('fs');
const os = require('os');
const {spawn} = require('child_process');
const tls = require('tls');
const forge = require('node-forge');
const LRU = require('lru-cache');
const lpm_file = require('../util/lpm_file.js');
const date = require('../util/date.js');
const Cert_gen = require('../util/cert_util.js');
const etask = require('../util/etask.js');
const logger = require('./logger.js').child({category: 'SSL'});
const E = module.exports = ssl;
const {compare} = Buffer, {assign} = Object, {pki} = forge;
const cust_paths = {
    key: lpm_file.get_file_path('lpm.key'),
    cert: lpm_file.get_file_path('lpm.crt'),
};
const sys_paths = {
    key: path.join(__dirname, '../bin/ca.key'),
    cert: path.join(__dirname, '../bin/ca.crt'),
};

E.paths = {cust: cust_paths, sys: sys_paths};

E.ca = {};

E.use_custom_cert = false;

let iface_ips = [].concat(...Object.values(os.networkInterfaces()));
iface_ips = iface_ips.filter(i=>i.family=='IPv4').map(i=>i.address);

let ip_cert;

function fs_ca_exists(paths){
    return fs.existsSync(paths.cert) && fs.existsSync(paths.key);
}

function fs_ca_remove(paths){
    try {
        fs.unlinkSync(paths.cert);
        fs.unlinkSync(paths.key);
        return true;
    } catch(e){
        logger.error('fs_ca_remove: ' + e.message);
        return false;
    }
}

function load_ca_files(paths){
    if (!fs_ca_exists(paths))
        return false;
    return E.ca = {
        cert: fs.readFileSync(paths.cert),
        key: fs.readFileSync(paths.key)
    };
}

const load_cloud_ca = etask._fn(function*_load_ca(_this, mgr){
    this.on('uncaught', e=>{
        logger.error('load_cloud_ca: '+e.message);
        this.return(false);
    });
    let {ca} = yield mgr.lpm_f.get_ca();
    return E.set_ca(ca);
});

function save_ca_files(ca, paths){
    if (!verify_ca(ca))
        return false;
    E.ca = ca;
    fs.writeFileSync(paths.key, E.ca.key);
    fs.writeFileSync(paths.cert, E.ca.cert);
    return true;
}

function verify_ca(ca){
    ca = ca || E.ca;
    if (!ca)
        ca = E.ca;
    if (!ca || !ca.cert || !ca.key)
        return false;
    try {
        let crt = pki.certificateFromPem(ca.cert);
        if (crt.publicKey.n.toString(2).length < 2048)
            return false;
        pki.privateKeyFromPem(ca.key);
    } catch(e){
        logger.error('verify_ca: ' + e.message);
        return false;
    }
    return true;
}

function equal_ca(ca, orig){
    const to_buffer = val=>Buffer.isBuffer(val) ? val : Buffer.from(val);
    let _orig = assign({}, orig || E.ca), _ca = assign({}, ca);
    Object.keys(_orig).forEach(k=>_orig[k]=to_buffer(_orig[k]));
    Object.keys(_ca).forEach(k=>_ca[k]=to_buffer(_ca[k]));
    return compare(_orig.key, _ca.key)==0 && compare(_orig.cert, _ca.cert)==0;
}

function gen_cert(keys, name, alt_names){
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

function ssl(keys, extra_ssl_ips){
    const hosts = new LRU({
        max: 5000,
        ttl: 30*date.ms.MIN,
        ttlAutopurge: true,
        updateAgeOnGet: true,
        ttlResolution: 10*date.ms.MIN,
        noDisposeOnSet: true,
    });
    if (Array.isArray(extra_ssl_ips))
        iface_ips = [...new Set(iface_ips.concat(extra_ssl_ips))];
    if (!ip_cert)
    {
        ip_cert = gen_cert(keys, 'localhost',
            iface_ips.map(ip=>({type: 7, ip})));
    }
    return {
        key: keys.privateKeyPem,
        cert: pki.certificateToPem(ip_cert),
        ca: E.ca.cert,
        SNICallback: (name, cb)=>{
            if (hosts.has(name))
                return cb(null, hosts.get(name));
            const cert = gen_cert(keys, name, [{type: 2, value: name}]);
            hosts.set(name, tls.createSecureContext({
                key: keys.privateKeyPem,
                cert: pki.certificateToPem(cert),
                ca: E.ca.cert,
            }));
            cb(null, hosts.get(name, true));
        }
    };
}

E.gen_cert = function(){
    const child = spawn('bash', [path.join(__dirname, '../bin/cert_gen.sh'),
        cust_paths.key, cust_paths.cert], {
        stdio: ['inherit', 'inherit', 'inherit'],
    });
    child.on('exit', (code, signal)=>{
        if (code==0)
            logger.notice('CA generated successfully');
        else
            logger.warn('Could not generate CA');
    });
};

E.load_ca = etask._fn(function*_load_ca(_this, mgr){
    const err = new Error('Failed to load certificate');
    this.on('uncaught', e=>{
        logger.error('load_ca: '+e.message);
        this.return();
    });
    let info = mgr ? mgr.get_current_info() : {};
    if (mgr && mgr.argv.zagent && (yield load_cloud_ca(mgr)))
    {
        E.use_custom_cert = true;
        return logger.notice('Loaded certificate from cloud');
    }
    if (mgr && !mgr.argv.zagent && load_ca_files(cust_paths) && verify_ca())
    {
        E.use_custom_cert = true;
        return logger.notice('Loaded local certificate');
    }
    if (load_ca_files(sys_paths) && verify_ca())
    {
        E.use_custom_cert = false;
        return logger.notice('Certificate loaded from sys folder');
    }
    logger.warn('Unable to find local certificate');
    if (!mgr)
        throw err;
    if (!mgr.argv.zagent && (yield load_cloud_ca(mgr)))
        return logger.notice('Loaded certificate from cloud');
    logger.warn('Unable to find cloud certificate');
    logger.notice('Generating certificate');
    let {key, cert} = Cert_gen.create_root_ca(info);
    if (!mgr.argv.zagent && info.customer
        && save_ca_files({key, cert}, cust_paths) && verify_ca())
    {
        return logger.notice('Saved new local certificate');
    }
    if (E.set_ca({cert, key}))
        return logger.notice('Started with new certificate');
});

E.apply_cloud_ca = function(ca){
    try {
        if (equal_ca(ca))
            return false;
        return E.set_ca(ca);
    } catch(e){
        logger.error('apply_cloud_ca: ' + e.message);
        return false;
    }
};

E.remove_ca = function(paths){
    if (!fs_ca_exists(paths))
        return false;
    logger.notice('Removing certificate: ' + paths.cert);
    return fs_ca_remove(paths);
};

E.set_ca = function(ca){
    if (!verify_ca(ca))
        return false;
    E.ca = ca;
    return true;
};

E.buff_to_ca = function(buf){
    if (!buf.cert || !buf.key)
        return false;
    return {
        cert: Buffer.from(buf.cert),
        key: Buffer.from(buf.key)
    };
};
