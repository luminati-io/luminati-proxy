
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
        E.sp = etask('domains', [function(){ return this.wait(); }]);
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

class DomainRow extends React.Component {
    render(){
        return <tr>
              <td>{this.props.stat.hostname}</td>
              <td className={this.props.class_bw}>
                {util.bytes_format(this.props.stat.bw)}</td>
              <td className={this.props.class_value}>
                {this.props.stat.value}</td>
            </tr>;
    }
}

class DomainTable extends React.Component {
    render(){
        return <Common.StatTable row={DomainRow} path="/domains"
              row_key="hostname" title="All domains" {...this.props}>
              <tr>
                <th>Domain Host</th>
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
                let h = v.hostname;
                s[h] = s[h]||{hostname: h, value: 0, bw: 0};
                s[h].value += 1;
                s[h].bw += v.bw;
                return s;
            }, {});
            _this.setState({stats: _(Object.values(state)).sortBy('value')
                .reverse().value()});
        }));
    }
    render(){
        return <div>
              <div className="page-header">
                <h3>Domains</h3>
              </div>
              <div className="page-body">
                <DomainTable stats={this.state.stats} />
              </div>
            </div>;
    }
}

E.Row = DomainRow;
E.Table = DomainTable;
return E; });
