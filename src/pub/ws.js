// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, react:true, es6:true*/
import _ from 'lodash';
import {EventTarget} from 'event-target-shim';
import setdb from '../../util/setdb.js';
import zws from '../../util/ws.js';
import {get_location_port} from './util.js';

class Ws_wrapper extends EventTarget {
    constructor(){
        super();
        this.url = location.hostname;
        this.port = get_location_port();
        this.protocol = location.protocol=='https:' ? 'wss' : 'ws';
        this.create_socket();
    }
    create_socket(){
        const ws_url = `${this.protocol}://${this.url}:${this.port}`;
        const _this = this;
        this.socket = new zws.Client(ws_url, {
            mux: {use_ack: true},
            label: 'pmgr_ui',
            ipc_client: {
                hello: 'post',
                ui_event: 'post',
            },
        })
        .on('connected', ()=>console.log('pmgr ws connected'))
        .on('disconnected', ()=>console.log('pmgr ws disconnected'))
        .on('json', data=>{
            const event = new MessageEvent(data.msg || 'message', {data});
            _this.dispatchEvent(event);
            _this.global_handler(event);
        });
    }
    global_handler(event){
        if (!event.data || !event.data.msg!='update_path')
            return;
        const {path, payload} = event.data;
        if (path.endsWith('.remove') || path.endsWith('.add'))
            return setdb.emit('ws.'+path, payload);
        setdb.set('ws.'+path, payload);
    }
    post_event(name, payload={}){
        if (!name || !_.isString(name))
            return void console.error('pmgr ws not valid event name', name);
        this.socket.ipc.ui_event(Object.assign(payload,
            {name, cred: document.cookie}));
    }
}

export default new Ws_wrapper();
