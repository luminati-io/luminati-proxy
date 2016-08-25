# Luminati HTTP/HTTPS Proxy manager

[![Build Status](https://travis-ci.org/luminati-io/luminati-proxy.png)](https://travis-ci.org/luminati-io/luminati-proxy)
[![dependencies Status](https://david-dm.org/luminati-io/luminati-proxy/status.svg)](https://david-dm.org/luminati-io/luminati-proxy)
[![devDependencies Status](https://david-dm.org/luminati-io/luminati-proxy/dev-status.svg)](https://david-dm.org/luminati-io/luminati-proxy?type=dev)

A forward HTTP/HTTPS proxy on your side, to accelerate/compress/rotate/distribute/manage/monitor/report/log/debug traffic to your proxies around the world.

With Luminati HTTP/HTTPS Proxy manager you can drive the Luminati residential IPs or Luminati static IPs.

This tool requires a [Luminati](https://luminati.io/?cam=github-proxy) account.

## Features
- Highly scalable
- Connection pool for faster response time
- Easy setup for multiple configurations using a simple web interface
- Statistics
- Automatically rotate IP every X requests
- Load balancing using multiple Super Proxies
- SSL sniffing (using a self-signed certificate)
- SOCKSv5 proxy

## Installation

### Windows
- Install [Git](https://git-scm.com/download/win)
- Install [Node.js](https://nodejs.org/en/download/)
- Install Luminati Proxy from Window's command prompt:
```sh
npm install -g luminati-io/luminati-proxy
```

### Linux/MacOS
- Install Node.js (preferably using [nave](https://github.com/isaacs/nave))
- Install Luminati Proxy from the terminal prompt:
```sh
$ sudo npm install -g luminati-io/luminati-proxy
```

### Upgrade
- Use npm to upgrade
```sh
$ sudo npm install -g luminati-io/luminati-proxy
```
### Release Notes
- v0.5.2
  - SOCKS Interface can now be configured using UI and config files for each
  proxy
- v0.5.0
  - NodeJS api has changed its require method: from require('luminati-proxy')
  to require('luminati-proxy').Luminati
- v0.4.25
  - Null response for HTTPS connect requests return error code 501
- v0.4.24
  - Drop-in mode is now on by default
- v0.4.22
  - The rest api /api/proxies the timeout parameter was replaced by 
  idle_timeout
  - The cli & config parameter timeout was replaced by the request_timeout
- v0.2.0
  - Default proxy port was changed from 23000 to 24000

## Usage
```sh
$ luminati --help
Usage: luminati [options] config1 config2 ...

Options:
  --log              Log level (NONE|ERROR|WARNING|INFO|DEBUG)[default: "ERROR"]
  --customer         Customer
  --password         Password
  --proxy            Super proxy ip or country (us|gb|nl)
                                                 [default: "zproxy.luminati.io"]
  --proxy_count      Minimum number of super proxies to use[number] [default: 1]
  --secure_proxy     Use SSL when accessing super proxy                [boolean]
  --sticky_ip        Use same session as much as possible to maintain IP
                                                                       [boolean]
  --zone             Zone                                       [default: "gen"]
  --country          Country
  --state            State
  --city             City
  --asn              ASN
  --dns              DNS resolving (local|remote)
  --debug            Luminati request debug info (none|full)
  --request_timeout  Timeout for request on the super proxy (seconds)
  --pool_size        Pool size                             [number] [default: 3]
  --ssl              Enable SSL sniffing                               [boolean]
  --max_requests     Requests per session                 [number] [default: 50]
  --proxy_switch     Automatically switch proxy on failure          [default: 5]
  --session_timeout  Session establish timeout          [number] [default: 5000]
  --direct_include   Include pattern for direct requests
  --direct_exclude   Exclude pattern for direct requests
  --null_response    URL pattern for null response
  --www              Local web port                             [default: 22999]
  --socks            SOCKS5 port
  --history          Log history                                       [boolean]
  --database         Database path              [default: "~/.luminati.sqlite3"]
  --resolve          Reverse DNS lookup file
  --config           Config file containing proxy definitions
                                                   [default: "~/.luminati.json"]
  --iface            Interface or ip to listen on (lo|eth0|...)
  --no_dropin        Disable drop-in mode for migrating                [boolean]
  -h, --help         Show help                                         [boolean]
  --version          Show version number                               [boolean]
  -p, --port         Listening port                    [number] [default: 24000]
```

### Docker

A docker image can be found on [https://hub.docker.com/r/luminati/luminati-proxy/](https://hub.docker.com/r/luminati/luminati-proxy/)

```sh
$ docker pull luminati/luminati-proxy

$ docker run luminati/luminati-proxy

$ docker run luminati/luminati-proxy luminati --version
```

## FAQ

### Customer name

The customer name used by luminati-proxy is the luminati customer name and not the username as it appears on [https://luminati.io/cp/api_example](https://luminati.io/cp/api_example) page.

If the username shows: lum-customer-CUSTOMER-zone-gen

Then the customer name is just: CUSTOMER

### SSL Requests

The --ssl parameter is for SSL sniffing, HTTPS requests can be made without it.

## Node.js API

The proxy manager can be used as a required module for node.js applications - eliminating the need to run it as a standalone process.

The API supports both [Promises](https://www.promisejs.org/) and [Generators](https://www.promisejs.org/generators/). Internally, it uses the [request](https://github.com/request/request) module and supports all of its features.

### Promises
```js
'use strict';
const Luminati = require('luminati-proxy').Luminati;

const proxy = new Luminati({
    customer: 'CUSTOMER', // your customer name
    password: 'PASSWORD', // your password
    zone: 'gen', // zone to use
    proxy_count: 5, //minimum number of proxies to use for distributing requests
});
proxy.on('response', res=>console.log('Response:', res));
proxy.listen(24000, '127.0.0.1').then(()=>new Promise((resolve, reject)=>{
    proxy.request('http://lumtest.com/myip', (err, res)=>{
        if (err)
            return reject(err);
        resolve(res);
    });
})).then(res=>{
    console.log('Result:', res.statusCode, res.body);
}, err=>{
    console.log('Error:', err);
}).then(()=>proxy.stop());
```

### Generators
```js
'use strict';
const etask = require('hutil').etask;
const Luminati = require('luminati-proxy').Luminati;

etask(function*(){
    const proxy = new Luminati({
        customer: 'CUSTOMER', // your customer name
        password: 'PASSWORD', // your password
        zone: 'gen', // zone to use
        proxy_count: 5, //minimum number of proxies to use for distributing requests
    });
    yield proxy.listen(24000, '127.0.0.1'); // port and ip to listen to
    let res = yield etask.nfn_apply(proxy, '.request',
        ['http://lumtest.com/myip']);
    console.log('Result:', res.statusCode, res.body);
    yield proxy.stop();
});
```
