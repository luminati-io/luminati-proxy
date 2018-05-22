# Luminati Proxy manager

[![Build Status](https://travis-ci.org/luminati-io/luminati-proxy.png)](https://travis-ci.org/luminati-io/luminati-proxy)
[![Win Status](https://ci.appveyor.com/api/projects/status/github/luminati-io/luminati-proxy?svg=true&failingText=Win%20-%20Failed&pendingText=Win%20-%20Pending&passingText=Win%20-%20Passing)](https://ci.appveyor.com/project/lee-elenbaas/luminati-proxy)
[![dependencies Status](https://david-dm.org/luminati-io/luminati-proxy/status.svg)](https://david-dm.org/luminati-io/luminati-proxy)
[![devDependencies Status](https://david-dm.org/luminati-io/luminati-proxy/dev-status.svg)](https://david-dm.org/luminati-io/luminati-proxy?type=dev)
[![optionalDependencies Status](https://david-dm.org/luminati-io/luminati-proxy/optional-status.svg)](https://david-dm.org/luminati-io/luminati-proxy?type=optional)

A forward HTTP/HTTPS proxy on your side, to accelerate/compress/rotate/distribute/manage/monitor/report/log/debug traffic to your proxies around the world.

With Luminati HTTP/HTTPS Proxy manager you can drive the Luminati residential IPs or Luminati static IPs.

This tool requires a [Luminati](https://luminati.io/?cam=github-proxy) account.

<em>Read this in [中文](https://luminati-china.io/static/lpm/README-zh-CN.html).</em>

## Features
- Highly scalable
- Connection pool for faster response time
- Easy setup for multiple configurations using a simple web interface
- Statistics
- Automatically rotate IP every X requests
- Load balancing using multiple Super Proxies
- SSL analyzing (using a self-signed certificate)
- SOCKSv5 proxy

## Installation

### Windows
Download the [Luminati Proxy Manager installer](https://github.com/luminati-io/luminati-proxy/releases/download/v1.96.336/luminati-proxy-manager-v1.96.336-setup.exe)

### Linux/MacOs - Install script
- Run the setup script to install
```sh
wget -qO- https://luminati.io/static/lpm/luminati-proxy-latest-setup.sh | bash
```
Or
```sh
curl -L https://luminati.io/static/lpm/luminati-proxy-latest-setup.sh | bash
```
### Linux/MacOS - Manual install
- Install Node.js 6 or above ([nodejs.org](https://nodejs.org/en/download/))
- Make sure npm version is 4.6.1 or higher
  - if not, run: `sudo npm install -g npm@4.6.1`
- Install Luminati Proxy from the terminal prompt:
```sh
sudo npm install -g @luminati-io/luminati-proxy
```
If the command is returning an error try installing using --unsafe-perm flag
```sh
sudo npm install -g @luminati-io/luminati-proxy --unsafe-perm
```
### Upgrade
- Use npm to upgrade
```sh
sudo npm install -g @luminati-io/luminati-proxy
```

### Specific Version
- To install a specific proxy manager version, choose a version from
 [releases](https://github.com/luminati-io/luminati-proxy/releases)

- Run (VERSION_NUMBER is the version you've chosen (example: 1.75.355)):
```sh
sudo npm install -g @luminati-io/luminati-proxy@VERSION_NUMBER
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
  --port, -p               Port for the HTTP proxy                      [number]
  --proxy_type             Decide if to save proxy into the configuration file.
                           specifing "persist" in "proxy_type" value will create
                           port and save it in the configuration file.  [string]
  --multiply               Multiply the port definition given number of times
                                                                        [number]
  --history                Logs                       [boolean] [default: false]
  --ssl                    Enable SSL analyzing       [boolean] [default: false]
  --socks                  SOCKS5 port                                  [number]
  --log                    Log level                 [string] [default: "error"]
  --iface                  Interface or IP to listen on
                                                   [string] [default: "0.0.0.0"]
  --customer               Luminati customer                            [string]
  --zone                   Zone                     [string] [default: "static"]
  --password               Zone password                                [string]
  --proxy                  Hostname or IP of super proxy
                                  [string] [default: "zproxy.lum-superproxy.io"]
  --proxy_port             Super proxy port            [number] [default: 22225]
  --proxy_count            Minimum number of super proxies to use
                                                           [number] [default: 1]
  --secure_proxy           Use SSL when accessing super proxy
                                                      [boolean] [default: false]
  --short_username         Use Shorthand username for super proxy credentials
                                                      [boolean] [default: false]
  --proxy_switch           Automatically switch super proxy on failure
                                                           [number] [default: 5]
  --proxy_retry            Automatically retry on super proxy failure
                                                           [number] [default: 2]
  --use_proxy_cache        Cache resolved ips of superagents
                                                       [boolean] [default: true]
  --insecure               Enable SSL connection/analyzing to insecure hosts
                                                      [boolean] [default: false]
  --country                Country                                      [string]
  --state                  State                                        [string]
  --city                   City                                         [string]
  --asn                    ASN                                          [number]
  --ip                     Datacenter IP                                [string]
  --vip                    VIP                                          [number]
  --ext_proxies            A list of proxies from external vendors. Format:
                           [username:password@]ip[:port]                 [array]
  --ext_proxy_username     default username for external vendor ips     [string]
  --ext_proxy_password     default password for external vendor ips     [string]
  --ext_proxy_port         default port for external vendor ips         [number]
  --dns                    DNS resolving                                [string]
  --reverse_lookup_dns     Process reverse lookup via DNS
                                                      [boolean] [default: false]
  --reverse_lookup_file    Process reverse lookup via file              [string]
  --reverse_lookup_values  Process reverse lookup via value              [array]
  --debug                  Luminati request debug info                  [string]
  --timeout                Overall request timeout (seconds)            [number]
  --request_timeout        Timeout for request on the super proxy (seconds)
                                                                        [number]
  --allow_proxy_auth       Allow Luminati authentication per request
                                                       [boolean] [default: true]
  --session                Luminati session for all proxy requests      [string]
  --sticky_ip              Use session per requesting host to maintain IP per
                           host                       [boolean] [default: false]
  --pool_size              Session pool size               [number] [default: 3]
  --pool_type              Pool session iteration order
                                                [string] [default: "sequential"]
  --keep_alive             Generate request to keep session alive after given
                           idle time (seconds)                          [number]
  --seed                   Session ID seed used for identifying sessions from
                           this proxy                                   [string]
  --max_requests           Maximum requests per session   [string] [default: 50]
  --session_duration       Maximum duration of session (seconds)        [string]
  --throttle               Throttle requests above given number         [number]
  --null_response          URL regex pattern for null response          [string]
  --bypass_proxy           URL regex for bypassing the proxy manager and send
                           directly to host                             [string]
  --direct_include         URL regex for requests to be sent directly from super
                           proxy                                        [string]
  --exclude_include        URL regex for requests to not be sent directly from
                           super proxy                                  [string]
  --rules                  Proxy request rules                         [default:
  {"post":[{"res":[{"action":{"req_status_cnt":true,"req_status_success":true,"r
  etry":false},"head":true,"status":{"arg":"([23]..|404)","type":"=~"}},{"action
  ":{"req_status_cnt":true,"req_status_success":false,"retry":false},"head":true
  ,"status":{"arg":"([23]..|404)","type":"!~"}}],"url":"**","tag":"req_status"}]
                                                                              }]
  --whitelist_ips          Whitelist ip list for granting access to proxy
                                                           [array] [default: []]
  --race_reqs              Race several requests at once and choose fastest
                                                                        [number]
  --disable_color          Disable colors in log      [boolean] [default: false]
  --www                    HTTP port for browser admin UI       [default: 22999]
  --ws                     websocket port used for request logs [default: 22998]
  --config                 Config file containing proxy definitions
                               [string] [default: "/home/maximk/.luminati.json"]
  --database               Database file containing logs and cached values
                            [string] [default: "/home/maximk/.luminati.sqlite3"]
  --cookie                 Cookie Jar file
                                [string] [default: "/home/maximk/.luminati.jar"]
  --mode                   Defines a set of permissible operations within the
                           UI/API                     [string] [default: "root"]
  --dropin                 Create dropin mode proxy port (default: 22225)
                                                       [boolean] [default: true]
  --dropin_port            Port for dropin mode                 [default: 22225]
  --no_usage_stats         Disable collection of usage statistics
                                                      [boolean] [default: false]
  --token                  A Google authorization token for accessing
                           luminati.io                                  [string]
  --proxy_creds_check      Validate proxy credentials  [boolean] [default: true]
  --request_stats          Enable requests statistics  [boolean] [default: true]
  --request_stats_limit    Maximum request stats to keep         [default: 5000]
  --beta_features          Enable beta features       [boolean] [default: false]
  --test_url               A url for testing proxy
                              [string] [default: "http://lumtest.com/myip.json"]
  --no-www                 Disable local web
  --no-config              Working without a config file
  --no-cookie              Working without a cookie file
  --daemon, -d             Start as a daemon
  --stop-daemon            Stop running daemon
  --upgrade                Upgrade proxy manager
  --version, -v            Show version number                         [boolean]
  --help, -h, -?           Show help                                   [boolean]
  --api                                   [default: "https://luminati-china.io"]

```

### Docker

A docker image can be found on [https://hub.docker.com/r/luminati/luminati-proxy/](https://hub.docker.com/r/luminati/luminati-proxy/)

```sh
docker pull luminati/luminati-proxy

docker run luminati/luminati-proxy

docker run luminati/luminati-proxy luminati --version
```
Make sure to forward appropriate ports. Proxy manager uses by default 22999
for the web console and the api, 22555 for dropin and 24000 for first
configurable proxy.

#### Docker with predefined config file
To use lpm's config file, docker volumes can be used:
https://docs.docker.com/storage/volumes/

Following this instructions will make your docker runs with specific config file:

- create volume
```sh
docker volume create lpm-vol
```
- Inspect the recently creaed volume
```sh
docker inspect lpm-vol
```
Should output something like this:
```sh
  [
    {
        "CreatedAt": "2018-02-01T12:59:58+02:00",
        "Driver": "local",
        "Labels": null,
        "Mountpoint": "/var/lib/docker/volumes/lpm-vol/_data",
        "Name": "lpm-vol",
        "Options": {},
        "Scope": "local"
    }
  ]
```
- Take the mountpoint path /var/lib/docker/volumes/lpmvol/_data and run
```sh
cd /var/lib/docker/volumes/lpmvol/_data
```
- put .luminati.json to this directory (here also will be the logs and other
files generated by the container)
- run docker image and attach this volume:
```sh
  docker run --rm --name 'lpm1' --mount source=lpmvol,target=/root
"luminati/luminati-proxy" luminati
```

### SSL Requests

The --ssl parameter is for SSL analyzing, HTTPS requests can be made without it.

## Help

The FAQ can be found on the luminati
[FAQ](https://luminati.io/faq#proxy)

If you do not find the answer there, feel free to open an
[issue on github](issues).

Or contact [support@luminati.io](mailto:support@luminati.io).

## REST API

Working documentation of the API can be found inside the app.

A non-working version of it can be found [here](http://petstore.swagger.io/?url=https://raw.githubusercontent.com/luminati-io/luminati-proxy/master/lib/swagger.json)

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
