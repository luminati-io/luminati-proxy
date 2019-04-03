#!/usr/bin/env node
// LICENSE_CODE ZON
'use strict'; /*jslint node:true*/
const etask = require('../../util/etask.js');
const cli = require('../../util/cli.js');
const oss = require('ali-oss');
const cli_opt = [
    ['', 'key-id=KEY_ID', 'Alibaba AccessKeyId'],
    ['', 'key-secret=KEY_SECRET', 'Alibaba AccessKeySecret'],
    ['', 'version=VERSION', 'Version being released'],
];
cli.getopt(cli_opt, 'Usage: publish_cn.js\n\n[[OPTIONS]]\n');

const alibaba_release = opt=>etask(function*(){
    const client = new oss({
        region: 'oss-cn-hongkong',
        accessKeyId: opt.key_id,
        accessKeySecret: opt.key_secret,
        bucket: 'lpmtest',
        timeout: '600s',
    });
    const filename = `luminati-proxy-${cli.opt.version}-setup.exe`;
    console.log('Uploading %s to alibaba', filename);
    const res = yield client.put(filename, opt.exe_path);
    if (res.res.status==200)
        console.log('Upload completed successfully');
    else
        console.log('Error %s %s', res.res.status, res.res.statusMessage);
});

const main = ()=>etask(function*(){
    try {
        cli.process_args();
        yield _main();
    } catch(e){
        console.log(e.stack);
        cli.exit('Publish error:', e);
    }
});

const _main = ()=>etask(function*(){
    if (!cli.opt.key_id || !cli.opt.key_secret || !cli.opt.version)
    {
        console.log('You need to pass --version --key-id and --key-secret');
        return;
    }
    const exe_path = `/tmp/luminati-proxy-${cli.opt.version}-setup.exe`;
    yield alibaba_release({exe_path, key_id: cli.opt.key_id,
        key_secret: cli.opt.key_secret});
});

if (!module.parent)
    main();
