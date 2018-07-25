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
    constructor(url){
        this.update(url);
    }
    update(url){
        this.url = url||window&&window.location.href;
        Object.assign(this, zurl.parse(this.url));
        this.qs = zurl.qs_parse(this.query||'');
        this.hs = zurl.qs_parse((this.hash||'').substr(1));
    }
    uri(){
        return zescape.uri(this.pathname, this.qs, this.hs);
    }
}

E.Urlp = Urlp;

return E; }); }());

