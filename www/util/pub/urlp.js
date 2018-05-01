// LICENSE_CODE ZON
'use strict'; /*jslint node:true, browser:true, es6:true*/
(function(){
var define;
var is_node = typeof module=='object' && module.exports;
if (!is_node)
    define = self.define;
else
    define = require('../../../util/require_node.js').define(module, '../');
define(['/util/url.js'], function(zurl){
var E = {};

class Urlp {
    constructor(){
        this.update();
    }
    update(){
        this.url = window.location.href;
        Object.assign(this, zurl.parse(this.url));
        this.qs = zurl.qs_parse(this.query||'');
        this.hs = zurl.qs_parse((this.hash||'').substr(1));
    }
}

E.Urlp = Urlp;

return E; }); }());

