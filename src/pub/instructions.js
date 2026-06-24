// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import {Code, Info} from './common.js';
import {Instructions, Li} from '/www/util/pub/bullets.js';
import {T} from './common/i18n.js';
import {is_local} from './util.js';

const E = {};

E.code = (proxy=22225, lpm_token, hostname=document.location.hostname)=>{
    const auth = text=>!is_local() && lpm_token ?
        text.replace(/\[LT\]/g, lpm_token)
        .replace(/\[BAT\]/g, 'brd-auth-token')
        : '';
    const shell_auth = auth('--proxy-user [BAT]:[LT]');
    return {
        shell: `curl --proxy ${hostname}:${proxy} `
            +`${shell_auth ? `${shell_auth} ` : ''}`
            +`"http://geo.brdtest.com/mygeo.json"`,
        node: `#!/usr/bin/env node
const axios = require('axios');
const {HttpsProxyAgent} = require('https-proxy-agent');

const proxy = new HttpsProxyAgent('http://${auth('[BAT]:[LT]@')}${hostname}:${proxy}');

axios.get('https://geo.brdtest.com/mygeo.json', {
    httpsAgent: proxy,
    proxy: false
})
.then(response => console.log(response.data))
.catch(error => console.error(error));`,
        puppeteer: `const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--proxy-server=${hostname}:${proxy}',
            '--ignore-certificate-errors'
        ]
    });
    
    const page = await browser.newPage();${auth(`
    await page.authenticate({
        username: '[BAT]',
        password: '[LT]'
    });
    `)}
    await page.goto('https://geo.brdtest.com/mygeo.json');
    const content = await page.content();
    console.log(content);
    
    await browser.close();
})();`,
        playwright: `const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({
        proxy: {
            server: 'http://${hostname}:${proxy}',${auth(`
            username: '[BAT]',
            password: '[LT]'`)}
        }
    });
    
    const page = await browser.newPage({ 
        ignoreHTTPSErrors: true 
    });
    
    await page.goto('https://geo.brdtest.com/mygeo.json');
    const content = await page.content();
    console.log(content);
    
    await browser.close();
})();`,
        java: `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.InetSocketAddress;
import java.net.ProxySelector;${auth(`
import java.net.Authenticator;
import java.net.PasswordAuthentication;`)}

public class Example {
    public static void main(String[] args) throws Exception {${auth(`
        System.setProperty("jdk.http.auth.tunneling.disabledSchemes", "");`)}
        HttpClient client = HttpClient.newBuilder()
            .proxy(ProxySelector.of(new InetSocketAddress("${hostname}",`
            +` ${proxy})))
            ${auth(`.authenticator(new Authenticator() {
                @Override
                protected PasswordAuthentication getPasswordAuthentication() {
                    return new PasswordAuthentication("[BAT]", 
                        "[LT]".toCharArray());
                }
            })`)}
            .build();
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://geo.brdtest.com/mygeo.json"))
            .build();
        
        HttpResponse<String> response = client.send(request, 
            HttpResponse.BodyHandlers.ofString());
        
        System.out.println(response.body());
    }
}`,
        csharp: `using System;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;

class Example
{
    static async Task Main()
    {
        var handler = new HttpClientHandler
        {
            Proxy = new WebProxy("http://${hostname}:${proxy}"),
            UseProxy = true,
            ServerCertificateCustomValidationCallback = 
                HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
        };${auth(`
        handler.Proxy.Credentials = new NetworkCredential("[BAT]", "[LT]");`)}

        using var client = new HttpClient(handler);
        var response = await client.GetStringAsync(
            "https://geo.brdtest.com/mygeo.json");
        
        Console.WriteLine(response);
    }
}`,
        python: `#!/usr/bin/env python3
import requests${auth(`
from requests.auth import HTTPProxyAuth`)}

proxies = {
    'http': 'http://${hostname}:${proxy}',
    'https': 'http://${hostname}:${proxy}'
}${auth(`
auth = HTTPProxyAuth('[BAT]', '[LT]')`)}
response = requests.get('https://geo.brdtest.com/mygeo.json', 
    proxies=proxies, ${auth('auth=auth, ')}verify=False)

print(response.text)`,
        scrapy: `# settings.py
DOWNLOADER_MIDDLEWARES = {
    'scrapy.downloadermiddlewares.httpproxy.HttpProxyMiddleware': 110,
}${auth(`
HTTP_PROXY = 'http://[BAT]:[LT]@${hostname}:${proxy}'
HTTPS_PROXY = 'http://[BAT]:[LT]@${hostname}:${proxy}'`,
`# Proxy without authentication
HTTP_PROXY = 'http://${hostname}:${proxy}'
HTTPS_PROXY = 'http://${hostname}:${proxy}'`)}

# spider.py
import scrapy

class MySpider(scrapy.Spider):
    name = 'myspider'
    start_urls = ['https://geo.brdtest.com/mygeo.json']
    
    def parse(self, response):
        print(response.text)`,
        php: `<?php
require 'vendor/autoload.php';

use GuzzleHttp\\Client;

$client = new Client([
    'proxy' => 'http://${auth(`[BAT]:[LT]@`)}${hostname}:${proxy}',
    'verify' => false
]);

$response = $client->request('GET', 'https://geo.brdtest.com/mygeo.json');
echo $response->getBody();
?>`,
        ts: `import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

const proxy = new HttpsProxyAgent('http://${auth(`[BAT]:[LT]@`)}${hostname}:${proxy}');

interface GeoResponse {
    ip: string;
    country: string;
    city: string;
}

async function makeRequest(): Promise<void> {
    try {
        const response = await axios.get<GeoResponse>(
            'https://geo.brdtest.com/mygeo.json',
            { httpsAgent: proxy, proxy: false }
        );
        console.log(response.data);
    } catch (error) {
        console.error(error);
    }
}

makeRequest();`,
        go: `package main

import (
    "crypto/tls"
    "fmt"
    "io"
    "net/http"
    "net/url"
)

func main() {
    proxyURL, _ := url.Parse("http://${auth(`[BAT]:[LT]@`)}${hostname}:${proxy}")
    
    transport := &http.Transport{
        Proxy: http.ProxyURL(proxyURL),
        TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
    }
    
    client := &http.Client{Transport: transport}
    resp, err := client.Get("https://geo.brdtest.com/mygeo.json")
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()
    
    body, _ := io.ReadAll(resp.Body)
    fmt.Println(string(body))
}`,
        rust: `use reqwest;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let proxy = reqwest::Proxy::all("http://${auth(`[BAT]:[LT]@`)}${hostname}:${proxy}")?;
    
    let client = reqwest::Client::builder()
        .proxy(proxy)
        .danger_accept_invalid_certs(true)
        .build()?;
    
    let response = client
        .get("https://geo.brdtest.com/mygeo.json")
        .send()
        .await?;
    
    let body = response.text().await?;
    println!("{}", body);
    
    Ok(())
}`
  };
};

