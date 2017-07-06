// LICENSE_CODE ZON ISC
'use strict'; /*jslint browser:true, jsx:true*//*global module:true*/
define(['regenerator-runtime', 'lodash', 'react', 'react-dom',
    'react-bootstrap', 'axios', '/util.js', 'hutil/etask', 'hutil/date',
    '_css!animate'],
(rr, _, React, ReactDOM, RB, axios, util, etask, date)=>{

let mount, ga_event;
const E = {
    init_ga: ga=>ga_event = ga,
    install: mnt=>{
        E.sp = etask('lpm_stats', [function(){ return this.wait(); }]);
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

class StatRow extends React.Component {
    constructor(props){
        super(props);
        this.state = {};
    }
    componentWillReceiveProps(props){
        _.each(props.stat, (v, k)=>{
            if (!this.state[`class_${k}`] && this.props.stat[k]!=v)
            {
                this.setState({[`class_${k}`]: 'stats_row_change'});
                setTimeout(()=>this.setState({[`class_${k}`]: undefined}),
                    1000);
            }
        });
    }
}

class StatusCodeRow extends StatRow {
    render(){
        return <tr>
              <td>{this.props.stat.code}</td>
              <td className={this.state.class_value}>
                {this.props.stat.value}</td>
            </tr>;
    }
}

class DomainRow extends StatRow {
    render(){
        return <tr>
              <td>{this.props.stat.hostname}</td>
              <td className={this.state.class_value}>
                {this.props.stat.value}</td>
            </tr>;
    }
}

class ProtoRow extends StatRow {
    render(){
        return <tr>
              <td>{this.props.stat.proto.toUpperCase()}</td>
              <td className={this.state.class_bw}>
                {util.bytes_format(this.props.stat.bw)}</td>
              <td className={this.state.class_value}>
                {this.props.stat.value}</td>
            </tr>;
    }
}

class StatTable extends React.Component {
    enter = ()=>{
        let dt = this.props.dataType;
        E.sp.spawn(this.sp=etask({cancel: true}, [function(){
            return etask.sleep(2*date.ms.SEC);
        }, function(){
            ga_event('stats panel', 'hover', dt);
        }]));
    }
    leave = ()=>{
        this.sp.return();
    }
    render(){
        let Row = this.props.row;
        return <div onMouseEnter={this.enter} onMouseLeave={this.leave}>
              <h4>{this.props.title}</h4>
              <table className="table table-condensed table-bordered">
                <thead>{this.props.children}</thead>
                <tbody>
                  {this.props.stats.map(s=>
                    <Row stat={s} key={s[this.props.row_key||'key']}
                      path={this.props.path} />)}
                </tbody>
              </table>
            </div>;
    }
}

class Stats extends React.Component {
    constructor(props){
        super(props);
        this.state = {statuses: [], domains: [], protocols: []};
    }
    get_stats = etask._fn(function*(_this){
        if (E.sp.tm_completed)
            return;
        let res = yield etask(()=>axios.get('/api/request_stats/top'));
        let state = _.reduce(res.data.top, (s, v, k)=>{
            if (_.isInteger(+k))
                return s.statuses.push({code: k, value: v}) && s;
            if (['http', 'https'].includes(k))
            {
                return s.protocols.push({proto: k, bw: v.bw,
                    value: v.count}) && s;
            }
            return s.domains.push({hostname: k, value: v}) && s;
        }, {statuses: [], domains: [], protocols: []});
        ['statuses', 'domains', 'protocols'].forEach(k=>
            state[k] = _(state[k]).sortBy('value').take(5).reverse().value());
        _this.setState(state);
        E.sp.spawn(etask({cancel: true}, [()=>etask.sleep(1000),
            ()=>_this.get_stats()]));
    })
    componentDidMount(){
        E.sp.spawn(this.get_stats());
    }
    render(){
        const Button = RB.Button;
        return <div className="panel panel-default">
              <div className="panel-heading">Recent statistics</div>
              <div className="panel-body">
                <StatTable row={StatusCodeRow} path="/status_codes"
                  row_key="code" title={`Top ${_.min([5,
                      this.state.statuses.length])||''} status codes`}
                  stats={this.state.statuses} dataType="status_codes">
                  <tr>
                    <th className="col-md-4">Status Code</th>
                    <th>Number of requests</th>
                  </tr>
                </StatTable>
                <StatTable row={DomainRow} path="/domains" row_key="hostname"
                  stats={this.state.domains} title={`Top ${_.min([5,
                      this.state.domains.length])||''} domains`}
                  dataType="domains">
                  <tr>
                    <th className="col-md-4">Domain Host</th>
                    <th>Number of requests</th>
                  </tr>
                </StatTable>
                <StatTable row={ProtoRow} path="/protocols" row_key="proto"
                  stats={this.state.protocols} title="Bandwidth"
                  dataType="protocols">
                  <tr>
                    <th className="col-md-2">Type</th>
                    <th className="col-md-2">Bandwidth</th>
                    <th>Number of Requests</th>
                  </tr>
                </StatTable>
              </div>
            </div>;
    }
}

return E; });
