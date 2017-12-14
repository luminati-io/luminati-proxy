// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import regeneratorRuntime from 'regenerator-runtime';
import React from 'react';
import {Row, Col, Button} from 'react-bootstrap';
import etask from 'hutil/util/etask';
import util from '../util.js';
import Common from './common.js';

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
        return <Button bsStyle={this.props.bs_style} bsSize="xsmall"
              onClick={this.props.onClick}>{this.props.text}</Button>;
    }
}

class ProtocolRow extends React.Component {
    handle_https_btn_click = (evt)=>{
        evt.stopPropagation();
        this.props.enable_https_button_click(evt);
    };
    render_https_button(){
        if (this.props.stat.protocol!='https')
          return null;
        if (!this.props.show_enable_https_button)
          return null;
        return (
            <CertificateButton bs_style="success"
              text="Enable HTTPS Statistics"
              onClick={this.handle_https_btn_click} />
        );
    }
    render(){
        let class_name = '';
        let click = ()=>{};
        let https_button = this.render_https_button();
        let value = !https_button||this.props.stat.value!='0' ?
            this.props.stat.value : '';
        if (this.props.go)
        {
            click = ()=>(window.location =
                `${this.props.path}/${this.props.stat.protocol}`);
            class_name = 'row_clickable';
        }
        return (
            <tr className={class_name} onClick={click}>
              <td>
                <a href={`${this.props.path}/${this.props.stat.protocol}`}>
                  {this.props.stat.protocol}</a>
              </td>
              <td className={this.props.class_bw}>
                {util.bytes_format(this.props.stat.bw)}</td>
              <td className={this.props.class_value}>
                {value} {https_button}
              </td>
            </tr>
        );
    }
}

class ProtocolTable extends React.Component {
    render(){
        return <Common.StatTable row={ProtocolRow} path="/protocols"
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
                go
                row_opts={{show_enable_https_button:
                  this.props.show_enable_https_button, enable_https_button_click:
                  this.props.enable_https_button_click}}
                {...this.props}>
              <tr>
                <th>Protocol</th>
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
