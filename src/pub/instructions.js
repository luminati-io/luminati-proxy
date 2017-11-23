// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import {Code} from './common.js';

const E = {};
const Li = props=>(
    <li>
      <div className="circle_wrapper">
        <div className="circle"></div>
      </div>
      <div className="single_instruction">{props.children}</div>
    </li>
);

E.code = (proxy=24000)=>({
    shell: `curl --proxy 127.0.0.1:${proxy} "http://lumtest.com/myip.json"`,
    node: `#!/usr/bin/env node
require('request-promise')({
    url: 'http://lumtest.com/myip.json',
    proxy: 'http://127.0.0.1:${proxy}'
}).then(function(data){
    console.log(data);
}, function(err){
    console.error(err);
});`,
    java: `package example;

import org.apache.http.HttpHost;
import org.apache.http.client.fluent.*;

public class Example {
    public static void main(String[] args) throws Exception {
        HttpHost proxy = new HttpHost("127.0.0.1", ${proxy});
        String res = Executor.newInstance()
            .execute(Request.Get("http://lumtest.com/myip.json")
            .viaProxy(proxy))
            .returnContent().asString();
        System.out.println(res);
    }
}`,
    csharp: `using System;
using System.Net;

class Example
{
    static void Main()
    {
        var client = new WebClient();
        client.Proxy = new WebProxy("127.0.0.1:${proxy}");
        Console.WriteLine(client.DownloadString(
            "http://lumtest.com/myip.json"));
    }
}`,
    vb: `Imports System.Net

Module Example
    Sub Main()
        Dim Client As New WebClient
        Client.Proxy = New WebProxy("http://127.0.0.1:${proxy}")
        Console.WriteLine(Client.DownloadString(
            "http://lumtest.com/myip.json"))
    End Sub
End Module`,
    python: `#!/usr/bin/env python
print('If you get error "ImportError: No module named \\'six\\'"'+\\
    'install six:\\n$ sudo pip install six');
import sys
if sys.version_info[0]==2:
    import six
    from six.moves.urllib import request
    opener = request.build_opener(
        request.ProxyHandler(
            {'http': 'http://127.0.0.1:${proxy}'}))
    print(opener.open('http://lumtest.com/myip.json').read())
if sys.version_info[0]==3:
    import urllib.request
    opener = urllib.request.build_opener(
        urllib.request.ProxyHandler(
            {'http': 'http://127.0.0.1:${proxy}'}))
    print(opener.open('http://lumtest.com/myip.json').read())`,
    ruby: `#!/usr/bin/ruby

require 'uri'
require 'net/http'

uri = URI.parse('{{example.user_url}}')
proxy = Net::HTTP::Proxy('127.0.0.1', ${proxy})

req = Net::HTTP::Get.new(uri.path)

result = proxy.start(uri.host,uri.port) do |http|
    http.request(req)
end

puts result.body`,
    php: `<?php
    $curl = curl_init('http://lumtest.com/myip.json');
    curl_setopt($curl, CURLOPT_PROXY, 'http://127.0.0.1:${proxy}');
    curl_exec($curl);
?>`,
    perl: `#!/usr/bin/perl
use LWP::UserAgent;
my $agent = LWP::UserAgent->new();
$agent->proxy(['http', 'https'], "http://127.0.0.1:${proxy}");
print $agent->get('http://lumtest.com/myip.json')->content();`,
});
E.browser = (proxy=24000)=>({
    chrome_win: (
        <ol>
          <Li>Click the Chrome menu on the browser toolbar.</Li>
          <Li>Select "Settings".</Li>
          <Li>Click "Advanced settings".</Li>
          <Li>In the "System" section, click "Open proxy settings".</Li>
          <Li>Click "LAN settings".</Li>
          <Li>Select the "Use a proxy server for your LAN" check box under
            "Proxy Server".</Li>
          <Li>
            Enter "Address":
            <Code id="address">127.0.0.1</Code>
          </Li>
          <Li>
            Enter "Port":
            <Code id="address">{proxy}</Code>
          </Li>
          <Li>Save changes by pressing "OK".</Li>
        </ol>
    ),
    chrome_mac: (
        <ol>
          <Li>Click the Chrome menu on the browser toolbar.</Li>
          <Li>Select "Settings".</Li>
          <Li>Click "Show advanced settings".</Li>
          <Li>In the "Network" section, click "Change proxy settings".</Li>
          <Li>System Preferences should start up automatically, with the
            Network window open and Proxies selected.</Li>
          <Li>Choose "Web Proxy (HTTP)".</Li>
          <Li>
            Enter "Web Proxy Server":
            <Code id="address">127.0.0.1</Code>
          </Li>
          <Li>
            Enter "Port":
            <Code id="address">{proxy}</Code>
          </Li>
          <Li>Save changes by pressing "OK".</Li>
        </ol>
    ),
    ie: (
        <ol>
          <Li>Click the Tools button, and then click Internet options.</Li>
          <Li>Click the Connections tab.</Li>
          <Li>Click "LAN settings".</Li>
          <Li>Select the "Use a proxy server for your LAN" check box.</Li>
          <Li>
            Enter "Address":
            <Code id="address">127.0.0.1</Code>
          </Li>
          <Li>
            Enter "Port":
            <Code id="address">{proxy}</Code>
          </Li>
          <Li>Save changes by pressing "OK".</Li>
        </ol>
    ),
    firefox: (
        <ol>
          <Li>In main menu, click "Tools" and then click "Options".</Li>
          <Li>Click the "General" tab and scroll down to "Network Proxy".</Li>
          <Li>Open network settings by clicking "Settings..." button.</Li>
          <Li>Choose "Manual proxy configuration" radio button.</Li>
          <Li>
            Enter "HTTP Proxy":
            <Code id="address">127.0.0.1</Code>
          </Li>
          <Li>
            Enter "Port":
            <Code id="address">{proxy}</Code>
          </Li>
          <Li>Tick "Use this proxy server for all protocols" checkbox.</Li>
          <Li>Save changes by pressing "OK".</Li>
        </ol>
    ),
    safari: (
        <ol>
          <Li>Pull down the Safari menu and select "Preferences".</Li>
          <Li>Click on the "Advanced" icon.</Li>
          <Li>In the "Proxies" option, click on Change Settings.</Li>
          <Li>System Preferences should start up automatically, with the
            Network window open and Proxies selected.</Li>
          <Li>Choose "Web Proxy (HTTP)".</Li>
          <Li>
            Enter "Web Proxy Server":
            <Code id="address">127.0.0.1</Code>
          </Li>
          <Li>
            Enter "Port":
            <Code id="address">{proxy}</Code>
          </Li>
          <Li>Save changes by pressing "OK".</Li>
        </ol>
    ),
});

export default E;
