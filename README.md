# Luminati Proxy manager

[![dependencies Status](https://david-dm.org/luminati-io/luminati-proxy/status.svg)](https://david-dm.org/luminati-io/luminati-proxy)
[![devDependencies Status](https://david-dm.org/luminati-io/luminati-proxy/dev-status.svg)](https://david-dm.org/luminati-io/luminati-proxy?type=dev)
[![optionalDependencies Status](https://david-dm.org/luminati-io/luminati-proxy/optional-status.svg)](https://david-dm.org/luminati-io/luminati-proxy?type=optional)

A forward HTTP/HTTPS proxy on your side, to accelerate/compress/rotate/distribute/manage/monitor/report/log/debug traffic to your proxies around the world.

With Luminati HTTP/HTTPS Proxy manager you can drive the Luminati residential IPs or Luminati static IPs.

This tool requires a [Luminati](https://luminati.io/?cam=github-proxy) account.
Please report issues or bugs to your Luminati account manager or from our [help center](https://luminati.io/faq#proxy)

<em>Read this in [中文](https://lum-lpm.com/static/lpm/README-zh-CN.html).</em>

## Features
- Highly scalable
- Connection pool for faster response time
- Easy setup for multiple configurations using a simple web interface
- Statistics
- Automatically rotate IP every X requests
- Load balancing using multiple Super Proxies
- SSL analyzing (using a self-signed certificate)
- SOCKSv5 proxy

### Minimal requirements
- 2GB RAM
- 1 CPU
- 3GB SSD
- Ubuntu 16 LTS

## Installation

### Windows
Download the [Luminati Proxy Manager installer](https://github.com/luminati-io/luminati-proxy/releases/download/v1.170.700/luminati-proxy-manager-v1.170.700-setup.exe)

### Linux/MacOS - Install script
- Run the setup script to install
```sh
wget -qO- https://luminati.io/static/lpm/luminati-proxy-latest-setup.sh | bash
```
Or
```sh
curl -L https://luminati.io/static/lpm/luminati-proxy-latest-setup.sh | bash
```
### Linux/MacOS - Manual install
- Install Node.js 10 ([nodejs.org](https://nodejs.org/en/download/))
  Node.js version for the proxy manager should be any at least 10.15.3
- Make sure npm version is 6.4.1 or higher
  - if not, run: `sudo npm install -g npm@6.4.1`
- Install Luminati Proxy from the terminal prompt:
```sh
sudo npm install -g @luminati-io/luminati-proxy
```
If the command is returning an error try installing using --unsafe-perm flag
```sh
sudo npm install -g @luminati-io/luminati-proxy --unsafe-perm
```
If you are trying to install the Proxy Manager from china on Mac/Linux please run the following command first to make sure npm is installing with allowed registry:
```sh
 npm config set registry https://r.cnpmjs.org/
```
After this command ran successfully install using:
```sh
sudo npm install -g @luminati-io/luminati-proxy --unsafe-perm=true --allow-root
```
### Upgrade
- Use npm to upgrade
```sh
sudo npm install -g @luminati-io/luminati-proxy
```
Or use the cli command:
```sh
luminati --upgrade
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

### Run as daemon
To run the proxy manager in the background:
```sh
luminati --daemon
```

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

All command line options below are also available also as ENV variables.
Example:
```sh
cli: --port 22900 , env: LPM_PORT=22900
cli: --ssl true , env: LPM_SSL=true
cli: --log "error" , env: LPM_LOG=error
```

```sh
luminati --help
Usage:
  luminati [options] config1 config2 ...

Options:
  --port, -p               Port for the HTTP proxy                      [number]
  --proxy_type             Decide if to save proxy into the configuration file.
                           Specifying "persist" in "proxy_type" value will
                           create port and save it in the configuration file.
                                                                        [string]
  --multiply               Multiply the port definition given number of times
                                                                        [number]
  --ssl                    Enable SSL analyzing       [boolean] [default: false]
  --log                    Log level                [string] [default: "notice"]
  --iface                  Interface or IP to listen on
                                                   [string] [default: "0.0.0.0"]
  --customer               Luminati customer                            [string]
  --zone                   Zone                     [string] [default: "static"]
  --password               Zone password                                [string]
  --proxy                  Hostname or IP of super proxy
                                  [string] [default: "zproxy.lum-superproxy.io"]
  --proxy_port             Super proxy port            [number] [default: 22225]
  --proxy_connection_type  Connection type between LPM and Super Proxy
                                                      [string] [default: http]
  --proxy_retry            Automatically retry on super proxy failure
                                                           [number] [default: 2]
  --insecure               Enable SSL connection/analyzing to insecure hosts
                                                      [boolean] [default: false]
  --country                Country                                      [string]
  --state                  State                                        [string]
  --city                   City                                         [string]
  --asn                    ASN                                          [number]
  --ip                     Data center IP                               [string]
  --vip                    gIP                                          [number]
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
  --session                Luminati session for all proxy requests      [string]
  --pool_size              Session pool size               [number] [default: 3]
  --max_requests           Maximum requests per session   [string] [default: 50]
  --session_duration       Maximum duration of session (seconds)        [string]
  --throttle               Throttle requests above given number         [number]
  --whitelist_ips          Whitelist ip list for granting access to proxy
                                                           [array] [default: []]
  --race_reqs              Race several requests at once and choose fastest
                                                                        [number]
  --www                    HTTP and WebSocket port used for browser admin UI 
                           and request logs            [number] [default: 22999]
  --www_whitelist_ips      Whitelist IPs to access browser admin UI.    [string]
                           [default:"127.0.0.1"]
                           [example: --www_whitelist_ips "212.17.0.1"]
  --config                 Config file containing proxy definitions
                               [string] [default: "~/.luminati.json"]
  --cookie                 Cookie Jar file
                                [string] [default: "~/.luminati.jar"]
  --dropin                 Create dropin mode proxy port (default: 22225)
                                                       [boolean] [default: true]
  --dropin_port            Port for dropin mode                 [default: 22225]
  --no_usage_stats         Disable collection of usage statistics
                                                      [boolean] [default: false]
  --token                  A Google authorization token for accessing
                           luminati.io                                  [string]
  --request_stats          Enable requests statistics  [boolean] [default: true]
  --test_url               A url for testing proxy
                              [string] [default: "http://lumtest.com/myip.json"]
  --no-www                 Disable local web
  --no-config              Working without a config file
  --no-cookie              Working without a cookie file
  --daemon, -d             Start as a daemon
  --stop-daemon            Stop running daemon
  --upgrade                Upgrade proxy manager
  --force                  Force LPM to run and kill other processes if needed
                                                      [boolean] [default: false]
  --version, -v            Show version number                         [boolean]
  --help, -h, -?           Show help                                   [boolean]
  --api                                      [default: "https://lum-lpm.com"]
  --local_login            Requires each browser to authenticate against LPM
                                                      [boolean] [default: false]
  --read_only              Avoid saving current config in config file  [boolean]

```

### Docker

A docker image can be found on [https://hub.docker.com/r/luminati/luminati-proxy/](https://hub.docker.com/r/luminati/luminati-proxy/)

```sh
docker pull luminati/luminati-proxy

docker run luminati/luminati-proxy luminati

docker run luminati/luminati-proxy luminati --version
```
Make sure to forward appropriate ports. Proxy manager uses by default 22999
for the web console and the api, 22555 for dropin and 24000 for first
configurable proxy.

- To run docker with cli option see the below example:
```sh
docker run luminati/luminati-proxy luminati --www_whitelist_ips "172.17.0.1" --ssl true
```
You can add many more options to this run.

#### Docker with predefined config file
To use lpm's config file, docker volumes can be used:
https://docs.docker.com/storage/volumes/

Following these instructions will make your docker run with a specific config file:

- create volume
```sh
docker volume create lpm-vol
```
- Inspect the recently created volume
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
- Take the mountpoint path /var/lib/docker/volumes/lpm-vol/_data and run
```sh
cd /var/lib/docker/volumes/lpm-vol/_data
```
- put .luminati.json to this directory (here also will be the logs and other
files generated by the container)
- run docker image and attach this volume:
```sh
  docker run --rm --name 'lpm1' --mount source=lpm-vol,target=/root
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
