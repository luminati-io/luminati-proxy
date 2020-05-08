// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, react:true, es6:true*/
import {EventTarget} from 'event-target-shim';
import setdb from '../../util/setdb.js';

class Ws_wrapper extends EventTarget {
    constructor(){
        super();
        this.url = location.hostname;
        this.port = location.port;
        this.protocol = location.protocol=='https:' ? 'wss' : 'ws';
        this.create_socket();
    }
    create_socket = ()=>{
        console.log('creating socket');
        this.socket = new WebSocket(
            `${this.protocol}://${this.url}:${this.port}`);
        const _this = this;
        this.socket.addEventListener('message', event=>{
            _this.dispatchEvent(event, 'message');
            _this.global_handler(event);
        });
        this.socket.addEventListener('error', e=>{
            if (e.code=='ECONNREFUSED')
                console.log('need to reconnect');
        });
        this.socket.addEventListener('close', ()=>{
            setTimeout(()=>this.create_socket(), 1000);
        });
    };
    global_handler = event=>{
        const json = JSON.parse(event.data);
        if (json.type!='global')
            return;
        const {path, payload} = json.data;
        if (path.endsWith('.remove') || path.endsWith('.add'))
            return setdb.emit('ws.'+path, payload);
        setdb.set('ws.'+path, payload);
    };
}

export default new Ws_wrapper();
