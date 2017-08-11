// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import regeneratorRuntime from 'regenerator-runtime';
import _ from 'lodash';
import React from 'react';
import {Col, Well} from 'react-bootstrap';
import etask from 'hutil/util/etask';
import Common from './common.js';
import {status_codes} from './status_codes.js';
import {DomainTable} from './domains.js';
import {ProtocolTable} from './protocols.js';

const E = {
    install: ()=>{
        E.sp = etask('status_codes_detail', [function(){
            return this.wait(); }]);
    },
    uninstall: ()=>{
        if (E.sp)
            E.sp.return();
    },
};

class StatsDetails extends React.Component {
    constructor(props){
        super(props);
        this.state = {
            domains: {stats: []},
            protocols: {stats: []},
        };
    }
    componentDidMount(){
        E.install();
        const _this = this;
        E.sp.spawn(etask(function*(){
            _this.setState(
                {stats: yield Common.StatsService.get(_this.props.code)});
            const res = yield Common.StatsService.get_top({sort: 1, limit: 5});
            _this.setState(_.pick(res, ['domains', 'protocols']));
        }));
    }
    componentWillUnmount(){ E.uninstall(); }
    render(){
        return <Common.StatsDetails stats={this.state.stats}
              header={`Status code: ${this.props.code}`} title={
                <Col md={12}>
                  <Col md={6} mdOffset={3}>
                    <Well bsSize="small" className="text-center">
                      <span>
                        {`Definition of status code ${this.props.code}:
                        ${status_codes[this.props.code]|| this.props.code}`}
                      </span>
                    </Well>
                  </Col>
                </Col>
              }>
              <Col md={6}>
                <h3>Domains</h3>
                <DomainTable stats={this.state.domains.stats} />
              </Col>
              <Col md={6}>
                <h3>Protocols</h3>
                <ProtocolTable stats={this.state.protocols.stats} />
              </Col>
            </Common.StatsDetails>;
    }
}

export default StatsDetails;
