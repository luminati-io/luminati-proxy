// LICENSE_CODE ZON
'use strict'; /*jslint node:true, es9:true*/
const _ = require('lodash');
const uuid = require('node-uuid');
const zutil = require('./util.js');
const {assign} = Object;
const ERR_MAIN_KEY_NOT_EXISTS = 1;
const ERR_ALIAS_EXISTS = 2;
const ERR_NOT_ALIAS_MAP = 3;
const E = module.exports;

class Expiry_map_iterator {
    constructor(map_iterator){ this.map_iterator = map_iterator; }
    next(){
        let ret = this.map_iterator.next();
        if (ret.value)
            ret.value[1] = ret.value[1].val;
        return ret;
    }
}

class Expiry_map extends Map {
    constructor(timeout){
        super();
        this.timeout = timeout<=0 ? 0 : timeout;
    }
    set(key, val, timeout){
        let old = super.get(key);
        let rec = {val, expire_ts: old?.expire_ts,
            timeout_id: old?.timeout_id};
        this._touch(key, rec, timeout);
        super.set(key, rec);
        return this;
    }
    touch(key, timeout){
        let rec = super.get(key);
        if (rec)
            this._touch(key, rec, timeout);
        return this;
    }
    _touch(key, rec, timeout){
        timeout = timeout<=0 ? 0 : timeout||this.timeout;
        // setTimeout stores timeout in 32bit signed int. overflow will cause
        // timeout in the next event loop. use best effort instead (24.85 days)
        if (timeout)
            timeout = Math.min(timeout, 0x7fffffff);
        if (rec.timeout_id)
            clearTimeout(rec.timeout_id);
        if (timeout==null)
        {
            rec.expire_ts = null;
            rec.timeout_id = null;
        }
        else
        {
            rec.expire_ts = Date.now()+timeout;
            rec.timeout_id = setTimeout(()=>this._delete(key), timeout);
        }
    }
    delete(key){
        let old = super.get(key);
        if (old)
            clearTimeout(old.timeout_id);
        return this._delete(key);
    }
    _delete(key){ return super.delete(key); }
    clear(){
        super.forEach(rec=>clearTimeout(rec.timeout_id));
        super.clear();
    }
    get(key, opt){
        let rec = super.get(key);
        if (rec && opt?.touch)
            this._touch(key, rec, opt.timeout);
        return rec ? rec.val : undefined;
    }
    ttl(key){
        let rec = super.get(key);
        return rec && rec.expire_ts!=null ?
            Math.max(0, rec.expire_ts-Date.now()) : undefined;
    }
    values(){ return Array.from(super.values()).map(rec=>rec.val).values(); }
    entries(){
        return Array.from(super.entries()).map(p=>[p[0], p[1].val]).values(); }
    [Symbol.iterator](){
        return new Expiry_map_iterator(super[Symbol.iterator]()); }
    // eslint-disable-next-line hola/var-names-unix
    forEach(cb, this_arg=this){
        super.forEach((rec, k)=>cb(rec.val, k, this_arg)); }
}

E.Expiry_map = Expiry_map;

class Notify_expiry_map extends Expiry_map {
    constructor({timeout, on_delete}){
        super(timeout);
        this.on_delete = on_delete||_.noop;
    }
    _delete(key){
        let old = super.get(key);
        if (old)
            this.on_delete(old, key);
        return super._delete(key);
    }
}

E.Notify_expiry_map = Notify_expiry_map;

