// LICENSE_CODE ZON
'use strict'; /*jslint node:true*/

const E = exports;

E.is_env_compat = ()=>{
    if (!Array.prototype.includes)
    {
        console.log('Luminati proxy manager requires Node.js V6.\n'
            +'Please upgrade your Node using nvm or nave, or visit nodejs.org '
            +'and download a newer version.\nAfter that run the following '
            +'command to reinstall Luminati Proxy Manager:\nnpm uninstall -g '
            +'luminati-proxy && npm install -g luminati-io/luminati-proxy');
        return false;
    }
    const path = require('path');
    const pkg = require('../package.json');
    const excluded = ['angular', 'angular-sanitize', 'bootstrap',
        'bootstrap-datepicker', 'codemirror', 'notosans-fontface',
        'require-css', 'flag-icon-css', 'angular-ui-bootstrap',
        'swagger-ui', 'font-awesome', 'angular-google-analytics']
        .concat(Object.keys(pkg.optionalDependencies));
    for (let dep in pkg.dependencies)
    {
        if (excluded.includes(dep))
            continue;
        try { require(dep); } catch(e){
            console.log(`Installation problem was detected `
                +`(${dep} package, reason: ${e.message}).\n`
                +'Please run the following command to recover:');
            const d = path.resolve(__dirname, '../node_modules');
            console.log(
                (process.platform=='win32'
                ? `rmdir /s /q ${d} && ` : `sudo rm -rf ${d} && sudo `)
                +'npm install -g luminati-io/luminati-proxy');
            return false;
        }
    }
    return true;
};
