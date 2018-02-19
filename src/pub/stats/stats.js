// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import regeneratorRuntime from 'regenerator-runtime';
import _ from 'lodash';
import React from 'react';
import {Button, ButtonToolbar, Row, Col, Panel, Modal, OverlayTrigger, Tooltip}
    from 'react-bootstrap';
import util from '../util.js';
import etask from 'hutil/util/etask';
import date from 'hutil/util/date';
import axios from 'axios';
import Common from './common.js';
import {StatusCodeRow, StatusCodeTable} from './status_codes.js';
import {DomainRow, DomainTable} from './domains.js';
import {ProtocolRow, ProtocolTable} from './protocols.js';
import {Dialog} from '../common.js';
import 'animate.css';
import Pure_component from '../../../www/util/pub/pure_component.js';
import {If} from '/www/util/pub/react_util.js';

const E = {
    install: ()=>E.sp = etask('stats', [function(){ return this.wait(); }]),
    uninstall: ()=>{
        if (E.sp)
            E.sp.return();
    },
};

class Stat_row extends Pure_component {
    constructor(props){
        super(props);
        this.state = {};
        this.timeouts = [];
    }
    componentWillReceiveProps(props){
        _.each(props.stat, (v, k)=>{
            if (!this.state[`class_${k}`] && this.props.stat[k]!=v)
            {
                this.setState({[`class_${k}`]: 'stats_row_change'});
                this.timeouts.push(setTimeout(()=>{
                    this.setState({[`class_${k}`]: undefined});
                }, 1000));
            }
        });
    }
    willUnmount(){
        if (this.timeouts.length)
            this.timeouts.forEach(t=>clearTimeout(t));
    }
}

class S_row extends Stat_row {
    render(){
        return <StatusCodeRow class_value={this.state.class_value}
              class_bw={this.state.class_bw} {...this.props} />;
    }
}

class D_row extends Stat_row {
    render(){
        return <DomainRow class_value={this.state.class_value}
              class_bw={this.state.class_bw} {...this.props} />;
    }
}

class P_row extends Stat_row {
    render(){
        return <ProtocolRow class_value={this.state.class_value}
              class_bw={this.state.class_bw} {...this.props} />;
    }
}

class StatTable extends React.Component {
    enter = ()=>{
        let dt = this.props.dataType;
        E.sp.spawn(this.sp = etask(function*(){
            yield etask.sleep(2*date.ms.SEC);
            util.ga_event('stats panel', 'hover', dt);
        }));
    };
    leave = ()=>{
        if (this.sp)
            this.sp.return();
    };
    render(){
        const Table = this.props.table || Common.StatTable;
        return <div onMouseEnter={this.enter} onMouseLeave={this.leave}>
              <Table go {...this.props} />
            </div>;
    }
}

class SuccessRatio extends React.Component {
    constructor(props){
        super(props);
        this.sp = etask('SuccessRatio', function*(){ yield this.wait(); });
        this.state = {total: 0, success: 0};
        this.get_req_status_stats = etask._fn(function*(_this){
            let res = yield etask(()=>axios.get('/api/req_status'));
            return res.data;
        });
    }
    componentDidMount(){
        const _this = this;
        this.sp.spawn(etask(function*(){
            while (true)
            {
                _this.setState(yield _this.get_req_status_stats());
                yield etask.sleep(3000);
            }
        }));
    }
    componentWillUnmount(){ this.sp.return(); }
    render (){
        const {total, success} = this.state;
        const ratio = total==0 ? NaN : success/total*100;
        const overallSuccessTooltip = <Tooltip
              id="succes-tooltip">
              Ratio of successful requests out of total
              requests, where successful requests are calculated as 2xx,
              3xx or 404 HTTP status codes
            </Tooltip>;
        return (
            <Row className="overall-success-ratio" onMouseEnter={()=>{
              util.ga_event('stats panel', 'hover', 'success_ratio', ratio);
            }}>
              <If when={!isNaN(ratio)}>
                <Col sm={8} className="success_title">
                  <OverlayTrigger overlay={overallSuccessTooltip}
                    placement="top"><span>Overall success</span>
                  </OverlayTrigger>
                </Col>
                <Col sm={4} className="success_value">
                  {isNaN(ratio) ? '' : ratio.toFixed(2)+'%'}
                </Col>
              </If>
            </Row>
        );
    }
}

class Stats extends React.Component {
    constructor(props){
        super(props);
        this.state = {
            statuses: {stats: []},
            domains: {stats: []},
            protocols: {stats: []},
        };
    }
    get_stats = etask._fn(function*(_this){
        this.catch(e=>console.log(e));
        while (true)
        {
            _this.setState(yield Common.StatsService.get_top({sort: 'value',
                limit: 5}));
            yield etask.sleep(date.ms.SEC);
        }
    });
    componentDidMount(){
        E.install();
        E.sp.spawn(this.get_stats());
    }
    componentWillUnmount(){ E.uninstall(); }
    close = ()=>this.setState({show_reset: false});
    confirm = ()=>this.setState({show_reset: true});
    reset_stats = ()=>{
        if (this.state.resetting)
            return;
        this.setState({resetting: true});
        const _this = this;
        E.sp.spawn(etask(function*(){
            yield Common.StatsService.reset();
            _this.setState({resetting: undefined});
            _this.close();
        }));
        util.ga_event('stats panel', 'click', 'reset btn');
    };
    enable_https_statistics = ()=>{
        this.setState({show_certificate: true});
        util.ga_event('stats panel', 'click', 'enable https stats');
    };
    close_certificate = ()=>{
        this.setState({show_certificate: false});
    };
    render(){
        return <div className="proxies lpm">
            <div className="panel stats_panel">
              <div className="panel_heading">
                <h2>Recent statistics</h2>
                <button className="btn btn_lpm btn_lpm_normal btn_reset"
                  onClick={this.confirm}>Reset</button>
              </div>
              <div className="panel_body">
                <SuccessRatio/>
                <StatTable table={StatusCodeTable} row={S_row}
                  title={`Top status codes`} dataType="status_codes"
                  stats={this.state.statuses.stats}
                  show_more={this.state.statuses.has_more}/>
                <StatTable table={DomainTable} row={D_row}
                  dataType="domains" stats={this.state.domains.stats}
                  show_more={this.state.domains.has_more}
                  title={`Top domains`} />
                <StatTable table={ProtocolTable} row={P_row}
                  dataType="protocols" stats={this.state.protocols.stats}
                  show_more={this.state.protocols.has_more}
                  title={`All protocols`}
                  show_enable_https_button
                  enable_https_button_click={this.enable_https_statistics}/>
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
          </div>;
    }
}

export default Stats;
