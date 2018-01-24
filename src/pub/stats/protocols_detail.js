// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import regeneratorRuntime from 'regenerator-runtime';
import _ from 'lodash';
import React from 'react';
import {Col} from 'react-bootstrap';
import etask from 'hutil/util/etask';
import Common from './common.js';
import {DomainTable} from './domains.js';
import {StatusCodeTable} from './status_codes.js';

const E = {
    install: ()=>
        E.sp = etask('protocol_detail', [function(){ return this.wait(); }]),
    uninstall: ()=>{
        if (E.sp)
            E.sp.return();
    },
};

class StatsDetails extends React.Component {
    constructor(props){
        super(props);
        this.state = {
            statuses: {stats: []},
            domains: {stats: []},
        };
    }
    componentDidMount(){
        E.install();
        const _this = this;
        E.sp.spawn(etask(function*(){
            _this.setState(
                {stats: yield Common.StatsService.get(_this.props.protocol)});
            const res = yield Common.StatsService.get_top({sort: 1, limit: 5});
            _this.setState(_.pick(res, ['statuses', 'domains']));
        }));
    }
    componentWillUnmount(){ E.uninstall(); }
    render(){
        return <Common.StatsDetails stats={this.state.stats}
              header={`Protocol: ${this.props.protocol.toUpperCase()}`}>
              <Col md={6}>
                <div className="panel">
                  <div className="panel_heading"><h2>Domains</h2></div>
                  <div className="panel_body">
                    <DomainTable stats={this.state.domains.stats} go/>
                  </div>
                </div>
              </Col>
              <Col md={6}>
                <div className="panel">
                  <div className="panel_heading"><h2>Status codes</h2></div>
                  <div className="panel_body">
                    <StatusCodeTable stats={this.state.statuses.stats} go/>
                  </div>
                </div>
              </Col>
            </Common.StatsDetails>;
    }
}

export default StatsDetails;
