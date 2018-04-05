// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import _ from 'lodash';
import React from 'react';
import {Button, ButtonToolbar, OverlayTrigger, Tooltip} from 'react-bootstrap';
import util from '../util.js';
import etask from 'hutil/util/etask';
import date from 'hutil/util/date';
import axios from 'axios';
import Common from './common.js';
import {Dialog} from '../common.js';
import Pure_component from '../../../www/util/pub/pure_component.js';
import {If} from '/www/util/pub/react.js';

class Success_ratio extends Pure_component {
    constructor(props){
        super(props);
        this.state = {total: 0, success: 0};
    }
    componentDidMount(){
        this.setdb_on('head.req_status', req_status=>
            this.setState({...req_status}));
    }
    render (){
        const {total, success} = this.state;
        const ratio = total==0 ? NaN : success/total*100;
        const tooltip = <Tooltip
              id="succes-tooltip">
              Ratio of successful requests out of total
              requests, where successful requests are calculated as 2xx,
              3xx or 404 HTTP status codes
            </Tooltip>;
        return (
            <div className="overall_success_ratio">
              <div className="success_title">
                <OverlayTrigger overlay={tooltip}
                  placement="top"><span>Success rate:</span>
                </OverlayTrigger>
              </div>
              <div className="success_value">
                {isNaN(ratio) ? '-' : ratio.toFixed(2)+'%'}</div>
            </div>
        );
    }
}

class Stats extends Pure_component {
    constructor(props){
        super(props);
        this.state = {
            statuses: {stats: []},
            domains: {stats: []},
            protocols: {stats: []},
        };
    }
    componentDidMount(){
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>console.log(e));
            while (true)
            {
                _this.setState(yield Common.StatsService.get_top({
                    sort: 'value',
                    limit: 5,
                    master_port: _this.props.master_port,
                }));
                yield etask.sleep(date.ms.SEC);
            }
        });
    }
    close = ()=>this.setState({show_reset: false});
    confirm = ()=>this.setState({show_reset: true});
    reset_stats = ()=>{
        if (this.state.resetting)
            return;
        this.setState({resetting: true});
        const _this = this;
        this.etask(function*(){
            yield Common.StatsService.reset();
            _this.setState({resetting: undefined});
            _this.close();
        });
        util.ga_event('stats panel', 'click', 'reset btn');
    };
    enable_https_statistics = ()=>{
        this.setState({show_certificate: true});
        util.ga_event('stats panel', 'click', 'enable https stats');
    };
    close_certificate = ()=>{ this.setState({show_certificate: false}); };
    render(){
        return (
            <div className="panel stats_panel">
              <div className="panel_heading">
                <h2>Statistics</h2>
                <div className="buttons_wrapper">
                  <button className="btn btn_lpm btn_lpm_normal btn_lpm_small"
                    onClick={this.confirm}>Reset</button>
                </div>
              </div>
              <div className="panel_body with_table">
                <Success_ratio/>
                <Common.Stat_table stats={this.state.statuses.stats}
                  row_key="status_code" logs="code" title="Code"/>
                <Common.Stat_table stats={this.state.domains.stats}
                  row_key="hostname" logs="domain" title="Domain"/>
                <Common.Stat_table stats={this.state.protocols.stats}
                  row_key="protocol" logs="protocol" title="Protocol"/>
                <Dialog show={this.state.show_reset} onHide={this.close}
                  title="Reset stats" footer={
                    <ButtonToolbar>
                      <Button bsStyle="primary" onClick={this.reset_stats}
                        disabled={this.state.resetting}>
                        {this.state.resetting ? 'Resetting...' : 'OK'}
                      </Button>
                      <Button onClick={this.close}>Cancel</Button>
                    </ButtonToolbar>
                  }>
                  <h4>Are you sure you want to reset stats?</h4>
                </Dialog>
                <Dialog show={this.state.show_certificate}
                  onHide={this.close_certificate}
                  title="Add certificate file to browsers"
                  footer={
                    <Button onClick={this.close_certificate}>Close</Button>
                  }>
                  Gathering stats for HTTPS requests requires setting a
                  certificate key.
                  <ol>
                    <li>Download our free certificate key
                      <a href="/ssl" target="_blank" download> here</a>
                    </li>
                    <li>Add the certificate to your browser</li>
                    <li>Refresh the page</li>
                  </ol>
                </Dialog>
              </div>
            </div>
        );
    }
}

export default Stats;
