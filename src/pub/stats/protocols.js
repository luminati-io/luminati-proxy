
// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
define(['regenerator-runtime', 'lodash', 'react', 'react-dom',
    'react-bootstrap', 'axios', '/util.js', 'hutil/etask', 'hutil/date',
    '/stats/common.js',
    '_css!animate'],
(rr, _, React, ReactDOM, RB, axios, util, etask, date, Common)=>{

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
              <td>{this.props.stat.proto}</td>
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
              row_key="proto" title="All protocols" {...this.props}>
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
            const res = yield etask(()=>axios.get('/api/request_stats/all'));
            const state = res.data.all.reduce((s, v, k)=>{
                let p = v.protocol;
                s[p] = s[p]||{proto: p, value: 0, bw: 0};
                s[p].value += 1;
                s[p].bw += v.bw;
                return s;
            }, {});
            _this.setState({stats: _(Object.values(state)).sortBy('value')
                .reverse().value()});
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
return E; });
