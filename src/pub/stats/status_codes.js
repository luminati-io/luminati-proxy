
// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
define(['regenerator-runtime', 'lodash', 'react', 'react-dom',
    'react-bootstrap', 'axios', '/util.js', 'hutil/etask', 'hutil/date',
    '/stats/common.js',
    '_css!animate'],
(rr, _, React, ReactDOM, RB, axios, util, etask, date, Common)=>{

let mount;
const E = {
    install: (mnt, {code} = null)=>{
        E.sp = etask('status_codes', [function(){ return this.wait(); }]);
        ReactDOM.render(<Stats code={code} />, mount = mnt);
    },
    uninstall: ()=>{
        if (E.sp)
            E.sp.return();
        if (mount)
            ReactDOM.unmountComponentAtNode(mount);
        mount = null;
    },
};

const status_codes = {
    200: 'Succeeded requests',
    301: 'Permanently moved to a new location',
    302: 'Temporary moved to a new location',
    303: 'See other',
    400: 'Bad request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not found',
    407: 'Proxy authentication required',
    414: 'Request-URI too long',
    500: 'Internal server error',
    502: 'Bad gateway',
    503: 'Service unavailable',
    504: 'Gateway timeout',
};

class StatusCodeRow extends React.Component {
    render(){
        const {OverlayTrigger, Tooltip} = RB;
        const tooltip = <Tooltip id={`status_code_${this.props.stat.code}`}>
              {status_codes[this.props.stat.code]||this.props.stat.code}
            </Tooltip>;
        return <tr>
              <OverlayTrigger overlay={tooltip} placement="top">
                <td>{this.props.stat.code}</td>
              </OverlayTrigger>
              <td className={this.props.class_bw}>
                {util.bytes_format(this.props.stat.bw)}</td>
              <td className={this.props.class_value}>
                {this.props.stat.value}</td>
            </tr>;
    }
}

class StatusCodeTable extends React.Component {
    render(){
        return <Common.StatTable row={StatusCodeRow} path="/status_codes"
              row_key="code" title="All status codes" {...this.props}>
              <tr>
                <th>Status Code</th>
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
                let c = v.status_code;
                s[c] = s[c]||{code: c, value: 0, bw: 0};
                s[c].value += 1;
                s[c].bw += v.bw;
                return s;
            }, {});
            _this.setState({stats: _(Object.values(state)).sortBy('value')
                .reverse().value()});
        }));
    }
    render(){
        return <div>
              <div className="page-header">
                <h3>{`Status codes ${this.props.code}`}</h3>
              </div>
              <div className="page-body">
                <StatusCodeTable stats={this.state.stats} />
              </div>
            </div>;
    }
}

E.Row = StatusCodeRow;
E.Table = StatusCodeTable;
return E; });
