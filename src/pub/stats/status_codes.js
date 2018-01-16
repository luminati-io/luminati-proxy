// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import regeneratorRuntime from 'regenerator-runtime';
import React from 'react';
import {Col, Table, Pagination, OverlayTrigger, Tooltip}
    from 'react-bootstrap';
import etask from 'hutil/util/etask';
import util from '../util.js';
import Common from './common.js';

const E = {
    install: ()=>
        E.sp = etask('status_codes', [function(){ return this.wait(); }]),
    uninstall: ()=>{
        if (E.sp)
            E.sp.return();
    },
};

const status_codes = {
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    203: 'Non-Authoritative Information',
    204: 'No Content',
    205: 'Reset Content',
    206: 'Partial Content',
    300: 'Multiple Choices',
    301: 'Moved Permanently',
    302: 'Found',
    303: 'See Other',
    304: 'Not Modified',
    305: 'Use Proxy',
    307: 'Temporary Redirect',
    400: 'Bad Request',
    401: 'Unauthorized',
    402: 'Payment Required',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    406: 'Not Acceptable',
    407: 'Proxy Authentication Required',
    408: 'Request Timeout',
    409: 'Conflict',
    410: 'Gone',
    411: 'Length Required',
    412: 'Precondition Failed',
    413: 'Request Entity Too Large',
    414: 'Request-URI Too Long',
    415: 'Unsupported Media Type',
    416: 'Requested Range Not Satisfiable',
    417: 'Expectation Failed',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
    505: 'HTTP Version Not Supported',
};

class StatusCodeRow extends React.Component {
    render(){
        const tooltip = <Tooltip
              id={`status_code_${this.props.stat.status_code}`}>
              {status_codes[this.props.stat.status_code]||
                this.props.stat.status_code}
            </Tooltip>;
        let class_name = '';
        let click = ()=>{};
        if (this.props.go)
        {
            click = ()=>(window.location =
                `${this.props.path}/${this.props.stat.status_code}`);
            class_name = 'row_clickable';
        }
        return (
            <tr className={class_name} onClick={click}>
              <td>
                <OverlayTrigger overlay={tooltip} placement="top">
                  <a href={`${this.props.path}/`+this.props.stat.status_code}>
                    {this.props.stat.status_code}</a>
                </OverlayTrigger>
              </td>
              <td className={this.props.class_bw}>
                {util.bytes_format(this.props.stat.bw)}</td>
              <td className={this.props.class_value}>
                {this.props.stat.value}</td>
            </tr>
        );
    }
}

class StatusCodeTable extends React.Component {
    render(){
        return <Common.StatTable row={StatusCodeRow} path="/status_codes"
              row_key="status_code" go {...this.props}>
              <tr>
                <th>Code</th>
                <th className="col-md-2">Bandwidth</th>
                <th className="col-md-5">Requests</th>
              </tr>
            </Common.StatTable>;
    }
}

class Stats extends React.Component {
    constructor(props){
        super(props);
        this.state = {stats: []};
    }
    componentDidMount(){
        E.install();
        const _this = this;
        E.sp.spawn(etask(function*(){
            const res = yield Common.StatsService.get_all({sort: 1,
                by: 'status_code'});
            _this.setState({stats: res});
        }));
    }
    componentWillUnmount(){ E.uninstall(); }
    render(){
        return <div>
              <div className="page-header">
                <h3>Status codes</h3>
              </div>
              <StatusCodeTable stats={this.state.stats} />
            </div>;
    }
}

export {status_codes, StatusCodeRow, StatusCodeTable};
export default Stats;
