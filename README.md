# Luminati Proxy manager

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
- Install Node.js 4 or above (preferably using
  [nave](https://github.com/isaacs/nave))
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

You can review the [CHANGELOG.md](CHANGELOG.md) for additional features, bug fixes and breaking changes.

## Usage

### First run
After running the app for the first time:
```sh
$ luminati
```
Point your browser to the app admin UI
[http://127.0.0.1:22999](http://127.0.0.1:22999) to set up credentials
and configure your proxies.

### Complete list of command line options
```sh
$ luminati --help
Usage: luminati [options] config1 config2 ...

Options:
  --log                   Log level (NONE|ERROR|WARNING|INFO|DEBUG)
                                                              [default: "ERROR"]
  --customer              Customer                                      [string]
  --password              Password                                      [string]
  --proxy                 Super proxy ip or country (us|gb|nl)
                                        [string] [default: "zproxy.luminati.io"]
  --proxy_port            Super proxy port                      [default: 22225]
  --proxy_count           Minimum number of super proxies to use
                                                           [number] [default: 1]
  --secure_proxy          Use SSL when accessing super proxy           [boolean]
  --sticky_ip             Use same session as much as possible to maintain IP
                                                                       [boolean]
  --keep_alive            Generate request to keep alive every n seconds[number]
  --zone                  Zone                         [string] [default: "gen"]
  --country               Country                                       [string]
  --state                 State                                         [string]
  --city                  City                                          [string]
  --asn                   ASN                                           [number]
  --ip                    Datacenter IP                                 [string]
  --dns                   DNS resolving (local|remote)
  --debug                 Luminati request debug info (none|full)
  --request_timeout       Timeout for request on the super proxy (seconds)
                                                                        [number]
  --pool_size             Pool size                        [number] [default: 3]
  --pool_type             Pool session iteration order (sequential|round-robin)
                                                         [default: "sequential"]
  --ssl                   Enable SSL sniffing                          [boolean]
  --insecure              Enable SSL connection/sniffing to insecure hosts
                                                                       [boolean]
  --max_requests          Requests per session            [number] [default: 50]
  --session_duration      Maximum duration of session (seconds)
  --proxy_switch          Automatically switch super proxy on failure
                                                                    [default: 5]
  --session_init_timeout  Session establish timeout (seconds)
                                                           [number] [default: 5]
  --direct_include        Include pattern for direct requests
  --direct_exclude        Exclude pattern for direct requests
  --null_response         URL pattern for null response
  --throttle              Throttle requests above given number          [number]
  --allow_proxy_auth      Allow Luminati authentication per request
                                                      [boolean] [default: false]
  --www                   Local web port                        [default: 22999]
  --socks                 SOCKS5 port
  --history               Log history                                  [boolean]
  --database              Database path         [default: "~/.luminati.sqlite3"]
  --resolve               Reverse DNS lookup file
  --config                Config file containing proxy definitions
                                                   [default: "~/.luminati.json"]
  --no-config             Working without a config file
  --iface                 Interface or ip to listen on (lo|eth0|...)
  --no_dropin             Disable drop-in mode for migrating           [boolean]
  -h, --help              Show help                                    [boolean]
  --version               Show version number                          [boolean]
  -p, --port              Listening port               [number] [default: 24000]
```

### Docker

A docker image can be found on [https://hub.docker.com/r/luminati/luminati-proxy/](https://hub.docker.com/r/luminati/luminati-proxy/)

```sh
$ docker pull luminati/luminati-proxy

$ docker run luminati/luminati-proxy

$ docker run luminati/luminati-proxy luminati --version
```

### SSL Requests

The --ssl parameter is for SSL sniffing, HTTPS requests can be made without it.

## Help

The FAQ can be found on the luminati
[FAQ](https://luminati.io/faq#github-proxy)

If you do not find the answer there, feel free to open an
[issue on github](issues).

Or contact [support@luminati.io](mailto:support@luminati.io).

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
proxy.listen(0, '127.0.0.1').then(()=>new Promise((resolve, reject)=>{
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
    yield proxy.listen(0, '127.0.0.1'); // port and ip to listen to
    let res = yield etask.nfn_apply(proxy, '.request',
        ['http://lumtest.com/myip']);
    console.log('Result:', res.statusCode, res.body);
    yield proxy.stop();
});
```
