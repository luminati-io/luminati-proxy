# Proxy manager

[![dependencies Status](https://david-dm.org/luminati-io/luminati-proxy/status.svg)](https://david-dm.org/luminati-io/luminati-proxy)
[![devDependencies Status](https://david-dm.org/luminati-io/luminati-proxy/dev-status.svg)](https://david-dm.org/luminati-io/luminati-proxy?type=dev)
[![optionalDependencies Status](https://david-dm.org/luminati-io/luminati-proxy/optional-status.svg)](https://david-dm.org/luminati-io/luminati-proxy?type=optional)

A forward HTTP/HTTPS proxy on your side, to accelerate/compress/rotate/distribute/manage/monitor/report/log/debug traffic to your proxies around the world.

With Proxy manager you can drive the Bright Data residential IPs or Bright Data static IPs.

This tool requires a [Bright Data](https://brightdata.com/?cam=github-proxy) account.
Please report issues or bugs to your account manager or from our [help center](https://brightdata.com/faq#proxy)

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
- 3GB HDD

### Recommended requirements
- 4GB RAM
- 2 CPUs
- 3GB SSD

## Installation

### Windows
Download the [Proxy Manager installer](https://github.com/luminati-io/luminati-proxy/releases/download/v1.254.686/luminati-proxy-manager-v1.254.686-setup.exe)

### Linux/MacOS - Install script
- Run the setup script to install
```sh
wget -qO- https://brightdata.com/static/lpm/luminati-proxy-latest-setup.sh | bash
```
Or
```sh
curl -L https://brightdata.com/static/lpm/luminati-proxy-latest-setup.sh | bash
```
### Linux/MacOS - Manual install
- Install Node.js 12 ([nodejs.org](https://nodejs.org/en/download/))
  Node.js version for the proxy manager should be any at least 12.18.3
- Make sure npm version is 6.14.6 or higher
  - if not, run: `sudo npm install -g npm@6.14.6`
- Install Proxy Manager from the terminal prompt:
```sh
sudo npm install -g @luminati-io/luminati-proxy
```
If you are trying to install the Proxy Manager from china on Mac/Linux please run the following command first to make sure npm is installing with allowed registry:
```sh
 npm config set registry https://r.cnpmjs.org/
```
After this command ran successfully install using:
```sh
sudo npm install -g @luminati-io/luminati-proxy --allow-root
```
### Upgrade
- Use npm to upgrade
```sh
sudo npm install -g @luminati-io/luminati-proxy
```
Or use the cli command:
```sh
proxy-manager --upgrade
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
proxy-manager
```
Point your browser to the app admin UI
[http://127.0.0.1:22999](http://127.0.0.1:22999) to set up credentials
and configure your proxies.

### Run as daemon
To run the proxy manager in the background:
```sh
proxy-manager --daemon
```

### Dropin replacement for existing super-proxies

Proxy Manager comes with a "dropin mode" which behaves exactly like the
existing super-proxies. When running a proxy in dropin mode, you do not need to
sign in via the administrative UI in order to make requests through your
proxies. Rather, the proxy username and password are provided with each request
to the proxy server. This mode is enabled by default, and you can use this mode
as an easy replacement when migrating from the regular super-proxy to the Proxy
Manager.

Dropin mode is enabled by default. To disable the dropin proxy, use the flag
`--no-dropin`:

```sh
proxy-manager --no-dropin
```

For full documentation on the API for making requests through the dropin proxy,
see <a href="https://brightdata.com/cp/api_example?manager=all&group=active">the
API Example page in your Bright Data account</a>.

### Complete list of command line options

```sh
proxy-manager --help
Usage:
  proxy-manager [options] config1 config2 ...

Options:
  --help, -h, -?                Show help                              [boolean]
  --version, -v                 Show version number                    [boolean]
  --port, -p                    Port for the HTTP proxy                 [number]
  --proxy_type                  Set to "persist" to save proxy into the
                                configuration file.                     [string]
  --multiply                    Multiply the port definition given number of
                                times                      [number] [default: 0]
  --multiply_users                                    [boolean] [default: false]
  --users                       List of users. This option has to be used along
                                with "multiply_users"                    [array]
  --ssl                         Enable SSL analyzing  [boolean] [default: false]
  --tls_lib                     SSL library       [string] [default: "open_ssl"]
  --iface                       Interface or IP to listen on            [string]
  --customer                    Customer name                           [string]
  --zone                        Zone name           [string] [default: "static"]
  --password                    Zone password                           [string]
  --proxy                       Hostname or IP of super proxy
                                  [string] [default: "zproxy.lum-superproxy.io"]
  --proxy_port                  Super proxy port       [number] [default: 22225]
  --proxy_connection_type       Determines what kind of connection will be used
                                between Proxy Manager and Super Proxy
                                                      [string] [default: "http"]
  --proxy_retry                 Automatically retry on super proxy failure
                                                           [number] [default: 2]
  --insecure                    Enable SSL connection/analyzing to insecure
                                hosts                                  [boolean]
  --country                     Country                                 [string]
  --state                       State                                   [string]
  --city                        City                                    [string]
  --asn                         ASN                                     [string]
  --ip                          Data Center IP                          [string]
  --vip                         gIP                                     [number]
  --ext_proxies                 A list of proxies from external vendors. Format:
                                [username:password@]ip[:port]            [array]
  --ext_proxy_username          Default username for external vendor ips[string]
  --ext_proxy_password          Default password for external vendor ips[string]
  --ext_proxy_port              Default port for external vendor ips    [number]
  --dns                         DNS resolving                           [string]
  --reverse_lookup_dns          Process reverse lookup via DNS
                                                      [boolean] [default: false]
  --reverse_lookup_file         Process reverse lookup via file         [string]
  --reverse_lookup_values       Process reverse lookup via value         [array]
  --session                     Session for all proxy requests
                                                        [string] [default: true]
  --sticky_ip                   Use session per requesting host to maintain IP
                                per host              [boolean] [default: false]
  --pool_size                                                           [number]
  --rotate_session              Session pool size     [boolean] [default: false]
  --throttle                    Throttle requests above given number
                                                          [number] [default: ""]
  --rules                       Proxy request rules                      [array]
  --route_err                   Block or allow requests to be automatically sent
                                through super proxy on error
                                                  [string] [default: "pass_dyn"]
  --smtp                                                                 [array]
  --override_headers                                                   [boolean]
  --os                          Operating System of the Peer IP         [string]
  --headers                     Request headers                          [array]
  --debug                       Request debug info    [string] [default: "full"]
  --socket_inactivity_timeout                         [number] [default: 120000]
  --multiply_ips                                      [boolean] [default: false]
  --multiply_vips                                     [boolean] [default: false]
  --max_ban_retries                                       [number] [default: 10]
  --preset                                    [string] [default: "session_long"]
  --ua                          Unblocker Mobile UA   [boolean] [default: false]
  --timezone                    Timezone ID to be used by the browser   [string]
  --resolution                  Browser screen size                     [string]
  --webrtc                      WebRTC plugin behavior in the browser   [string]
  --whitelist_ips               Default for all proxies whitelist ip list for
                                granting access to them    [array] [default: []]
  --www_whitelist_ips           Whitelist ip list for granting access to browser
                                admin UI                   [array] [default: []]
  --www                         HTTP and WebSocket port used for browser admin
                                UI and request logs             [default: 22999]
  --config                      Config file containing proxy definitions[string]
  --mode                        Defines a set of permissible operations within
                                the UI/API                              [string]
  --dropin                      Create dropin mode proxy port (default: 22225)
                                                       [boolean] [default: true]
  --dropin_port                 Port for dropin mode            [default: 22225]
  --no_usage_stats              Disable collection of usage statistics
                                                      [boolean] [default: false]
  --lpm_token                   An authorization token                  [string]
  --high_perf                                         [boolean] [default: false]
  --zagent                                            [boolean] [default: false]
  --cluster                                             [string] [default: true]
  --sync_config                 Synchronize Proxy Manager configuration with the
                                cloud                 [boolean] [default: false]
  --sync_zones                                         [boolean] [default: true]
  --sync_stats                                         [boolean] [default: true]
  --request_stats               Enable requests statistics
                                                       [boolean] [default: true]
  --test_url                    Url for testing proxy
                              [string] [default: "http://lumtest.com/myip.json"]
  --log                         Log level           [string] [default: "notice"]
  --logs                        Number of request logs to store
                                                        [number] [default: 1000]
  --har_limit                   Number of bytes to store[number] [default: 1024]
  --ports_limit                 Limit the numer of open proxy ports at the same
                                time                            [default: 10000]
  --ui_ws                       Enable live logs preview and other live data
                                communication on the UI[boolean] [default: true]
  --force                       Kill other instances of Proxy Manager if there
                                are any               [boolean] [default: false]
  --session_termination         Stop sending new requests when the peer IP
                                becomes unavailable and redirect to confimration
                                page before new IP is taken
                                                      [boolean] [default: false]
  --api                         Alternative url to luminati API         [string]
  --api_domain                  Alternative domain url to luminati API
                                               [string] [default: "lum-lpm.com"]
  --local_login                 Requires each browser to authenticate against
                                Proxy Manager         [boolean] [default: false]
  --read_only                   Avoid saving current config in the config file
                                                      [boolean] [default: false]
  --extra_ssl_ips               List of IPs to add to SSL certificate
                                                           [array] [default: []]
  --no-www                      Disable local web
  --no-config                   Working without a config file
  --daemon, -d, --start-daemon  Start as a daemon
  --restart-daemon              Restart running daemon
  --stop-daemon                 Stop running daemon
  --delete-daemon               Delete daemon instance
  --upgrade                     Upgrade proxy manager
  --downgrade                   Downgrade proxy manager (if backup exists on
                                disk)
  --dir                         Path to the directory with database and
                                configuration files
  --status                      Show proxy manager processes current status
  --gen-cert                    Generate cert
  --auto-upgrade                Enable auto upgrade
  --start-upgrader              Install CRON process that checks upgrades
  --stop-upgrader               Removes CRON process that checks upgrades
  --insecure-http-parser        Disables the strict checks
  --proxy_country                                                  [default: ""]
  --bw_limit                                                        [default: 0]
  --info                                                        [default: false]
  --cn                                                          [default: false]
  --api_body_limit                                              [default: "2mb"]
  --api_domain_fallback                                   [default: "l-lpm.com"]
```

### Docker

A docker image can be found on [https://hub.docker.com/r/luminati/luminati-proxy/](https://hub.docker.com/r/luminati/luminati-proxy/)

```sh
docker pull luminati/luminati-proxy

docker run luminati/luminati-proxy proxy-manager

docker run luminati/luminati-proxy proxy-manager --version
```
Make sure to forward appropriate ports. Proxy manager uses by default 22999
for the web console and the api, 22225 for dropin and 24000 for first
configurable proxy.

- To run docker with cli option see the below example:
```sh
docker run luminati/luminati-proxy proxy-manager --www_whitelist_ips "172.17.0.1" --ssl true
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
"luminati/luminati-proxy" proxy-manager
```

### SSL Requests

The --ssl parameter is for SSL analyzing, HTTPS requests can be made without it.

## Help

The FAQ can be found on the Bright Data
[FAQ](https://brightdata.com/faq#proxy)

If you do not find the answer there, feel free to open an
[issue on github](issues).

Or contact [support@brightdata.com](mailto:support@brightdata.com).

## REST API

Working documentation of the API can be found inside the app.

The API also can be found on the Bright Data [here](https://brightdata.com/doc/api#lpm_endpoints)
