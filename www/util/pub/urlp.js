// LICENSE_CODE ZON
'use strict'; /*jslint node:true, browser:true, es6:true*/
(function(){
var define;
var is_node = typeof module=='object' && module.exports;
if (!is_node)
    define = self.define;
else
    define = require('../../../util/require_node.js').define(module, '../');
define(['/util/url.js', '/util/escape.js'], function(zurl, zescape){
var E = {};

class Urlp {
    constructor(opt){
        this.update(opt);
    }
    update(opt){
        if (!opt || typeof opt=='string')
            opt = {url: opt};
        this.url = opt.url||window&&window.location.href;
        Object.assign(this, zurl.parse(this.url));
        let qs = zurl.qs_parse(this.query||'');
        let hs = zurl.qs_parse((this.hash||'').substr(1));
        if (!opt.validate)
            return void Object.assign(this, {qs, hs});
        this.qs = {};
        this.hs = {};
        for (let p in opt.validate.qs||opt.validate)
            this.qs[p] = validate(qs[p], opt.validate[p]);
        for (let p in opt.validate.hs||{})
            this.hs[p] = validate(hs[p], opt.validate[p]);
    }
    uri(){
        return zescape.uri(this.pathname, this.qs, this.hs);
    }
}

E.Urlp = Urlp;

let validate = (param, type)=>{
    if (type=='email' && zurl.is_valid_email(param||''))
        return param;
    if (type=='number' && !isNaN(+param))
        return +param;
    if (type=='token' && typeof param == 'string' && !param.includes(' '))
        return param;
    if (type=='bool' && (!param || param == 1))
        return !!param;
};

return E; }); }());

