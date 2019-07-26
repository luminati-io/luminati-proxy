# Luminati Proxy manager

[![dependencies Status](https://david-dm.org/luminati-io/luminati-proxy/status.svg)](https://david-dm.org/luminati-io/luminati-proxy)
[![devDependencies Status](https://david-dm.org/luminati-io/luminati-proxy/dev-status.svg)](https://david-dm.org/luminati-io/luminati-proxy?type=dev)
[![optionalDependencies Status](https://david-dm.org/luminati-io/luminati-proxy/optional-status.svg)](https://david-dm.org/luminati-io/luminati-proxy?type=optional)

一个HTTP/HTTPS 代理服务器在你身边，为你世界各地的代理流量加速/压缩/轮流/分发/管理/监控/汇报/日志/调试

用 Luminati HTTP/HTTPS 代理管理器你可以使用Luminati 住宅 IPs 或 Luminati 数据心 IPs.

这个工具需要一个 [Luminati](https://lum-lpm.com/?cam=github-proxy) 账户.

## 特征
- 可扩展
- 连接池（更快的反应）
- 省心的建立组态
- 统计数据
- 每N请求自动轮流IP
- 负载均衡
- SSL 嗅探
- SOCKSv5 代理

### 软件更新要求
- 2GB RAM
- 1 CPU
- 50GB SSD
- 2TB 宽带
- Ubuntu 16 LTS

## 安装

### 要求
软件要求:

- <a href="https://git-scm.com/downloads/">Git</a> 1.7+版
- <a href="https://nodejs.org/en/download/">Node.js</a> 6+版

### Windows
下载 <a href="https://lum-lpm.com/static/lpm/luminati-proxy-manager-v1.145.600-setup.exe">代理管理安装器</a>.

### Linux/MacOS
- 安装 Node.js 10.15.3版 (最好用x
  [nave](https://github.com/isaacs/nave))
- 从终端安装 Luminati 代理:
```sh
sudo npm install -g luminati-io/luminati-proxy
```
### 升级
- 用npm升级
```sh
sudo npm install -g luminati-io/luminati-proxy
```
### 发布说明

你可以在 [CHANGELOG.md](https://github.com/luminati-io/luminati-proxy/blob/master/CHANGELOG.md) 里找到每个版本的修改.

## 运用

### 第一次运行
第一次运行之后:
```sh
luminati
```
把你的浏览器设到 [http://127.0.0.1:22999](http://127.0.0.1:22999) 为了设置凭证和代理服务器.

登录之后，你会看到Luminati的默认设置所含一个”drop in”代理服务器在接口22225运行。细节提供在下面.

### 超级代理服务器的‘Dropin’替代

Luminati 代理服务器所含的”Dropin 模式” 和现有的超级代理服务器的功能相同。在 ‘dropin’ 模式运行代理时，你不需要登录行政UI就能发出请求。代理账户和密码会自动被提供。’dropin’ 模式是默认模式，和可以让你容易的从一般的超级代理服务器转到Luminati 代理管理器.

’dropin’ 模式是默认模式。如果你想禁用’dropin’,请用命令：--no-dropin:

```sh
luminati --no-dropin
```

为了完整的API解说文件 （为了'dropin'代理请求），请从你的Luminati.io账户关注 <a href="https://lum-lpm.com/cp/api_example?manager=all&group=active">API例网页</a>.

### 完整的API命令名单:
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
  --sticky_ip              Use session per requesting host to maintain IP per
                           host                       [boolean] [default: false]
  --pool_size              Session pool size               [number] [default: 3]
  --pool_type              Pool session iteration order                 [string]
  --seed                   Session ID seed used for identifying sessions from
                           this proxy                                   [string]
  --max_requests           Maximum requests per session   [string] [default: 50]
  --session_duration       Maximum duration of session (seconds)        [string]
  --throttle               Throttle requests above given number         [number]
  --whitelist_ips          Whitelist ip list for granting access to proxy
                                                           [array] [default: []]
  --race_reqs              Race several requests at once and choose fastest
                                                                        [number]
  --www                    HTTP port for browser admin UI       [default: 22999]
  --www_whitelist_ips      Whitelist IPs to access browser admin UI.    [string]
                           [default:"127.0.0.1"]
                           [example: --www_whitelist_ips "212.17.0.1"]
  --ws                     WebSocket port used for request logs [default: 22998]
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

```

### Docker

'Docker' 图片能在这里找着 [https://hub.docker.com/r/luminati/luminati-proxy/](https://hub.docker.com/r/luminati/luminati-proxy/)

```sh
docker pull luminati/luminati-proxy

docker run luminati/luminati-proxy

docker run luminati/luminati-proxy luminati --version
```

### SSL 请求

-ssl 参数是为了 SSL analyzing, HTTPS请求不需要它就能运行

## 帮助

常见问题 [FAQ](https://lum-lpm.com/faq#proxy)

如果你在Luminati 常见问题找不着解决方式，可以在 [github 上提问](https://github.com/luminati-io/luminati-proxy/issues).

或联系 [support@luminati.io](mailto:support@luminati.io).

## REST API

API的解说文件能在APP里找着

详细解释能在 [这里](http://petstore.swagger.io/?url=https://raw.githubusercontent.com/luminati-io/luminati-proxy/master/lib/swagger.json) 找到

## Node.js API

代理管理器可以当作一个需要的软件为了node.js软件 - 消除独立运行node.js的必要.

API支持 [Promises](https://www.promisejs.org/) 和 [Generators](https://www.promisejs.org/generators/). 它内部会用 [request module](https://github.com/request/request) 莫和支持所有它的特征

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
const etask = require('./util/etask.js');
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
