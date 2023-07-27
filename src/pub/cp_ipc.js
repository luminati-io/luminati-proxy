// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, react:true, es6:true*/
import _ from 'lodash4';
import zurl from '../../util/url.js';

const url_o = zurl.parse(document.location.href);
const qs_o = zurl.qs_parse((url_o.search||'').substr(1));
const parent_origin = qs_o.parent || location.ancestorOrigins &&
    location.ancestorOrigins.length && location.ancestorOrigins[0];

class CP_ipc {
    static listen(type, callback){
        if (!parent_origin)
            return false;
        const handler = event=>{
            let data;
            if (event.origin!=parent_origin || !event.data)
                return;
            if (typeof event.data == 'string')
            {
                try {
                    data = JSON.parse(event.data);
                } catch(e){
                    return console.error('Can not parse message from parent',
                        parent_origin, event.data, e.message);
                }
            }
            else
                data = event.data;
            if (data.type==type)
                callback(_.omit(data||{}, ['type']));
        };
        window.addEventListener('message', handler);
        return ()=>window.removeEventListener('message', handler);
    }
    static post(type, payload={}){
        if (!parent_origin)
            return false;
        if (!type)
            return console.error('Can not post cp message without type');
        let message;
        try {
            message = JSON.stringify(Object.assign({type}, payload));
        } catch(e){
            return console.error('Can not stringify message', origin, type,
                payload, e.message);
        }
        window.parent.postMessage(message, parent_origin);
    }
}

export default CP_ipc;
