// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import regeneratorRuntime from 'regenerator-runtime';
import _ from 'lodash';
import React from 'react';
import ReactDOM from 'react-dom';
import {Col} from 'react-bootstrap';
import etask from 'hutil/util/etask';
import Common from './common.js';
import StatusCode from './status_codes.js';
import Protocol from './protocols.js';

let mount;
const E = {
    install: (mnt, {domain})=>{
        E.sp = etask('domains_detail', [function(){ return this.wait(); }]);
        ReactDOM.render(<StatsDetails domain={domain} />, mount = mnt);
    },
    uninstall: ()=>{
        if (E.sp)
            E.sp.return();
        if (mount)
            ReactDOM.unmountComponentAtNode(mount);
        mount = null;
    },
};

class StatsDetails extends React.Component {
    constructor(props){
        super(props);
        this.state = {
            statuses: {stats: []},
            protocols: {stats: []},
        };
    }
    componentDidMount(){
        const _this = this;
        E.sp.spawn(etask(function*(){
            _this.setState(
                {stats: yield Common.StatsService.get(_this.props.domain)});
            const res = yield Common.StatsService.get_top({sort: 1, limit: 5});
            _this.setState(_.pick(res, ['statuses', 'protocols']));
        }));
    }
    render(){
        return <Common.StatsDetails stats={this.state.stats}
              header={`Domain name: ${this.props.domain}`}>
              <Col md={6}>
                <h3>Status codes</h3>
                <StatusCode.Table stats={this.state.statuses.stats} />
              </Col>
              <Col md={6}>
                <h3>Protocols</h3>
                <Protocol.Table stats={this.state.protocols.stats} />
              </Col>
            </Common.StatsDetails>;
    }
}

export default E;
