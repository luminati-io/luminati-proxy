// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true*/
require('./config.js');
const string = require('./string.js');
const {qw} = string;
const HTTPParser = process.binding('http_parser').HTTPParser;
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

// default header values
// XXX josh: upgrade-insecure-requests might not be needed on 2nd request
// onwards
E.browser_defaults = function(browser, opt){
    opt = opt||{};
    let defs = {
        chrome: {
            connection: 'keep-alive',
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
            'upgrade-insecure-requests': '1',
            'accept-encoding': 'gzip, deflate',
            'accept-language': 'en-US,en;q=0.9',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.131 Safari/537.36',
        },
        chrome_https: {
            'accept-encoding': 'gzip, deflate, br',
        },
        chrome_sec_fetch: {
            'sec-fetch-mode': 'navigate',
            'sec-fetch-user': '?1',
            'sec-fetch-site': 'none',
        },
        firefox: {
            connection: 'keep-alive',
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'upgrade-insecure-requests': '1',
            'accept-encoding': 'gzip, deflate, br',
            'accept-language': 'en-US,en;q=0.5',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:67.0) Gecko/20100101 Firefox/67.0',
        },
        edge: {
            connection: 'keep-alive',
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'upgrade-insecure-requests': '1',
            'accept-encoding': 'gzip, deflate, br',
            'accept-language': 'en-US',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36 Edge/18.17763',
        },
        safari: {
            connection: 'keep-alive',
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'upgrade-insecure-requests': '1',
            'accept-encoding': 'br, gzip, deflate',
            'accept-language': 'en-us',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0.3 Safari/605.1.15',
        },
    };
    let result = defs[browser];
    if (!result)
    {
        result = defs.chrome;
        browser = 'chrome';
    }
    if (browser=='chrome' && opt.https)
    {
        result = assign(result, defs.chrome_https,
            opt.major>75 ? defs.chrome_sec_fetch : {});
    }
    return result;
};

E.browser_accept = function(browser, type){
    let defs = {
        document: {
            chrome: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
            firefox: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            edge: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            safari: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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
    return kind[browser]||kind.chrome;
};

E.browser_default_header_order = function(browser){
    let headers = {
        chrome: qw`host connection pragma cache-control
            upgrade-insecure-requests user-agent sec-fetch-mode sec-fetch-user
            accept sec-fetch-site referer accept-encoding accept-language
            cookie`,
        firefox: qw`host user-agent accept accept-language accept-encoding
            referer connection cookie upgrade-insecure-requests cache-control`,
        edge: qw`referer cache-control accept accept-language
            upgrade-insecure-requests user-agent accept-encoding host
            connection`,
        safari: qw`host cookie connection upgrade-insecure-requests accept
            user-agent referer accept-language accept-encoding`,
    };
    return headers[browser]||headers.chrome;
};

E.like_browser_case_and_order = function(headers, browser){
    let ordered_headers = {};
    let source_header_keys = Object.keys(headers);
    let header_keys = E.browser_default_header_order(browser);
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

E.browser_default_header_order_http2 = function(browser){
    let headers = {
        chrome: qw`:method :authority :scheme :path pragma cache-control
            upgrade-insecure-requests user-agent sec-fetch-mode sec-fetch-user
            accept sec-fetch-site referer accept-encoding accept-language
            cookie`,
        firefox: qw`:method :path :authority :scheme user-agent accept
            accept-language accept-encoding referer cookie
            upgrade-insecure-requests cache-control te`,
        edge: qw`:method :path :authority :scheme referer cache-control
            accept accept-language upgrade-insecure-requests user-agent
            accept-encoding cookie`,
        safari: qw`:method :scheme :path :authority cookie accept
            accept-encoding user-agent accept-language referer`,
    };
    return headers[browser]||headers.chrome;
};

// reverse pseudo headers (e.g. :method) because nodejs reverse it
// before send to server
// https://github.com/nodejs/node/blob/v12.x/lib/internal/http2/util.js#L473
function reverse_http2_pseudo_headers_order(headers){
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
}

E.like_browser_case_and_order_http2 = function(headers, browser){
    let ordered_headers = {};
    let header_keys = E.browser_default_header_order_http2(browser);
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
    return reverse_http2_pseudo_headers_order(ordered_headers);
};

let parser = new HTTPParser(HTTPParser.REQUEST), parser_usages = 0;
E.parse_request = buffer=>{
    let ret;
    parser[HTTPParser.kOnHeadersComplete] =
        (version_major, version_minor, raw_headers, method, url, status_code,
        status_message, upgrade, should_keep_alive)=>
        ret = {version_major, version_minor, raw_headers, method, url,
            upgrade, should_keep_alive};
    parser.reinitialize(HTTPParser.REQUEST, !!parser_usages);
    parser_usages++;
    let exec_res = parser.execute(buffer);
    if (exec_res instanceof Error)
        throw exec_res;
    if (!ret)
        return;
    // ugly, not 100% accurate, but fast!
    ret.headers = {};
    for (let i=0; i<ret.raw_headers.length; i+=2)
        ret.headers[ret.raw_headers[i].toLowerCase()] = ret.raw_headers[i+1];
    return ret;
};
