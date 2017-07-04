# Luminati Proxy manager

[![Build Status](https://travis-ci.org/luminati-io/luminati-proxy.png)](https://travis-ci.org/luminati-io/luminati-proxy)
[![Win Status](https://ci.appveyor.com/api/projects/status/github/luminati-io/luminati-proxy?svg=true&failingText=Win%20-%20Failed&pendingText=Win%20-%20Pending&passingText=Win%20-%20Passing)](https://ci.appveyor.com/project/lee-elenbaas/luminati-proxy)
[![dependencies Status](https://david-dm.org/luminati-io/luminati-proxy/status.svg)](https://david-dm.org/luminati-io/luminati-proxy)
[![devDependencies Status](https://david-dm.org/luminati-io/luminati-proxy/dev-status.svg)](https://david-dm.org/luminati-io/luminati-proxy?type=dev)
[![optionalDependencies Status](https://david-dm.org/luminati-io/luminati-proxy/optional-status.svg)](https://david-dm.org/luminati-io/luminati-proxy?type=optional)

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

### Requirements
Software requirements for Luminati proxy manager are:

- <a href="https://git-scm.com/downloads">Git</a> from version 1.7+
- <a href="https://nodejs.org/en/download/">Node.js</a> from version 6+

### Windows
Download the <a href="https://github.com/luminati-io/luminati-proxy/releases/tag/v0.10.19">Luminati Proxy Manager installer</a>.

### Linux/MacOS
- Install Node.js 6 or above (preferably using
  [nave](https://github.com/isaacs/nave))
- Install Luminati Proxy from the terminal prompt:
```sh
sudo npm install -g luminati-io/luminati-proxy
```
### Upgrade
- Use npm to upgrade
```sh
sudo npm install -g luminati-io/luminati-proxy
```
### Release Notes

You can review the [CHANGELOG.md](CHANGELOG.md) for list of changes in every version

## Usage

### First run
After running the app for the first time:
```sh
luminati
```
Point your browser to the app admin UI
[http://127.0.0.1:22999](http://127.0.0.1:22999) to set up credentials
and configure your proxies.

After logging in, you will see that the default configuration for the Luminati
proxy includes a "dropin" proxy running on port 22225. This mode is explained
in detail below.

### Dropin replacement for existing super-proxies

Luminati Proxy comes with a "dropin mode" which behaves exactly like the
existing super-proxies. When running a proxy in dropin mode, you do not need to
log in via the administrative UI in order to make requests through your
proxies. Rather, the proxy username and password are provided with each request
to the proxy server. This mode is enabled by default, and you can use this mode
as an easy replacement when migrating from the regular super-proxy to the
Luminati Proxy Manager.

Dropin mode is enabled by default. To disable the dropin proxy, use the flag
`--no-dropin`:

```sh
luminati --no-dropin
```

For full documentation on the API for making requests through the dropin proxy,
see <a href="https://luminati.io/cp/api_example?manager=all&group=active">the
API Example page in your Luminati.io account</a>.

### Complete list of command line options
```sh
luminati --help
Usage:
  luminati [options] config1 config2 ...

Options:
  --port, -p              Port for the HTTP proxy      [number] [default: 24000]
  --multiply              Multiply the port definition given number of times
                                                                        [number]
  --history               Log request history                          [boolean]
  --ssl                   Enable SSL sniffing         [boolean] [default: false]
  --socks                 SOCKS5 port                                   [number]
  --log                   Log level                  [string] [default: "error"]
  --iface                 Interface or IP to listen on
                                                   [string] [default: "0.0.0.0"]
  --customer              Luminati customer                             [string]
  --zone                  Zone                         [string] [default: "gen"]
  --password              Zone password                                 [string]
  --proxy                 Hostname or IP of super proxy
                                        [string] [default: "zproxy.luminati.io"]
  --proxy_port            Super proxy port             [number] [default: 22225]
  --proxy_count           Minimum number of super proxies to use
                                                           [number] [default: 1]
  --secure_proxy          Use SSL when accessing super proxy
                                                      [boolean] [default: false]
  --short_username        Use Shorthand username for super proxy credentials
                                                      [boolean] [default: false]
  --proxy_switch          Automatically switch super proxy on failure
                                                           [number] [default: 5]
  --insecure              Enable SSL connection/sniffing to insecure hosts
                                                      [boolean] [default: false]
  --country               Country                                       [string]
  --state                 State                                         [string]
  --city                  City                                          [string]
  --asn                   ASN                                           [number]
  --ip                    Datacenter IP                                 [string]
  --dns                   DNS resolving                                 [string]
  --debug                 Luminati request debug info                   [string]
  --request_timeout       Timeout for request on the super proxy (seconds)
                                                                        [number]
  --allow_proxy_auth      Allow Luminati authentication per request
                                                      [boolean] [default: false]
  --session               Luminati session for all proxy requests       [string]
  --sticky_ip             Use session per requesting host to maintain IP per
                          host                        [boolean] [default: false]
  --pool_size             Session pool size                [number] [default: 3]
  --pool_type             Pool session iteration order
                                                [string] [default: "sequential"]
  --session_init_timeout  Session establish timeout (seconds)
                                                           [number] [default: 5]
  --keep_alive            Generate request to keep session alive after given
                          idle time (seconds)                           [number]
  --seed                  Session ID seed used for identifying sessions from
                          this proxy                                    [string]
  --max_requests          Maximum requests per session    [string] [default: 50]
  --session_duration      Maximum duration of session (seconds)         [string]
  --throttle              Throttle requests above given number          [number]
  --null_response         URL pattern for null response                 [string]
  --bypass_proxy          URL regex for bypassing the proxy manager and
			  send directly to host                         [string]
  --direct_include        URL regex for requests to be sent directly
			  from super proxy      			[string]
  --exclude_include       URL regex for requests to not be sent
			  directly from super proxy 		        [string]
  --www                   UI/API port                           [default: 22999]
  --config                Config file containing proxy definitions
                                          [string] [default: "~/.luminati.json"]
  --database              Database file containing history and cached values
                                       [string] [default: "~/.luminati.sqlite3"]
  --database_history      Database URI to save history instead of default DB
  --resolve               Reverse DNS lookup file                       [string]
  --mode                  Defines a set of permissible operations within the
                          UI/API                      [string] [default: "root"]
  --dropin                Create dropin mode proxy on port 22225
                                                      [boolean] [default: false]
  --no-www                Disable local web
  --no-config             Working without a config file
  --daemon, -d            Start as a daemon
  --stop-daemon           Stop running daemon
  --no_usage_stats        Disable collection of anonymous usage statistics
                                                      [boolean] [default: false]
  --version, -v           Show version number                          [boolean]
  --help, -h, -?          Show help                                    [boolean]
```

### Docker

A docker image can be found on [https://hub.docker.com/r/luminati/luminati-proxy/](https://hub.docker.com/r/luminati/luminati-proxy/)

```sh
docker pull luminati/luminati-proxy

docker run luminati/luminati-proxy

docker run luminati/luminati-proxy luminati --version
```

### SSL Requests

The --ssl parameter is for SSL sniffing, HTTPS requests can be made without it.

## Help

The FAQ can be found on the luminati
[FAQ](https://luminati.io/faq#proxy)

If you do not find the answer there, feel free to open an
[issue on github](issues).

Or contact [support@luminati.io](mailto:support@luminati.io).

## REST API

Working documentation of the API can be found inside the app.

A non-working version of it can be found [here](http://petstore.swagger.io/?url=https://cdn.rawgit.com/luminati-io/luminati-proxy/master/lib/swagger.json)

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
