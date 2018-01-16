// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import regeneratorRuntime from 'regenerator-runtime';
import React from 'react';
import etask from 'hutil/util/etask';
import util from '../util.js';
import Common from './common.js';

const E = {
    install: ()=>E.sp = etask('domains', [function(){ return this.wait(); }]),
    uninstall: ()=>{
        if (E.sp)
            E.sp.return();
    },
};

class DomainRow extends React.Component {
    render(){
        let class_name = '';
        let click = ()=>{};
        if (this.props.go)
        {
            click = ()=>(window.location =
                `${this.props.path}/${this.props.stat.hostname}`);
            class_name = 'row_clickable';
        }
        return (
            <tr className={class_name} onClick={click}>
              <td>
                <a href={`${this.props.path}/`+this.props.stat.hostname}>
                  {this.props.stat.hostname}</a>
              </td>
              <td className={this.props.class_bw}>
                {util.bytes_format(this.props.stat.bw)}</td>
              <td className={this.props.class_value}>
                {this.props.stat.value}</td>
            </tr>
        );
    }
}

class DomainTable extends React.Component {
    render(){
        return <Common.StatTable row={DomainRow} path="/domains"
              row_key="hostname" go {...this.props}>
              <tr>
                <th>Domain</th>
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
              <DomainTable stats={this.state.stats} />
            </div>;
    }
}

export {DomainRow, DomainTable};
export default Stats;
