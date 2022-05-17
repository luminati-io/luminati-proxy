#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true*/
const forge = require('node-forge');
const date = require('../util/date.js');

const DEFAULT_COUNTRY = 'Australia';
const DEFAULT_STATE = 'Victoria';
const DEFAULT_CITY = 'Melbourne';
const ROOT_CA_EXTENSIONS = [{
    name: 'basicConstraints',
    cA: true,
}, {
    name: 'keyUsage',
    keyCertSign: true,
    cRLSign: true,
}];

const abs = hex=>{
	let first_digit = parseInt(hex[0], 16);
	if (first_digit < 8)
        return hex;
    first_digit -= 8;
	return first_digit.toString() + hex.substring(1);
};

const rand_sn = ()=>abs(forge.util.bytesToHex(forge.random.getBytesSync(20)));

const get_attrs = opt=>{
    let {country, state, city, common_name, customer} = opt;
    let attrs = [{
        shortName: 'C',
        value: country || DEFAULT_COUNTRY,
    }, {
        shortName: 'ST',
        value: state || DEFAULT_STATE,
    }, {
        shortName: 'L',
        value: city || DEFAULT_CITY,
    }, {
        shortName: 'CN',
        value: common_name || `${customer ? customer+' ' : ''}PMGR RootCA`,
    }];
    if (customer)
        attrs.push({shortName: 'O', value: customer});
    return attrs;
};

module.exports = class Cert_gen {
    static create_root_ca(opt={}){
        const attrs = get_attrs(opt);
	    const keys = forge.pki.rsa.generateKeyPair(2048);
		const cert = forge.pki.createCertificate();
		cert.publicKey = keys.publicKey;
		cert.privateKey = keys.privateKey;
		cert.serialNumber = rand_sn();
		cert.validity.notBefore = date.add(date(), {day: -2});
        cert.validity.notAfter = date.add(cert.validity.notBefore,
            {year: 20});
		cert.setSubject(attrs);
		cert.setIssuer(attrs);
		cert.setExtensions(opt.extensions || ROOT_CA_EXTENSIONS);
		cert.sign(keys.privateKey, forge.md.sha512.create());
		return {
            cert: forge.pki.certificateToPem(cert),
            key: forge.pki.privateKeyToPem(keys.privateKey),
            not_before: cert.validity.notBefore,
            not_after: cert.validity.notAfter,
        };
	}
};
