// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true*/
require('./config.js');
const _ = require('lodash');
const string = require('./string.js'), {qw} = string;
const E = exports, assign = Object.assign;

const special_case_words = {
    te: 'TE',
    etag: 'ETag',
};

E.capitalize = function(headers){
    let res = {};
    for (let header in headers)
    {
        let new_header = header.toLowerCase().split('-').map(word=>{
            return special_case_words[word] ||
                (word.length ? word[0].toUpperCase()+word.substr(1) : '');
        }).join('-');
        res[new_header] = headers[header];
    }
    return res;
};

// original_raw should be the untransformed value of rawHeaders from the
// Node.js HTTP request or response
E.restore_case = function(headers, original_raw){
    if (!original_raw)
        return headers;
    const names = {};
    for (let i = 0; i<original_raw.length; i += 2)
    {
        const name = original_raw[i];
        names[name.toLowerCase()] = [name];
    }
    for (let orig_name in headers)
    {
        const name = orig_name.toLowerCase();
        if (names[name])
            names[name].push(orig_name);
        else
            names[name] = [orig_name];
    }
    const res = {};
    for (let name in names)
    {
        const value = names[name].map(n=>headers[n]).filter(v=>v)[0];
        if (value!==undefined)
            res[names[name][0]] = value;
    }
    return res;
};


const rules_headers = [
    {match: {browser: 'chrome'},
        rules: {
            connection: 'keep-alive',
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
            'upgrade-insecure-requests': '1',
            'accept-encoding': 'gzip, deflate',
            'accept-language': 'en-US,en;q=0.9',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.131 Safari/537.36',
        }},
    {match: {browser: 'chrome', https: true},
        rules: {
            'accept-encoding': 'gzip, deflate, br',
        }},
    {match: {browser: 'chrome', https: true, version_min: 76},
        rules: {
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-user': '?1',
            'sec-fetch-site': 'none',
        }},
    {match: {browser: 'chrome', version_min: 79},
        rules: {
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        }},
    {match: {browser: 'mobile_chrome'},
        rules: {
            'user-agent': 'Mozilla/5.0 (Linux; Android 9; MBOX) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.110 Safari/537.36',
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
            'accept-encoding': 'gzip, deflate, br',
            'accept-language': 'en-US,en;q=0.9',
        }},
    {match: {browser: 'mobile_chrome', https: true, version_min: 76},
        rules: {
            'sec-fetch-mode': 'navigate',
            'sec-fetch-user': '?1',
            'sec-fetch-site': 'none',
        }},
    {match: {browser: 'mobile_chrome', version_min: 79},
        rules: {
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        }},
    {match: {browser: 'firefox'},
        rules: {
            connection: 'keep-alive',
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'upgrade-insecure-requests': '1',
            'accept-encoding': 'gzip, deflate',
            'accept-language': 'en-US,en;q=0.5',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:67.0) Gecko/20100101 Firefox/67.0',
        }},
    {match: {browser: 'firefox', https: true},
        rules: {
            'accept-encoding': 'gzip, deflate, br',
            te: 'trailers',
        }},
    {match: {browser: 'edge'},
        rules: {
            connection: 'keep-alive',
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'upgrade-insecure-requests': '1',
            'accept-encoding': 'gzip, deflate, br',
            'accept-language': 'en-US',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36 Edge/18.17763',
        }},
    {match: {browser: 'safari'},
        rules: {
            connection: 'keep-alive',
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'upgrade-insecure-requests': '1',
            'accept-encoding': 'gzip, deflate',
            'accept-language': 'en-us',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0.3 Safari/605.1.15',
        }},
    {match: {browser: 'firefox', https: true},
        rules: {
            'accept-encoding': 'br, gzip, deflate',
        }},
    {match: {browser: 'firefox', https: true, version_min: 13},
        rules: {
            'accept-encoding': 'gzip, deflate, br',
        }},
    {match: {browser: 'mobile_safari'},
        rules: {
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'accept-encoding': 'gzip, deflate, br',
            'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_1_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.1 Mobile/15E148 Safari/604.1',
            'accept-language': 'en-us',
            referer: '',
        }},
];

// default header values
// XXX josh: upgrade-insecure-requests might not be needed on 2nd request
// onwards
E.browser_defaults = function(browser, opt){
    opt = assign({}, opt);
    if (!is_browser_supported(browser))
        browser = 'chrome';
    return select_rules(rules_headers, {
        browser: browser,
        version: opt.major,
        https: opt.https,
    });
};

