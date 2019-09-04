// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const net = require('net');
const sinon = require('sinon');
const Ws = require('../lib/ws.js');
const pkg = require('../package.json');
const ws_host = pkg.api_domain;

describe('ws', ()=>{
    const req = {
        headers: {
            host: ws_host,
            connection: 'Upgrade',
            upgrade: 'websocket'},
            'Sec-WebSocket-Key': 'uRovscZjNol/umbTt5uKmw==',
        url: '/',
    };
    let ws_handler, socket, s_mock, dst, d_mock;
    const init = (opt={})=>{
        socket = new net.Socket();
        s_mock = sinon.mock(socket);
        dst = new net.Socket();
        d_mock = sinon.mock(dst);
        ws_handler = new Ws(opt);
    };
    const stub_proxy_req_event = (event, ...args)=>{
        Ws.prototype.proxy_https.restore();
        sinon.stub(Ws.prototype, 'proxy_https', ()=>{
            return {
                on: (ev, fn)=>{
                    if (event==ev)
                        fn(...args);
                },
                end: sinon.stub(),
            };
        });
    };
    beforeEach(()=>{
        init();
        sinon.stub(Ws.prototype, 'proxy_https',
            ()=>({on: sinon.stub(), end: sinon.stub()}));
    });
    afterEach(()=>{
        ws_handler.stop();
        socket.destroy();
        dst.destroy();
        Ws.prototype.proxy_https.restore();
    });
    it('unshifts initial buffer', ()=>{
        const buf = Buffer.from('initial data');
        s_mock.expects('unshift').once().withArgs(buf);
        ws_handler.handle_connection(req, socket, buf);
        s_mock.verify();
    });
    it('closes socket on proxy req error', ()=>{
        sinon.stub(ws_handler._log, 'error');
        stub_proxy_req_event('error', Error('network problem'));
        s_mock.expects('end').once();
        ws_handler.handle_connection(req, socket);
        s_mock.verify();
    });
    it('writes to socket on proxy req response with no upgrade', ()=>{
        const res = {statusCode: 403, statusMessage: 'Forbidden',
            pipe: ()=>null};
        const r_mock = sinon.mock(res);
        stub_proxy_req_event('response', res);
        const match = sinon.match(
            `HTTP/1.1 ${res.statusCode} ${res.statusMessage}`);
        s_mock.expects('write').once().withArgs(match);
        r_mock.expects('pipe').once().withArgs(socket);
        ws_handler.handle_connection(req, socket);
        s_mock.verify();
        r_mock.verify();
    });
    it('unshifts initial buffer on proxy req upgrade', ()=>{
        sinon.stub(socket, 'write');
        const buf = Buffer.from('initial data');
        stub_proxy_req_event('upgrade', {}, dst, buf);
        d_mock.expects('unshift').once().withArgs(buf);
        ws_handler.handle_connection(req, socket);
        d_mock.verify();
    });
    it('pipes both sockets on proxy req upgrade', ()=>{
        stub_proxy_req_event('upgrade', {}, dst);
        const match = sinon.match('HTTP/1.1 101 Switching Protocols');
        s_mock.expects('write').once().withArgs(match);
        d_mock.expects('pipe').returns(socket).once().withArgs(socket);
        s_mock.expects('pipe').once().withArgs(dst);
        ws_handler.handle_connection(req, socket);
        s_mock.verify();
        d_mock.verify();
    });
    it('destroy sockets on stop', ()=>{
        sinon.stub(socket, 'write');
        stub_proxy_req_event('upgrade', {}, dst);
        ws_handler.handle_connection(req, socket);
        s_mock.expects('destroy').once();
        d_mock.expects('destroy').once();
        ws_handler.stop();
        s_mock.verify();
        d_mock.verify();
    });
});
