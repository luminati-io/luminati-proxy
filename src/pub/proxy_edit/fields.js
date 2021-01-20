// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import {T} from '../common/i18n.js';

export const tabs = {
    logs: {
        fields: {},
        label: 'Logs',
        tooltip: 'Request logs of requests sent through this proxy port',
    },
    target: {
        label: 'Targeting',
        tooltip: 'Select specific targeting for your proxy exit node',
        fields: {
            country: {
                label: 'Country',
                tooltip: 'Choose your exit country for your requests',
                placeholder: 'Type in country name',
            },
            state: {
                label: 'State',
                tooltip: 'Specific state in a given country',
                placeholder: 'Type in state name',
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
                      <T>list</T>
                    </a>)
                    </span>,
                tooltip: `Select specific Internet Service Provider (ISP), or
                    Autonomous System Number (ASN)`,
                placeholder: 'ASN code e.g. 42793',
            },
            carrier: {
                label: 'Carrier',
                tooltip: 'Network provider company name',
                placeholder: 'Type in carrier name',
            },
            os: {
                label: 'Operating System',
                tooltip: 'Operating System',
            },

        },
    },
    rules: {
        label: 'Rules',
        tooltip: 'Define custom action for specific rule',
        fields: {
            trigger_type: {
                label: 'Trigger',
                tooltip: `In every request, the response will be analyzed. if
                    the configured Trigger rule is true, then the Action will
                    be executed automatically`,
            },
            body_regex: {
                label: 'String to be scanned in body (Regex)',
                placeholder: `i.e. (captcha|robot)`,
                tooltip: `A string (or a regular expression) to be scanned in
                    the body of the response. You can type any kind of regex
                    manually or generate it by choosing from the offered
                    formats above the input`,
            },
            min_req_time: {
                label: 'Request time more than',
                placeholder: '500',
                tooltip: `Any request time above the given value (in
                    milliseconds) will trigger the action`,
            },
            max_req_time: {
                label: 'Request time less than',
                placeholder: '500',
                tooltip: `Any request time below the given value (in
                    milliseconds) will trigger the action`,
            },
            trigger_url_regex: {
                label: `Optional regex to apply only for specific URLs`,
                placeholder: `i.e. example.com`,
                tooltip: `Enable trigger only for certain URLs. You can type
                    regex manually or generate it by choosing from the offered
                    formats above the input.`,
            },
            status: {
                label: `Status code (string or regexp)`,
                tooltip: `Status code to be scanned in the response headers`,
            },
            action: {
                label: 'Action',
                tooltip: `The action to be executed when the rule's condition
                    is met`,
            },
            retry_number: {
                label: 'Retries',
                tooltip: 'Maximum number of retries to execute',
                placeholder: `e.g. '5'`,
            },
            retry_port: {
                label: 'Retry using a different port',
                tooltip: 'Make additional request using a different port',
            },
            switch_port: {
                label: 'Switch port that will be used to make the request',
                tooltip: `Using this action you can split your traffic
                    between ports`,
            },
            ban_ip_duration: {
                label: 'Ban IP for',
                tooltip: `Ban the IP for a defined amount of time. Choose 0 to
                    ban forever`,
            },
            cache_duration: {
                label: 'Cache duration',
                tooltip: 'Cache the response for a defined amount of time',
            },
            type: {
                label: 'Schedule',
                tooltip: `The timing for the execution of the triggered
                    function. You can try to activate the rule before sending
                    the request for a specific URL, after receiving headers
                    (to check status code for example), after body (to check
                    the whole response), or after a specified amount of
                    time (to timeout the request and retry).`,
            },
            process: {label: 'Processing rule'},
            request_url: {label: 'URL'},
            request_method: {label: 'Method'},
            request_payload: {label: 'Payload', tooltip: `Payload sent in the
                request. The IP used for the request will be sent in a field
                if its value equals "$IP"`},
        },
    },
    rotation: {
        label: 'IP control',
        tooltip: 'Set the conditions for which your IPs will change',
        fields: {
            pool_size: {
                label: 'Pool size',
                tooltip: `A pool of sessions that is used for the requests.
                    Each session is associated with an IP. For non-static zones
                    the sessions are pinged every 45 seconds to keep them
                    alive`,
                ext: true,
            },
            session: {
                label: 'Explicit session',
                tooltip: `Insert a session ID. You cannot use dash "-"
                    character`,
                placeholder: `e.g. test_session`,
            },
            sticky_ip: {
                label: 'Session per machine',
                tooltip: `Keep separate sessions / IPs for each connecting
                    device from an external network. Useful when the LPM is
                    hosted on a server and multiple machines send requests`,
                ext: true,
            },
            rotate_session: {
                label: 'Rotate IPs',
                tooltip: 'Change session/IP on each request',
                ext: true,
            },
            session_termination: {
                label: 'Session termination',
                tooltip: `Stop sending new requests when the peer IP becomes
                    unavailable and redirect to confirmation page before new IP
                    is taken`,
            },
            proxy_country: {
                label: `Super Proxy location`,
                tooltip: `Location of Super Proxy is chosen automatically.
                    Sometimes choosing Chinese Super Proxy works better when
                    also using Chinese peers`,
            },
            throttle: {
                label: 'Throttle requests',
                tooltip: `Throttle requests above the given number.
                    Allow a maximal number of parallel requests.`,
                ext: true,
            },
            dns: {
                label: 'DNS lookup',
                tooltip: 'Location of DNS resolve',
            },
            reverse_lookup: {
                label: 'Reverse DNS lookup',
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
    browser: {
        label: 'Browser',
        tooltip: 'Configure settings for the browser launched by LPM',
        fields: {
            ua: {
                label: 'Unblocker Mobile UA',
                tooltip: `Let Unblocker set a random User-Agent from a mobile
                    browser automatically`,
            },
            timezone: {
                label: 'Timezone',
                tooltip: 'Select a timezone to be used by the browser',
            },
            resolution: {
                label: 'Resolution',
                tooltip: 'Window resolution to be used by the browser',
            },
            webrtc: {
                label: 'WebRTC',
                tooltip: `Select between disabling WebRTC APIs in the browser
                    and prevent a potential IP leakage, and keeping it enabled`
            },
        },
    },
    general: {
        label: 'General',
        tooltip: `General configuration such as 'port number'`,
        fields: {
            internal_name: {
                label: 'Internal name',
                tooltip: `You can choose a name for this proxy port.
                    If the name is passed it will be shown in the dropdowns
                    across whole LPM. It doesn't change any behavior of the
                    proxy port`,
                ext: true,
            },
            port: {
                label: 'Proxy port',
                tooltip: `The port number that will be used for the current
                    proxy configuration`,
                ext: true,
            },
            ssl: {
                label: 'SSL analyzing',
                tooltip: `Enable SSL request logs in order to save HTTPs
                    requests`,
                ext: true,
            },
            proxy_connection_type: {
                label: 'Connection to Super Proxy',
                tooltip: 'Connection type between LPM and Super Proxy',
            },
            route_err: {
                label: 'Route',
                tooltip: `<div><b>pass_dyn:</b> If a request can't pass via `
                    +`peer, automatically pass it via the Super Proxy`
                    +`<br><b>block</b> If a `
                    +`request can't pass via peer, block it and don't `
                    +`send via Super Proxy</div>`,
            },
            multiply: {
                label: 'Multiply proxy port',
                tooltip: `Create multiple identical proxy ports`,
                ext: true,
            },
            multiply_ips: {
                label: 'Multiply proxy port per IP',
                tooltip: `Create a proxy port for every selected IP from the
                    pool`,
            },
            multiply_vips: {
                label: 'Multiply proxy port per gIP',
                tooltip: `Create a proxy port for every selected gIP from pool
                    of available gIPs in your zone`,
            },
            multiply_users: {
                label: 'Multiply proxy port per user',
                tooltip: `Create a proxy port for every selected LPM user
                    configured in control panel`,
            },
            iface: {
                label: 'Interface',
                tooltip: 'Define a specific network interface on which '
                    +'the local machine is running',
                ext: true,
            },
            smtp: {
                label: 'Proxy through SMTP',
                tooltip: `IPs that will be randomly chosen to proxy whole
                    traffic through SMTP protocol`,
            },
            whitelist_ips: {
                label: 'Whitelisted IPs',
                tooltip: `Default access grant for this port. Only these
                    IPs will be able to send requests to this port by default`
            },
            debug: {
                label: 'Request details',
                tooltip: `Luminati request details like response timeline or
                    peer IP that was used to send a final request`,
            },
        },
    },
};

Object.keys(tabs).forEach(t=>{
    const format = s=>s.replace(/\s+/g, ' ').replace(/\n/g, ' ');
    const tab = tabs[t];
    tab.tooltip = format(tab.tooltip);
    for (let f in tab.fields)
        tab.fields[f].tooltip = format(tab.fields[f].tooltip||'');
});

export const all_fields = Object.keys(tabs)
    .map(k=>tabs[k].fields)
    .reduce((acc, el)=>({...acc, ...el}), {});