E.browser_accept = function(browser, type, opt={}){
    let defs = {
        document: {
            chrome: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
            chrome_79: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
            mobile_chrome: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
            mobile_chrome_79: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
            firefox: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            edge: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            safari: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            mobile_safari: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        image: {
            chrome: 'image/webp,image/apng,image/*,*/*;q=0.8',
            firefox: 'image/webp,*/*',
            safari: '*/*',
        },
        video: {
            chrome: '*/*',
            firefox: 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
        },
        audio: {
            chrome: '*/*',
            firefox: 'audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,application/ogg;q=0.7,video/*;q=0.6,*/*;q=0.5',
            safari: '*/*',
        },
        script: {
            chrome: '*/*',
            firefox: '*/*',
            safari: '*/*',
        },
        css: {
            chrome: 'text/css,*/*;q=0.1',
            firefox: 'text/css,*/*;q=0.1',
            safari: 'text/css,*/*;q=0.1',
        },
    };
    let kind = defs[type]||defs.document;
    let browser_re = new RegExp(`^${browser}_(\\d+)$`);
    let versions = Object.keys(kind).filter(k=>browser_re.test(k))
        .map(k=>+k.match(browser_re)[1]).sort((a, b)=>b - a);
    let version = versions.find(v=>opt.major >= v);
    let v_key = `${browser}_${version}`;
    return kind[v_key]||kind[browser]||kind.chrome;
};

const rules_orders = [
    // http1 rules
    {match: {browser: 'chrome'},
        rules: {order: qw`host connection pragma cache-control
            upgrade-insecure-requests user-agent sec-fetch-mode sec-fetch-user
            accept sec-fetch-site referer accept-encoding accept-language
            cookie`}},
    {match: {browser: 'chrome', type: 'xhr'},
        rules: {order: qw`host connection pragma cache-control accept
            x-requested-with user-agent sec-fetch-mode content-type
            sec-fetch-site referer accept-encoding accept-language cookie`}},
    {match: {browser: 'chrome', version_min: 78},
        rules: {order: qw`host connection pragma cache-control origin
            upgrade-insecure-requests user-agent sec-fetch-user accept
            sec-fetch-site sec-fetch-mode referer accept-encoding
            accept-language cookie`}},
    {match: {browser: 'chrome', version_min: 78, type: 'xhr'},
        rules: {order: qw`host connection pragma cache-control accept
            x-requested-with user-agent content-type sec-fetch-site
            sec-fetch-mode referer accept-encoding accept-language cookie`}},
    {match: {browser: 'mobile_chrome'},
        rules: {order: qw`host connection pragma cache-control
            upgrade-insecure-requests user-agent sec-fetch-mode sec-fetch-user
            accept sec-fetch-site referer accept-encoding accept-language
            cookie`}},
    {match: {browser: 'mobile_chrome', version_min: 78},
        rules: {order: qw`host connection pragma cache-control
            upgrade-insecure-requests user-agent sec-fetch-user
            accept sec-fetch-site sec-fetch-mode referer accept-encoding
            accept-language cookie`}},
    {match: {browser: 'firefox'},
        rules: {order: qw`host user-agent accept accept-language
            accept-encoding referer connection cookie
            upgrade-insecure-requests cache-control`}},
    {match: {browser: 'edge'},
        rules: {order: qw`referer cache-control accept accept-language
            upgrade-insecure-requests user-agent accept-encoding host
            connection`}},
    {match: {browser: 'safari'},
        rules: {order: qw`host cookie connection upgrade-insecure-requests
            accept user-agent referer accept-language accept-encoding`}},
    {match: {browser: 'mobile_safari'},
        rules: {order: qw`host connection accept user-agent accept-language
            referer accept-encoding`}},
    // http2 rules
    {match: {browser: 'chrome', http2: true},
        rules: {order: qw`:method :authority :scheme :path pragma
            cache-control upgrade-insecure-requests user-agent sec-fetch-mode
            sec-fetch-user accept sec-fetch-site referer accept-encoding
            accept-language cookie`}},
    {match: {browser: 'chrome', http2: true, type: 'xhr'},
        rules: {order: qw`:method :authority :scheme :path pragma cache-control
            accept x-requested-with user-agent sec-fetch-mode content-type
            sec-fetch-site referer accept-encoding accept-language cookie`}},
    {match: {browser: 'chrome', http2: true, version_min: 78},
        rules: {order: qw`:method :authority :scheme :path pragma cache-control
            origin upgrade-insecure-requests user-agent sec-fetch-user accept
            sec-fetch-site sec-fetch-mode referer accept-encoding
            accept-language cookie`}},
    {match: {browser: 'chrome', http2: true, version_min: 80},
        rules: {order: qw`:method :authority :scheme :path pragma cache-control
            origin upgrade-insecure-requests user-agent sec-fetch-dest accept
            sec-fetch-site sec-fetch-mode sec-fetch-user referer
            accept-encoding accept-language cookie`}},
    {match: {browser: '', http2: true, version_min: 78, type: 'xhr'},
        rules: {order: qw`:method :authority :scheme :path pragma
            cache-control accept x-requested-with user-agent content-type
            sec-fetch-site sec-fetch-mode referer accept-encoding
            accept-language cookie`}},
    {match: {browser: 'mobile_chrome', http2: true},
        rules: {order: qw`:method :authority :scheme :path pragma cache-control
            upgrade-insecure-requests user-agent sec-fetch-mode sec-fetch-user
            accept sec-fetch-site referer accept-encoding
            accept-language cookie`}},
    {match: {browser: 'mobile_chrome', http2: true, version_min: 78},
        rules: {order: qw`:method :authority :scheme :path pragma
            cache-control upgrade-insecure-requests user-agent sec-fetch-user
            accept sec-fetch-site sec-fetch-mode referer accept-encoding
            accept-language cookie`}},
    {match: {browser: 'firefox', http2: true},
        rules: {order: qw`:method :path :authority :scheme user-agent accept
            accept-language accept-encoding referer cookie
            upgrade-insecure-requests cache-control te`}},
    {match: {browser: 'edge', http2: true},
        rules: {order: qw`:method :path :authority :scheme referer
            cache-control accept accept-language upgrade-insecure-requests
            user-agent accept-encoding cookie`}},
    {match: {browser: 'safari', http2: true},
        rules: {order: qw`:method :scheme :path :authority cookie accept
            accept-encoding user-agent accept-language referer`}},
    {match: {browser: 'safari', http2: true, version_min: 13},
        rules: {order: qw`:method :scheme :path :authority cookie user-agent
            accept accept-language accept-encoding referer`}},
    {match: {browser: 'mobile_safari', http2: true},
        rules: {order: qw`:method :scheme :path :authority cookie accept
            accept-encoding user-agent accept-language referer`}},
];

function is_browser_supported(browser){
    return qw`chrome firefox edge safari mobile_chrome mobile_safari`
        .includes(browser);
}

E.browser_default_header_order = function(browser, opt){
    opt = assign({}, opt);
    if (!is_browser_supported(browser))
        browser = 'chrome';
    return select_rules(rules_orders, {
        browser: browser,
        version: opt.major,
        type: opt.req_type,
    }).order;
};

E.like_browser_case_and_order = function(headers, browser, opt){
    let ordered_headers = {};
    let source_header_keys = Object.keys(headers);
    if (source_header_keys.find(h=>h.toLowerCase()=='x-requested-with'))
        opt = assign({req_type: 'xhr'}, opt);
    let header_keys = E.browser_default_header_order(browser, opt);
    for (let header of header_keys)
    {
        let value = headers[source_header_keys
            .find(h=>h.toLowerCase()==header)];
        if (value)
            ordered_headers[header] = value;
    }
    for (let header in headers)
    {
        if (!header_keys.includes(header))
            ordered_headers[header] = headers[header];
    }
    return E.capitalize(ordered_headers);
};

E.browser_default_header_order_http2 = function(browser, opt){
    opt = assign({}, opt);
    if (!is_browser_supported(browser))
        browser = 'chrome';
    return select_rules(rules_orders, {
        browser: browser,
        version: opt.major,
        type: opt.req_type,
        http2: true,
    }).order;
};

// reverse pseudo headers (e.g. :method) because nodejs reverse it
// before send to server
// https://github.com/nodejs/node/blob/v12.x/lib/internal/http2/util.js#L473
E.reverse_http2_pseudo_headers_order = headers=>{
  let pseudo = {};
  let other = Object.keys(headers).reduce((r, h)=>{
      if (h[0]==':')
          pseudo[h] = headers[h];
      else
          r[h] = headers[h];
      return r;
  }, {});
  pseudo = Object.keys(pseudo).reverse()
      .reduce((r, h)=>{ r[h] = pseudo[h]; return r; }, {});
  return Object.assign(pseudo, other);
};

E.like_browser_case_and_order_http2 = function(headers, browser, opt){
    let ordered_headers = {};
    if (Object.keys(headers).find(h=>h.toLowerCase()=='x-requested-with'))
        opt = assign({req_type: 'xhr'}, opt);
    let header_keys = E.browser_default_header_order_http2(browser, opt);
    let req_headers = {};
    for (let h in headers)
        req_headers[h.toLowerCase()] = headers[h];
    for (let h of header_keys)
    {
        if (req_headers[h])
            ordered_headers[h] = req_headers[h];
    }
    for (let h in req_headers)
    {
        if (!header_keys.includes(h))
           ordered_headers[h] = req_headers[h];
    }
    return E.reverse_http2_pseudo_headers_order(ordered_headers);
};

E.to_raw_headers = function(headers){
    let raw_headers = [];
    for (let name in headers)
    {
        if (Array.isArray(headers[name]))
        {
            for (let value of headers[name])
                raw_headers.push(name, value);
        }
        else
            raw_headers.push(name, headers[name]);
    }
    return raw_headers;
};

function select_rules(all_rules, selector){
    let matches = all_rules.filter(x=>matches_rule(x.match, selector));
    return _.merge({}, ...matches.map(x=>x.rules), (dest, src)=>{
        if (Array.isArray(src))
            return src;
    });
}

function matches_rule(rule, data){
    for (let k in rule)
    {
        if (k=='version_min')
        {
            if ((rule[k]||0)>(data.version||0))
                return false;
        }
        else if (rule[k]!=data[k])
            return false;
    }
    return true;
}

E.t = {rules_orders, select_rules};
