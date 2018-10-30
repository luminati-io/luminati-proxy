// LICENSE_CODE ZON
'use strict'; /*jslint node:true, browser:true, es6:true*/
(function(){
let define, is_node = typeof module=='object' && module.exports;
if (!is_node)
    define = self.define;
else
    define = require('./require_node.js').define(module, '../');
define(['/util/etask.js', '/util/zerr.js'], function(etask, zerr){

class Queue {
    constructor(label='queue'){
        this.front = undefined;
        this.back = undefined;
        this.waiting = undefined;
        this.label = label;
    }
    put(item, ttl){
        this._expire();
        let entry = {
            data: item,
            expires: ttl ? Date.now()+ttl : undefined,
            next: undefined,
        };
        if (this.back)
            this.back.next = entry;
        this.back = entry;
        if (!this.front)
            this.front = entry;
        if (this.waiting)
            this.waiting.return();
    }
    _get(){
        this._expire();
        let entry = this.front;
        if (!entry)
            return;
        this.front = entry.next;
        if (!this.front)
            this.back = undefined;
        return entry;
    }
    get(){
        let entry = this._get();
        return entry && entry.data;
    }
    get_ex(){
        let entry = this._get();
        return entry && {item: entry.data, expires: entry.expires};
    }
    wait(){
        if (this.waiting)
        {
            zerr.zexit(`${this.label}: `
                +`concurrent calls to queue.wait are not allowed`);
        }
        let _this = this;
        return etask(function*queue_get(){
            this.info.label = _this.label;
            for (;;)
            {
                let entry = _this._get();
                if (entry)
                    return entry.data;
                try {
                    _this.waiting = etask.wait();
                    yield _this.waiting;
                } finally { _this.waiting = undefined; }
            }
        });
    }
    _expire(){
        if (!this.front)
            return;
        let now = Date.now(), dropped = 0;
        while (this.front && this.front.expires<now)
        {
            dropped++;
            this.front = this.front.next;
        }
        if (dropped)
        {
            if (!this.front)
                this.back = undefined;
            zerr.warn(`${this.label}: dropped ${dropped} expired items`);
        }
    }
}

return Queue;

}); }());
