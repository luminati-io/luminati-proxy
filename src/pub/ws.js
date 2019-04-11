// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, react:true, es6:true*/
import {EventTarget} from 'event-target-shim';
import setdb from '../../util/setdb.js';

class Ws_wrapper extends EventTarget {
    set_location = (url, port)=>{
        this.url = url;
        this.port = port;
        this.create_socket();
        this.start_checking();
    };
    create_socket = ()=>{
        console.log('createing socket');
        this.socket = new WebSocket(`ws://${this.url}:${this.port}`);
        const _this = this;
        this.socket.addEventListener('message', event=>{
            _this.dispatchEvent(event, 'message');
            _this.global_handler(event);
        });
        this.socket.addEventListener('error', e=>{
            if (e.code=='ECONNREFUSED')
                console.log('need to reconnect');
        });
    };
    global_handler = event=>{
        const json = JSON.parse(event.data);
        if (json.type!='global')
            return;
        setdb.set('ws.'+json.data.path, json.data.payload);
    };
    start_checking = ()=>{
        const _this = this;
        window.setInterval(()=>{
            if (_this.socket.readyState==_this.socket.CLOSED)
                this.create_socket();
        }, 1000);
    };
}

export default new Ws_wrapper();
