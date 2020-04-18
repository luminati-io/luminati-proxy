// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const net = require('net');
const sinon = require('sinon');
const Ws = require('../lib/ws.js');

describe('ws', ()=>{
    let ws_handler, socket, s_mock, dst, d_mock;
    beforeEach(()=>{
        socket = new net.Socket();
        s_mock = sinon.mock(socket);
        dst = new net.Socket();
        d_mock = sinon.mock(dst);
        ws_handler = new Ws({});
    });
    afterEach(()=>{
        ws_handler.stop();
        socket.destroy();
        dst.destroy();
    });
    it('pipes both sockets on proxy req upgrade', ()=>{
        d_mock.expects('pipe').returns(socket).once().withArgs(socket);
        s_mock.expects('pipe').once().withArgs(dst);
        ws_handler.handle_connection(socket, dst);
        s_mock.verify();
        d_mock.verify();
    });
    it('destroy sockets on stop', ()=>{
        ws_handler.handle_connection(socket, dst);
        s_mock.expects('destroy').once();
        d_mock.expects('destroy').once();
        ws_handler.stop();
        s_mock.verify();
        d_mock.verify();
    });
});
