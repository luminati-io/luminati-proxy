// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import regeneratorRuntime from 'regenerator-runtime';
import React from 'react';
import {Row, Col, Button} from 'react-bootstrap';
import etask from 'hutil/util/etask';
import util from '../util.js';
import Common from './common.js';
import {Tooltip} from './../common.js';
import Pure_component from '../../../www/util/pub/pure_component.js';

const E = {
    install: ()=>
        E.sp = etask('protocols', [function(){ return this.wait(); }]),
    uninstall: ()=>{
        if (E.sp)
            E.sp.return();
    },
};

class CertificateButton extends React.Component {
    render(){
        return <button className="btn btn_lpm stats_btn"
            onClick={this.props.onClick}> {this.props.text}</button>;
    }
}

class ProtocolRow extends Pure_component {
    componentWillMount(){
        this.setdb_on('head.callbacks.state.go', go=>this.setState({go})); }
    handle_https_btn_click = (evt)=>{
        evt.stopPropagation();
        this.props.enable_https_button_click(evt);
    };
    render(){
        const value = this.props.stat.value||0;
        const click = ()=>{
            this.state.go('logs', {protocol: this.props.stat.protocol});
        };
        return (
            <tr onClick={click}>
              <td>{this.props.stat.protocol}</td>
              <td>{util.bytes_format(this.props.stat.out_bw)}</td>
              <td>{util.bytes_format(this.props.stat.in_bw)}</td>
              <td className="reqs">{value}</td>
            </tr>
        );
    }
}

class ProtocolTable extends React.Component {
    render(){
        return <Common.Stat_table row={ProtocolRow} path="/logs"
              row_key="protocol" title={
                  <Row>
                    <Col md={6}>{this.props.title}</Col>
                    {this.props.show_enable_https_button &&
                      <Col md={6} className="text-right">
                        <CertificateButton bs_style="success"
                          text="Enable HTTPS Statistics"
                          onClick={this.props.enable_https_button_click} />
                      </Col>}
                  </Row>
                }
                row_opts={{show_enable_https_button:
                  this.props.show_enable_https_button, enable_https_button_click:
                  this.props.enable_https_button_click}}
                {...this.props}>
              <tr>
                <th className="col val">Protocol</th>
                <th className="col bw">BW up</th>
                <th className="col bw">BW down</th>
                <th className="col reqs">
                  <Tooltip title="Number of requests">
                    <span>Requests</span>
                  </Tooltip>
                </th>
              </tr>
            </Common.Stat_table>;
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
                by: 'protocol'});
            _this.setState({stats: res});
        }));
    }
    componentWillUnmount(){ E.uninstall(); }
    render(){
        return <div>
              <div className="page-header">
                <h3>Protocols</h3>
              </div>
              <ProtocolTable stats={this.state.stats} />
            </div>;
    }
}

export {ProtocolRow, ProtocolTable};
export default Stats;