const Auth_step = ({lpm_token, type})=>{
    if (is_local() || !lpm_token)
        return null;
    const creds = <React.Fragment>
      <code><T>Username</T></code>:<Code>brd-auth-token</Code><br/>
      <code><T>Password</T></code>:<Code>{lpm_token}</Code>
    </React.Fragment>;
    if (type=='mac')
    {
        return <Li>
          <T>Check</T><code>Proxy server requires password</code><T> and enter:
            </T><br/>
          {creds}
        </Li>;
    }
    return <Li>
      <T>If prompt for a username and password, enter the following:</T><br/>
      {creds}
    </Li>;
};

const bext_urls = {
    chrome: 'https://chromewebstore.google.com/detail/bright-data/'
        +'efohiadmkaogdhibjbmeppjpebenaool?hl=en',
    firefox: 'https://addons.mozilla.org/en-US/firefox/addon/brightdata/',
};

const Extension_recommendation = ({type='chrome'})=>
<Info id="browser_extension_recommendation">
    <strong>Easier way:</strong> Use the{' '}
    <a href={bext_urls[type]}
       target="_blank"
       rel="noopener noreferrer">
        Bright Data Browser Extension
    </a>
    {' '}for automatic proxy configuration.
</Info>;

E.browser = (proxy=22225, lpm_token, hostname=document.location.hostname)=>({
    chrome_win: <React.Fragment>
        <Extension_recommendation type="chrome" />
        <Instructions>
        <Li>Open <code>chrome://settings/system</code> in a{' '}
            <a onClick={()=>window.open()}>new tab</a>
        </Li>
        <Li>Click <code>Open your computer's proxy settings</code></Li>
        <Li>In Windows Settings, scroll down and click <code>Proxy</code>
        </Li>
        <Li>Find <code>Manual proxy setup</code> section</Li>
        <Li>Enable <code>Use a proxy server</code></Li>
        <Li>Enter <code>Address</code>: <Code>{hostname}</Code> and{' '}
            <code>Port</code>: <Code>{proxy}</Code>
        </Li>
        <Li>Click <code>Save</code></Li>
        <Auth_step lpm_token={lpm_token} type="win"/>
        <Li>Restart browser</Li>
      </Instructions>
    </React.Fragment>,
    chrome_mac: <React.Fragment>
      <Extension_recommendation type="chrome" />
      <Instructions>
        <Li>Open <code>chrome://settings/system</code> in a{' '}
            <a onClick={()=>window.open()}>new tab</a>
        </Li>
        <Li>Click <code>Open your computer's proxy settings</code></Li>
        <Li>In System Settings, select <code>Network</code></Li>
        <Li>Click your active network connection (Wi-Fi or Ethernet)</Li>
        <Li>Click <code>Details...</code></Li>
        <Li>Select <code>Proxies</code> tab</Li>
        <Li>Check <code>Web Proxy (HTTP)</code> and{' '}
            <code>Secure Web Proxy (HTTPS)</code>
        </Li>
        <Li>Enter <code>Web Proxy Server</code>: <Code>{hostname}</Code>{' '}
            and <code>Port</code>: <Code>{proxy}</Code>
        </Li>
        <Li>Enter <code>Secure Web Proxy Server</code>:{' '}
            <Code>{hostname}</Code> and <code>Port</code>:{' '}
            <Code>{proxy}</Code>
        </Li>
        <Auth_step lpm_token={lpm_token} type="mac"/>
        <Li>Click <code>OK</code></Li>
        <Li>Restart browser</Li>
      </Instructions>
    </React.Fragment>,
    firefox: <React.Fragment>
      <Extension_recommendation type="firefox" />
      <Instructions>
        <Li>Open <code>about:preferences</code> in a{' '}
            <a onClick={()=>window.open()}>new tab</a>
        </Li>
        <Li>Scroll down to <code>Network Settings</code></Li>
        <Li>Click <code>Settings...</code> button</Li>
        <Li>Select <code>Manual proxy configuration</code></Li>
        <Li>Enter <code>HTTP Proxy</code>: <Code>{hostname}</Code> and{' '}
            <code>Port</code>: <Code>{proxy}</Code>
        </Li>
        <Li>Check <code>Also use this proxy for HTTPS</code></Li>
        <Li>In <code>No Proxy for</code> field, add:{' '}
            <Code>localhost, 127.0.0.1</Code>
        </Li>
        <Auth_step lpm_token={lpm_token}/>
        <Li>Click <code>OK</code></Li>
      </Instructions>
    </React.Fragment>,
    safari: <Instructions>
        <Li>Open Safari, then <code>Safari</code> menu {'->'}{' '}
            <code>Settings...</code>
        </Li>
        <Li>Go to <code>Advanced</code> tab</Li>
        <Li>Click <code>Change Settings...</code> next to Proxies</Li>
        <Li>In System Settings, select <code>Network</code></Li>
        <Li>Click your active network connection</Li>
        <Li>Click <code>Details...</code></Li>
        <Li>Select <code>Proxies</code> tab</Li>
        <Li>Check <code>Web Proxy (HTTP)</code> and{' '}
            <code>Secure Web Proxy (HTTPS)</code>
        </Li>
        <Li>Enter <code>Web Proxy Server</code>: <Code>{hostname}</Code>{' '}
            and <code>Port</code>: <Code>{proxy}</Code>
        </Li>
        <Li>Enter <code>Secure Web Proxy Server</code>:{' '}
            <Code>{hostname}</Code> and <code>Port</code>:{' '}
            <Code>{proxy}</Code>
        </Li>
        <Auth_step lpm_token={lpm_token} type="mac"/>
        <Li>Click <code>OK</code></Li>
        <Li>Restart Safari</Li>
    </Instructions>,
    brave: <React.Fragment>
      <Extension_recommendation type="chrome" />
      <Instructions>
        <Extension_recommendation type="chrome" />
        <Li>Open <code>brave://settings/system</code> in a{' '}
            <a onClick={()=>window.open()}>new tab</a>
        </Li>
        <Li>Click <code>Open your computer's proxy settings</code></Li>
        <Li>
            <strong>Windows:</strong> Follow the same steps as Chrome for
            Windows
        </Li>
        <Li>
            <strong>Mac:</strong> Follow the same steps as Chrome for Mac
        </Li>
        <Auth_step lpm_token={lpm_token}/>
        <Li>Restart browser</Li>
      </Instructions>
    </React.Fragment>,
    arc: <Instructions>
        <Li>Arc browser uses system proxy settings</Li>
        <Li>Open <code>System Settings</code> {'->'} <code>Network</code>{' '}
            (Mac only)
        </Li>
        <Li>Select your active network connection (Wi-Fi or Ethernet)</Li>
        <Li>Click <code>Details...</code></Li>
        <Li>Select <code>Proxies</code> tab</Li>
        <Li>Check <code>Web Proxy (HTTP)</code> and{' '}
            <code>Secure Web Proxy (HTTPS)</code>
        </Li>
        <Li>Enter <code>Web Proxy Server</code>: <Code>{hostname}</Code>{' '}
            and <code>Port</code>: <Code>{proxy}</Code>
        </Li>
        <Li>Enter <code>Secure Web Proxy Server</code>:{' '}
            <Code>{hostname}</Code> and <code>Port</code>:{' '}
            <Code>{proxy}</Code>
        </Li>
        <Auth_step lpm_token={lpm_token} type="mac"/>
        <Li>Click <code>OK</code></Li>
        <Li>Restart Arc</Li>
    </Instructions>,
});

export default E;
