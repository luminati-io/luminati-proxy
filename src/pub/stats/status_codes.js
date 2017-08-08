// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import regeneratorRuntime from 'regenerator-runtime';
import React from 'react';
import ReactDOM from 'react-dom';
import {Col, Table, Pagination, OverlayTrigger, Tooltip}
    from 'react-bootstrap';
import etask from 'hutil/util/etask';
import util from '../util.js';
import Common from './common.js';

let mount;
const E = {
    install: mnt=>{
        E.sp = etask('status_codes', [function(){ return this.wait(); }]);
        ReactDOM.render(<Stats />, mount = mnt);
    },
    uninstall: ()=>{
        if (E.sp)
            E.sp.return();
        if (mount)
            ReactDOM.unmountComponentAtNode(mount);
        mount = null;
    },
};

const status_codes = {
    200: 'Succeeded requests',
    301: 'Permanently moved to a new location',
    302: 'Temporary moved to a new location',
    303: 'See other',
    400: 'Bad request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not found',
    407: 'Proxy authentication required',
    414: 'Request-URI too long',
    500: 'Internal server error',
    502: 'Bad gateway',
    503: 'Service unavailable',
    504: 'Gateway timeout',
};

class StatusCodeRow extends React.Component {
    render(){
        const tooltip = <Tooltip
              id={`status_code_${this.props.stat.status_code}`}>
              {status_codes[this.props.stat.status_code]||
                this.props.stat.status_code}
            </Tooltip>;
        return <tr>
              <OverlayTrigger overlay={tooltip} placement="top">
                <td>
                  <a href={`${this.props.path}/`+this.props.stat.status_code}>
                    {this.props.stat.status_code}</a>
                </td>
              </OverlayTrigger>
              <td className={this.props.class_bw}>
                {util.bytes_format(this.props.stat.bw)}</td>
              <td className={this.props.class_value}>
                {this.props.stat.value}</td>
            </tr>;
    }
}

class StatusCodeTable extends React.Component {
    render(){
        return <Common.StatTable row={StatusCodeRow} path="/status_codes"
              row_key="status_code" title="All status codes" {...this.props}>
              <tr>
                <th>Status Code</th>
                <th className="col-md-2">Bandwidth</th>
                <th className="col-md-5">Number of requests</th>
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
        const _this = this;
        E.sp.spawn(etask(function*(){
            const res = yield Common.StatsService.get_all({sort: 1,
                by: 'status_code'});
            _this.setState({stats: res});
        }));
    }
    render(){
        return <div>
              <div className="page-header">
                <h3>Status codes</h3>
              </div>
              <div className="page-body">
                <StatusCodeTable stats={this.state.stats} />
              </div>
            </div>;
    }
}

E.status_codes = status_codes;
E.Row = StatusCodeRow;
E.Table = StatusCodeTable;

export {status_codes};
export default E;
