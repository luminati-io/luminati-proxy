// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';

const before_save = {
    regex: val=>{
        try { new RegExp(val); }
        catch(e){ val = null; }
        return val;
    },
};

export const tabs = {
    logs: {fields: [], label: 'Logs'},
    target: {
        label: 'Targeting',
        tooltip: 'Select specific targeting for your proxy exit node',
        fields: {
            country: {
                label: 'Country',
                tooltip: 'Choose your exit country for your requests',
            },
            state: {
                label: 'State',
                tooltip: 'Specific state in a given country',
            },
            city: {
                label: 'City',
                tooltip: 'The city from which IP will be allocated',
                placeholder: 'Type in city name'
            },
            asn: {
                label: <span>
                    ASN (
                    <a
                      className="link"
                      href="http://bgp.potaroo.net/cidr/autnums.html"
                      target="_blank" rel="noopener noreferrer">
                      ASN list
                    </a>)
                    </span>,
                tooltip: `ASN uniquely identifies each network on the internet.
                    Target exit nodes (IPs) on a specific ASN`,
                placeholder: 'ASN code e.g. 42793'
            },
            carrier: {
                label: 'Carrier',
                tooltip: 'Network provider company name',
            },
        },
    },
    speed: {
        label: 'Request speed',
        tooltip: 'Control the speed of your request to improve performance',
        fields: {
            dns: {
                label: 'DNS lookup',
                tooltip: 'Location of DNS resolve',
            },
            pool_size: {
                label: 'Pool size',
                tooltip: `Maintain number of IPs that will be pinged constantly
                    - must have keep_alive to work properly`,
                ext: true,
            },
            request_timeout: {
                label: 'Timeout for requests',
                tooltip: `Kill requests to proxy and try new one if
                    timeout is exceeded`,
                ext: true,
            },
            race_reqs: {
                label: 'Parallel race requests',
                tooltip: `Sends multiple requests in parallel via different
                    super proxies and uses the fastest request`,
                placeholder: 'Number of parallel requests'
            },
            proxy_count: {
                label: 'Minimum number of super proxies',
                tooltip: `Minimum number of super proxies to use in parallel`,
            },
            proxy_switch: {
                label: 'Switch super proxy on failure',
                tooltip: `Number of failed requests(status 403, 429, 502, 503)
                    to switch to different super proxy`,
            },
            throttle: {
                label: 'Throttle requests',
                tooltip: `Throttle requests above the given number. Allow
                    maximum number of parallel requests`,
                ext: true,
            },
            reverse_lookup: {
                label: 'Reverse resolve',
                tooltip: 'resolve DNS from IP to url',
                ext: true,
            },
            reverse_lookup_file: {
                label: 'Path to file',
                placeholder: '/path/to/file',
            },
            reverse_lookup_values: {
                label: 'Values',
                placeholder: '1.1.1.1 example.com',
            },
        },
    },
    rules: {
        label: 'Rules',
        tooltip: 'Define custom action for specific rule',
        fields: {
            trigger_type: {
                label: 'Rule type',
                tooltip: `In every request the response will be analyzed.
                    if the configured Trigger rule is true, the Action
                    will be executed automatically`,
            },
            body_regex: {
                label: 'String to be scanned in body (Regex)',
                placeholder:`i.e. (captcha|robot)`,
                tooltip:`A string(regular expression) to be scanned in the
                    body of the response`
            },
            min_req_time: {
                label: 'Minimum request time',
                placeholder: '500',
                tooltip: `Any request time above the given value in milliseconds
                    will trigger the action`
            },
            max_req_time: {
                label: 'Maximum request time',
                placeholder: '500',
                tooltip: `Any request time below the given value in milliseconds
                    will trigger the action`
            },
            trigger_url_regex: {
                label: 'Apply only on specific domains (optional)',
                placeholder:`i.e. example.com`,
                tooltip: `enable trigger to certain urls`
            },
            status_code: {
                label: 'Status code string to be scanned',
                tooltip: `status code to be scanned in the response headers`
            },
            status_custom: {
                label: 'Custom status code (regex)',
                placeholder:`i.e. (2..|3..|404)`,
                tooltip: `A string(regular expression) to be scanned in the
                    head of the response`
            },
            action: {
                label: 'Action type',
                tooltip: `The action to be executed when rule is met`,
            },
            retry_number: {
                label: 'Number of retries',
                tooltip: 'maximum number of retries to execute'
            },
            retry_port: {
                label: 'Retry using a different port',
                tooltip: 'Make additional request using a different port'
            },
            ban_ip_duration: {
                label: 'Ban IP for',
                tooltip: 'will remove the IP for a defined amount of time'
            },
            ban_ip_custom: {label: 'Custom duration'},
        },
    },
    rotation: {
        label: 'IP control',
        tooltip: 'Set the conditions for which your IPs will change',
        fields: {
            ip: {
                label: 'Data center IP',
                tooltip: `Choose specific data center IP. to ensure
                    all requests are executed using specific Data Center IP.
                    to view the pool of your IPs take a look at 'pool size'
                    option`,
                placeholder: 'insert IP value from your pool'
            },
            vip: {
                label: 'gIP',
                tooltip: `Choose specific gIP to ensure all requests are
                    executed using specific gIP. to view the pool of your gIPs
                    take a look at 'pool size' option`,
                placeholder: 'insert gIP id'
            },
            pool_type: {
                label: 'Pool type',
                tooltip: `How to pull the IPs - roundrobin / sequential`,
                ext: true,
            },
            keep_alive: {
                label: 'Keep-alive',
                tooltip: `Chosen number of sec to ping ip and keep it
                    connected. depending on peer availability.`,
                ext: true,
            },
            whitelist_ips: {
                label: 'Whitelist IP access',
                tooltip: `Grant proxy access to specific IPs. only those
                    IPs will be able to send requests to this proxy port`,
                placeholder: `e.g. 1.1.1.1,23.23.23.23`,
                ext: true,
            },
            session_random: {
                label: 'Random session',
                tooltip: `Switch session ID on each request`,
                ext: true,
            },
            session: {
                label: 'Explicit session',
                tooltip: `Insert session ID to maintain the same ip
                    for as long as possible.`,
            },
            sticky_ip: {
                label: 'Sticky IP',
                tooltip: `When connecting to remote lpm server stick sessions
                    to each computer. each connected computer will receive
                    unique session`,
                ext: true,
            },
            max_requests: {
                label: 'Max requests',
                tooltip: `Change session based on number of requests can be a
                    range or a fixed number. when using browser it should be
                    taken into consideration that one page load will attempt
                    multiple requests under the hood`,
                ext: true,
            },
            session_duration: {
                label: 'Session duration (seconds)',
                tooltip: `Change session after fixed number of seconds`,
                ext: true,
            },
            seed: {
                label: 'Session ID seed',
                tooltip: `Seed used for random number generator in random
                    sessions`,
            }
        },
    },
    debug: {
        label: 'Debugging',
        tooltip: 'Improve the info you receive from the Proxy Manager',
        fields: {
            history: {
                label: 'Enable logs',
                tooltip: `Last 1K requests are automatically logged for easy
                    debugging. Enable Logs to save all requests`,
                ext: true,
            },
            ssl: {
                label: 'Enable SSL logs',
                tooltip: `Enable SSL Logs in order to save HTTTPs requests`,
                ext: true,
            },
            log: {
                label: 'Log level',
                tooltip: `Decide which data to show in logs`,
                ext: true,
            },
            debug: {
                label: 'Luminati request debug info',
                tooltip: `Send debug info on every request`,
            },
        },
    },
    general: {
        label: 'General',
        tooltip: '',
        fields: {
            port: {
                label: 'Proxy port',
                tooltip: `The port number that will be used for the current
                    proxy configuration`,
                ext: true,
            },
            password: {
                label: 'Zone password',
                tooltip: `Zone password as it appears in your zones page in
                    your Luminati's control panel http://luminati.io/cp/zones`,
            },
            iface: {
                label: 'Interface',
                tooltip: 'Define a specific network interface on which '
                    +'the local machine is running',
                ext: true,
            },
            multiply: {
                label: 'Multiply proxy port',
                tooltip: `Create multiple identical porxy ports`,
                ext: true,
            },
            multiply_ips: {
                label: 'Multiply proxy port per IP',
                tooltip: `Create proxy port for every selected IP from the
                    pool`
            },
            multiply_vips: {
                label: 'Multiply proxy port per gIP',
                tooltip: `Create proxy port for every selected gIP from pool
                    of available gIPS in your zone`
            },
            socks: {
                label: 'SOCKS 5 port',
                tooltip: `In addition to current proxy port, creates a separate
                    port with a SOCKS5 server (add SOCKS port number)`,
                ext: true,
            },
            secure_proxy: {
                label: 'SSL to super proxy',
                tooltip: `Encrypt requests sent to super proxy to avoid
                    detection on DNS`,
                ext: true,
            },
            null_response: {
                label: 'URL regex for null response',
                tooltip: `on this url pattern, lpm will return a "null
                    response" without proxying (useful when users don't want
                    to make a request, but a browser expects 200 response)`,
                ext: true,
                before_save: before_save.regex,
            },
            bypass_proxy: {
                label: `URL regex for bypassing`,
                tooltip: `Insert URL pattern for which requests will be passed
                    directly to target site without any proxy
                    (super proxy or peer)`,
                ext: true,
                before_save: before_save.regex,
            },
            direct_include: {
                label: `URL regex for super proxy`,
                tooltip: `Insert URL pattern for which requests will be passed
                    through super proxy directly (not through peers)`,
                before_save: before_save.regex,
            },
            direct_exclude: {
                label: `URL regex for not super proxy`,
                tooltip: `Insert URL pattern for which requests will NOT be
                    passed through super proxy`,
                before_save: before_save.regex,
            },
            allow_proxy_auth: {
                label: 'Allow request authentication',
                tooltip: `Pass auth data per request (use lpm like
                    api)`,
            },
        },
    },
};

export const all_fields = Object.keys(tabs)
    .map(k=>tabs[k].fields)
    .reduce((acc, el)=>({...acc, ...el}), {});
