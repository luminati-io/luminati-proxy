// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';

export const tabs = {
    logs: {
        fields: [],
        label: 'Logs',
        tooltip: 'Logs of requests sent through this proxy port',
    },
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
                placeholder: 'Type in city name',
            },
            asn: {
                label: <span>
                    ISP/ASN (
                    <a className="link"
                      href="http://bgp.potaroo.net/cidr/autnums.html"
                      target="_blank" rel="noopener noreferrer">
                      list
                    </a>)
                    </span>,
                tooltip: `Select specific Internet Service Provider (ISP), or
                    Autonomous System Number (ASN)`,
                placeholder: 'ASN code e.g. 42793',
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
            proxy: {
                label: `Super Proxy's location`,
                tooltip: `For shorter latency to the Super Proxy you can
                    choose its location. Please note that this does not
                    restrict the IPs chosen country but will simply improve
                    performances by using Super Proxies which have shorter
                    roundtrips relative to your current location.`,
            },
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
                tooltip: `Number of failed requests (status 403, 429, 502, 503)
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
                tooltip: 'Resolve DNS from IP to url',
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
                placeholder: `i.e. (captcha|robot)`,
                tooltip: `A string(regular expression) to be scanned in the
                    body of the response`,
            },
            min_req_time: {
                label: 'Request time more than',
                placeholder: '500',
                tooltip: `Any request time above the given value in
                    milliseconds will trigger the action`,
            },
            max_req_time: {
                label: 'Request time less than',
                placeholder: '500',
                tooltip: `Any request time below the given value in
                    milliseconds will trigger the action`,
            },
            trigger_url_regex: {
                label: `Optional regex to apply only for specific URLs`,
                placeholder: `i.e. example.com`,
                tooltip: `Enable trigger only for certain URLs. You can type
                    regex manually or generate it by clicking on formats above
                    the input`,
            },
            status_code: {
                label: 'Status code string to be scanned',
                tooltip: `Status code to be scanned in the response headers`,
            },
            status_custom: {
                label: 'Custom status code (regex)',
                placeholder: `i.e. (2..|3..|404)`,
                tooltip: `A string(regular expression) to be scanned in the
                    head of the response`,
            },
            action: {
                label: 'Action type',
                tooltip: `The action to be executed when rule is met`,
            },
            fast_pool_size: {
                label: 'Fast pool size',
                tooltip: `System will store fast IPs up to the selected pool
                    size number. Once pool size is reached, the system will
                    use IPs from the fast IPs pool to route requests`,
            },
            retry_number: {
                label: 'Number of retries',
                tooltip: 'maximum number of retries to execute',
                placeholder: `e.g. '5'`,
            },
            retry_port: {
                label: 'Retry using a different port',
                tooltip: 'Make additional request using a different port',
            },
            switch_port: {
                label: 'Switch port that will be used to make the request',
                tooltip: `By using this action you can split your traffic
                    between ports`,
            },
            ban_ip_duration: {
                label: 'Ban IP for',
                tooltip: `Ban the IP for a defined amount of time. Choose 0 to
                    ban pernamentaly`,
            },
            ban_ip_custom: {label: 'Custom duration'},
            process: {label: 'Processing rule'},
            send_email: {
                label: 'Send email',
                tooltip: `Every time the rule is triggered and executed the
                    email notification will be sent to the provided address`,
            },
            email: {
                label: 'Email address',
                tooltip: `Notifications will be sent to this email address.
                    If you want to use another email you can add it to the
                    list in control panel by going to the link below`,
            },
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
                    To view the pool of your IPs take a look at 'pool size'
                    option`,
                placeholder: 'insert IP value from your pool',
            },
            vip: {
                label: 'gIP',
                tooltip: `Choose specific gIP to ensure all requests are
                    executed using specific gIP. To view the pool of your gIPs
                    take a look at 'pool size' option`,
                placeholder: 'insert gIP id',
            },
            pool_type: {
                label: 'Pool type',
                tooltip: `How to pull the IPs - roundrobin / sequential`,
                ext: true,
            },
            keep_alive: {
                label: 'Keep-alive',
                tooltip: `LPM will ping an IP to keep the session alive`,
                ext: true,
            },
            session_random: {
                label: 'Random session',
                tooltip: `Each session is generated randomly. Disable it if you
                    want to define sessions manually`,
                ext: true,
            },
            session: {
                label: 'Explicit session',
                tooltip: `Insert session ID to maintain the same ip for as long
                    as possible.`,
                placeholder: `e.g. session-1234`,
            },
            sticky_ip: {
                label: 'Sticky IP',
                tooltip: `When connecting to remote LPM server stick sessions
                    to each computer. Each connected computer will receive
                    a unique session`,
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
                label: 'Session duration',
                tooltip: `Change session every fixed number of seconds`,
                ext: true,
            },
            seed: {
                label: 'Session ID seed',
                tooltip: `A string that will be used to maintain unified
                    session structure. Each new session will be attached with
                    a serial number starting from 1. (e.g. session seed 'test'
                    will have the following sessions: test-1, test-2 ..)`,
                placeholder: `e.g. test_session`,
            }
        },
    },
    headers: {
        label: 'Headers',
        tooltip: `Set default headers that are sent with each request from this
            proxy port`,
        fields: {
            user_agent: {
                label: 'User-Agent',
                tooltip: `Choose a User-Agent header that will be used for
                    sending requests`,
            },
            random_user_agent: {
                label: 'Random User-Agent',
                tooltip: 'Set a random User-Agent header for each request',
            },
            override_headers: {
                label: 'Override headers',
                tooltip: `If you use a browser or other software then requests
                    may already have defined a few headers for you. Enabling
                    this option will allow for overriding those headers`,
            },
        },
    },
    general: {
        label: 'General',
        tooltip: `General configuration such as port number, password and
            bypasing`,
        fields: {
            internal_name: {
                label: 'Internal name',
                tooltip: `You can choose a name for this proxy port. If the
                    name is passed it will be shown in the dropdowns across
                    whole LPM. It doesn't change any behavior of the proxy
                    port`,
                ext: true,
            },
            port: {
                label: 'Proxy port',
                tooltip: `The port number that will be used for the current
                    proxy configuration`,
                ext: true,
            },
            socks: {
                label: 'SOCKS 5 port',
                tooltip: `SOCKS 5 port is the same as proxy port and is
                    automatically created.`,
                ext: true,
            },
            password: {
                label: 'Zone password',
                tooltip: `Zone password as it appears in your zones page in
                    your Luminati's control panel http://luminati.io/cp/zones`,
            },
            whitelist_ips: {
                label: 'Whitelist IP access',
                tooltip: `Grant proxy access to specific IPs. Only those
                    IPs will be able to send requests to this proxy port.
                    Setting this field will override the 'General settings'|
                    'Proxy whitelisted IPs' for this port.`,
                placeholder: `e.g. 1.1.1.1,23.23.23.23`,
                ext: true,
            },
            ssl: {
                label: 'Enable SSL logs',
                tooltip: `Enable SSL Logs in order to save HTTPs requests`,
                ext: true,
            },
            route_err: {
                label: 'Route',
                tooltip: `<div><b>pass_dyn:</b> If request can't pass via `
                    +`peer, auto pass via super proxy<br><b>block</b> If `
                    +`request can't pass via peer, block request and don't `
                    +`auto send via super proxy</div>`,
            },
            multiply: {
                label: 'Multiply proxy port',
                tooltip: `Create multiple identical proxy ports`,
                ext: true,
            },
            multiply_ips: {
                label: 'Multiply proxy port per IP',
                tooltip: `Create proxy port for every selected IP from the
                    pool`,
            },
            multiply_vips: {
                label: 'Multiply proxy port per gIP',
                tooltip: `Create proxy port for every selected gIP from pool
                    of available gIPS in your zone`,
            },
            secure_proxy: {
                label: 'SSL to super proxy',
                tooltip: `Encrypt requests sent to super proxy to avoid
                    detection on DNS`,
                ext: true,
            },
            iface: {
                label: 'Interface',
                tooltip: 'Define a specific network interface on which '
                    +'the local machine is running',
                ext: true,
            },
            log: {
                label: 'Log level',
                tooltip: `Level of the logs in the console. Decide how much
                    debug information you want to see.`,
                ext: true,
            },
            debug: {
                label: 'Luminati request debug info',
                tooltip: `Attach additional headers in the response of each
                    request with debug info such as Peer IP or timeline of the
                    request. You can resign from it to save bandwidth (very
                    little) or if the additional headers are breaking your
                    operations`,
            },
        },
    },
};

export const all_fields = Object.keys(tabs)
    .map(k=>tabs[k].fields)
    .reduce((acc, el)=>({...acc, ...el}), {});
