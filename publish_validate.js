#!/usr/bin/env node
// LICENSE_CODE ZON
'use strict'; /*jslint node:true*/
const etask = require('../../util/etask.js');
const request = require('request');
const exec = require('../../util/exec.js');
const cli = require('../../util/cli.js');
const cli_opt = [
    ['', 'version=VERSION', 'Version being released'],
];
cli.getopt(cli_opt, 'Usage: publish_validate.js\n\n[[OPTIONS]]\n');

const main = ()=>etask(function*(){
    cli.process_args();
    if (!cli.opt.version)
        return console.log('You need to pass --version');
    const url = 'https://raw.githubusercontent.com/luminati-io/'
        +'luminati-proxy/master/package.json';
    const github_res = yield etask.nfn_apply(request, [{url, json: true}]);
    if (github_res.body.version!=cli.opt.version)
        return console.log('Wrong version on github.com');
    const npm_check = ['npm', 'view', '@luminati-io/luminati-proxy',
        'version'];
    const npm_res = yield exec.sys(npm_check, {out: 'stdout'});
    if (npm_res.trim()!=cli.opt.version)
        return console.log('Wrong version on npmjs.com');
    console.log('Success');
});

if (!module.parent)
    main();
