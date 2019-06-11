#!/usr/bin/env node
// LICENSE_CODE ZON
'use strict'; /*jslint node:true*/
const child_process = require('child_process');

const headers = {
    'x-lpm-fake': true,
    'x-lpm-fake-data': 50000,
};
const headers_cmd = Object.entries(headers).reduce((acc, [name, value])=>
    acc+`-H "${name}: ${value}" `, ' ');
const opt = {
    c: 1500,
    t: 10,
    port: 24000,
    url: 'http://lumtest.com/myip.json',
};

const cmd = `ab -c ${opt.c} -t ${opt.t} -X 127.0.0.1:${opt.port} `
    +`${headers_cmd} ${opt.url}`;
child_process.spawn(cmd, {
    stdio: 'inherit',
    shell: true,
});
