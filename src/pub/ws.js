// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, react:true, es6:true*/
import {EventTarget} from 'event-target-shim';

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
        });
        this.socket.addEventListener('error', e=>{
            switch (e.code){
            case 'ECONNREFUSED':
                console.log('need to reconnect');
                break;
            default:
                console.log('error');
                break;
            }
        });
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
