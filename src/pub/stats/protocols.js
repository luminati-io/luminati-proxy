// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import regeneratorRuntime from 'regenerator-runtime';
import React from 'react';
import ReactDOM from 'react-dom';
import etask from 'hutil/util/etask';
import util from 'app/util.js';
import Common from './common.js';

let mount;
const E = {
    install: mnt=>{
        E.sp = etask('protocols', [function(){ return this.wait(); }]);
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

class ProtocolRow extends React.Component {
    render(){
        return <tr>
              <td>
                <a href={`${this.props.path}/${this.props.stat.protocol}`}>
                  {this.props.stat.protocol}</a>
              </td>
              <td className={this.props.class_bw}>
                {util.bytes_format(this.props.stat.bw)}</td>
              <td className={this.props.class_value}>
                {this.props.stat.value}</td>
            </tr>;
    }
}

class ProtocolTable extends React.Component {
    render(){
        return <Common.StatTable row={ProtocolRow} path="/protocols"
              row_key="protocol" title="All protocols" {...this.props}>
              <tr>
                <th>Protocol</th>
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
                by: 'protocol'});
            _this.setState({stats: res});
        }));
    }
    render(){
        return <div>
              <div className="page-header">
                <h3>Protocols</h3>
              </div>
              <div className="page-body">
                <ProtocolTable stats={this.state.stats} />
              </div>
            </div>;
    }
}

E.Row = ProtocolRow;
E.Table = ProtocolTable;
export default E;
