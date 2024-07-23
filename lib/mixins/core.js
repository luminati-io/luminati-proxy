#!/usr/bin/env node
// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, esnext:true, es9: true*/
const _ = require('lodash4');
const {assign, keys} = Object;

const MIXIN_BP = {prototype: {}, static: {}};

class Mixin_core {
    constructor(){
        this.mixins = new Map();
    }
    get as_array(){
        return Array.from(this.mixins.keys());
    }
    pick(labels=[]){
        return labels.map(label=>this.mixins.get(label));
    }
    new_mixin(label){
        if (!label)
            return;
        this.mixins.set(label, assign({label}, _.cloneDeep(MIXIN_BP)));
        return this.mixins.get(label);
    }
    assign(target_class, ...req){
        let pick = req.length ? this.pick(req) : this.as_array;
        pick.forEach(mixin=>{
            keys(mixin.static).forEach(f=>target_class[f] = mixin.static[f]);
            assign(target_class.prototype, mixin.prototype);
        });
    }
    flush(){
        this.mixins.clear();
    }
}

module.exports = new Mixin_core();
