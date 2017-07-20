// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
define(['regenerator-runtime', 'lodash', 'react', 'react-dom',
    'react-bootstrap', 'hutil/etask', '/stats/common.js',
    '/stats/status_codes.js', '/stats/protocols.js'],
(rr, _, React, ReactDOM, RB, etask, Common, StatusCode, Protocol)=>{

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
        const {Col} = RB;
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

return E; });
