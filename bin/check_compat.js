// LICENSE_CODE ZON
'use strict'; /*jslint node:true*/

const E = exports;
// XXX vladislavl: possible take from package.json 'engines'
const node_support_ver = /^v([7-9]|[1-9][0-9])\./;

E.is_env_compat = ()=>{
    if (!node_support_ver.test(process.version))
    {
        console.log('Luminati proxy manager min requires Node.js v7\n'
            +'Please upgrade your Node using nvm or nave, or visit nodejs.org '
            +'and download a newer version.\nAfter that run the following '
            +'command to reinstall Luminati Proxy Manager:\nnpm uninstall -g '
            +'@luminati-io/luminati-proxy && npm install -g '
            +'@luminati-io/luminati-proxy');
        return false;
    }
    const path = require('path');
    const pkg = require('../package.json');
    const excluded = ['bootstrap', 'codemirror', 'notosans-fontface',
        'require-css', 'flag-icon-css', 'swagger-ui', 'font-awesome',
        'animate.css'].concat(Object.keys(pkg.optionalDependencies));
    for (let dep in pkg.dependencies)
    {
        if (excluded.includes(dep))
            continue;
        try { require(dep); } catch(e){
            console.log(`Installation problem was detected `
                +`(${dep} package, reason: ${e.message}).\n`
                +'Please run the following command to recover:');
            const d = path.resolve(__dirname, '../node_modules');
            let sudo = process.platform=='win32' ? '' : 'sudo ';
            console.log(
                (process.platform=='win32'
                ? `rmdir /s /q ${d} && ` : `sudo rm -rf ${d} && `)
                +`${sudo}npm uninstall ${dep} && `
                +`${sudo}npm install -g @luminati-io/luminati-proxy`);
            return false;
        }
    }
    return true;
};