class Limit_expiry_map extends Expiry_map {
    #keys = new Set();
    constructor(keys=[], timeout){
        super(timeout);
        this.#keys = new Set(keys);
        this.timeout = timeout;
    }
    set keys(keys=[]){
        if (!keys.length)
        {
            this.#keys = new Set();
            this.clear();
            return;
        }
        const old_keys = Array.from(this.#keys);
        if (!_.difference(keys, old_keys).length)
            return;
        const removed_keys = _.difference(old_keys, keys);
        removed_keys.forEach(key=>this.delete(key));
        this.#keys = new Set(keys);
    }
    get keys(){
        return this.#keys;
    }
    get map_keys(){
        return super.keys;
    }
    add_key(key){
        this.#keys.add(key);
    }
    remove_key(key){
        this.#keys.delete(key);
        this.delete(key);
    }
    set(key, value, timeout){
        if (!this.#keys.has(key))
            return;
        super.set(key, value, timeout||this.timeout);
    }
}
E.Limit_expiry_map = Limit_expiry_map;

class Inc_map extends Map {
    constructor(initial){
        super(initial);
    }
    inc(key, val=1){
        this.set(key, (this.get(key)||0)+val);
        return this;
    }
}
E.Inc_map = Inc_map;

class Alias_map_error extends Error {
    constructor(message){
        super('Alias map error: '+message);
        this.message = message;
    }
}

class Alias_map_key {
    #aliases;
    #value;
    #hash = uuid.v4();
    constructor(key, value){
        let initial_keys = key ? Array.isArray(key) ? key : [key] : null;
        this.#aliases = new Set(initial_keys);
        this.#value = value;
    }
    has(key){
        return this.#aliases.has(key);
    }
    set(value){
        this.#value = zutil.clone_deep(value);
    }
    get(){
        return zutil.clone_deep(this.#value);
    }
    get_ref(){
        return this.#value;
    }
    keys(){
        return Array.from(this.#aliases);
    }
    add_aliases(...aliases){
        aliases.forEach(a=>this.#aliases.add(a));
    }
    remove_aliases(...aliases){
        aliases.forEach(a=>this.#aliases.delete(a));
    }
    hash(){
        return this.#hash;
    }
}

class Alias_map {
    #opt;
    #all_aliases = new Map();
    constructor(opt){
        this.#opt = opt || {};
        this.size = 0;
    }
    #handle_error(err_code, payload){
        if (this.#opt.no_throw)
            return this;
        switch (err_code)
        {
        case ERR_MAIN_KEY_NOT_EXISTS:
            throw new Alias_map_error(`Key ${payload} not exists`);
        case ERR_ALIAS_EXISTS:
            throw new Alias_map_error(`Alias ${payload} already exists`);
        case ERR_NOT_ALIAS_MAP:
            throw new Alias_map_error(`Argument expected to be instance of`
            +` 'Alias_map', got '${payload}' instead`);
        default:
            throw new Alias_map_error(err_code||0);
        }
    }
    #set_by_aliases(aliases, value){
        let new_aliases = aliases.filter(a=>!this.has(a)).filter(Boolean);
        if (aliases.length != new_aliases.length && !this.#opt.add_existing)
            return this.#handle_error(ERR_ALIAS_EXISTS, new_aliases.join(''));
        if (!new_aliases.length)
            return this;
        let new_elem = new Alias_map_key(new_aliases, value);
        new_aliases.forEach(alias=>this.#all_aliases.set(alias, new_elem));
        this.size++;
        return this;
    }
    has(key){
        return this.#all_aliases.has(key);
    }
    set(key, value){
        if (!key)
            return this;
        if (Array.isArray(key) && key.length)
            return this.#set_by_aliases(key, value);
        if (this.has(key))
            this.#all_aliases.get(key).set(value);
        else
        {
            this.#all_aliases.set(key, new Alias_map_key(key, value));
            this.size++;
        }
        return this;
    }
    get(key){
        if (!this.has(key))
            return undefined;
        return this.#all_aliases.get(key).get();
    }
    get_ref(key){
        if (!this.has(key))
            return undefined;
        return this.#all_aliases.get(key).get_ref();
    }
    get_aliases_for(key){
        return this.has(key) ? this.#all_aliases.get(key).keys() : [];
    }
    add_aliases(key, ...aliases){
        if (!this.has(key))
            return this.#handle_error(ERR_MAIN_KEY_NOT_EXISTS, key);
        let new_aliases = aliases.filter(a=>!this.has(a)).filter(Boolean);
        if (aliases.length != new_aliases.length && !this.#opt.add_existing)
        {
            return this.#handle_error(ERR_ALIAS_EXISTS,
                aliases.filter(a=>this.has(a)).join(' '));
        }
        this.#all_aliases.get(key).add_aliases(...new_aliases);
        new_aliases.forEach(a=>
            this.#all_aliases.set(a, this.#all_aliases.get(key)));
        return this;
    }
    remove_aliases(...aliases){
        for (let i = 0; i < aliases.length; i++)
        {
            if (!this.has(aliases[i]))
                continue;
            let last = false;
            if (this.#all_aliases.get(aliases[i]).keys().length <= 1)
                last = true;
            this.#all_aliases.get(aliases[i]).remove_aliases(aliases[i]);
            this.#all_aliases.delete(aliases[i]);
            if (last)
                this.size--;
        }
        return this;
    }
    combine_aliases(map){
        if (!(map instanceof Alias_map))
            return this.#handle_error(ERR_NOT_ALIAS_MAP, typeof map);
        if (!this.size)
            return this;
        const save_opt = assign({}, this.#opt);
        assign(this.#opt, {no_throw: true, add_existing: true});
        map.keys().forEach(set=>{
            let existed = set.find(a=>this.has(a));
            if (!existed)
                return;
            this.add_aliases(existed, ...set);
        });
        this.#opt = assign({}, save_opt);
        return this;
    }
    clear(){
        this.size = 0;
        this.#all_aliases.clear();
        return this;
    }
    delete(key){
        if (!this.has(key))
            return this;
        this.#all_aliases.get(key).keys().forEach(k=>
            this.#all_aliases.delete(k));
        this.size--;
        return this;
    }
    values(){
        let res_map = new Map();
        this.#all_aliases.forEach(key=>res_map.set(key.hash(), key.get()));
        return Array.from(res_map.values());
    }
    keys(){
        let res_map = new Map();
        this.#all_aliases.forEach(key=>res_map.set(key.hash(), key.keys()));
        return Array.from(res_map.values());
    }
}

E.Alias_map = Alias_map;
