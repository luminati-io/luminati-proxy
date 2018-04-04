// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import regeneratorRuntime from 'regenerator-runtime';
import React from 'react';
import etask from 'hutil/util/etask';
import util from '../util.js';
import Common from './common.js';
import {Tooltip} from './../common.js';
import Pure_component from '../../../www/util/pub/pure_component.js';

const E = {
    install: ()=>E.sp = etask('domains', [function(){ return this.wait(); }]),
    uninstall: ()=>{
        if (E.sp)
            E.sp.return();
    },
};

class DomainRow extends Pure_component {
    componentWillMount(){
        this.setdb_on('head.callbacks.state.go', go=>this.setState({go})); }
    render(){
        const click = ()=>{
            this.state.go('logs', {domain: this.props.stat.hostname});
        };
        return (
            <tr onClick={click}>
              <td>{this.props.stat.hostname}</td>
              <td>{util.bytes_format(this.props.stat.out_bw)}</td>
              <td>{util.bytes_format(this.props.stat.in_bw)}</td>
              <td className="reqs">{this.props.stat.value}</td>
            </tr>
        );
    }
}

class DomainTable extends React.Component {
    render(){
        return (
            <Common.Stat_table row={DomainRow}
              row_key="hostname" {...this.props}>
              <tr>
                <th className="col val">Domain</th>
                <th className="col bw">BW up</th>
                <th className="col bw">BW down</th>
                <th className="col reqs">
                  <Tooltip title="Number of requests">
                    <span>Requests</span>
                  </Tooltip>
                </th>
              </tr>
            </Common.Stat_table>
        );
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
                by: 'hostname'});
            _this.setState({stats: res});
        }));
    }
    componentWillUnmount(){ E.uninstall(); }
    render(){
        return <div>
              <div className="page-header">
                <h3>Domains</h3>
              </div>
              <DomainTable stats={this.state.stats}/>
            </div>;
    }
}

export {DomainRow, DomainTable};
export default Stats;
