// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
define(['regenerator-runtime', 'lodash', 'react', 'react-dom',
    'react-bootstrap', 'hutil/etask', '/stats/common.js',
    '/stats/status_codes.js', '/stats/domains.js'],
(rr, _, React, ReactDOM, RB, etask, Common, StatusCode, Domain)=>{

let mount;
const E = {
    install: (mnt, {protocol})=>{
        E.sp = etask('protocol_detail', [function(){ return this.wait(); }]);
        ReactDOM.render(<StatsDetails protocol={protocol} />, mount = mnt);
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
            domains: {stats: []},
        };
    }
    componentDidMount(){
        const _this = this;
        E.sp.spawn(etask(function*(){
            _this.setState(
                {stats: yield Common.StatsService.get(_this.props.protocol)});
            const res = yield Common.StatsService.get_top({sort: 1, limit: 5});
            _this.setState(_.pick(res, ['statuses', 'domains']));
        }));
    }
    render(){
        const {Col} = RB;
        return <Common.StatsDetails stats={this.state.stats}
              header={`Protocol: ${this.props.protocol.toUpperCase()}`}>
              <Col md={6}>
                <h3>Domains</h3>
                <Domain.Table stats={this.state.domains.stats} />
              </Col>
              <Col md={6}>
                <h3>Status codes</h3>
                <StatusCode.Table stats={this.state.statuses.stats} />
              </Col>
            </Common.StatsDetails>;
    }
}

return E; });
