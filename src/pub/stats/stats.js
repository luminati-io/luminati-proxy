// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
define(['regenerator-runtime', 'lodash', 'react', 'react-dom',
    'react-bootstrap', 'axios', '/util.js', 'hutil/etask', 'hutil/date',
    '/stats/common.js', '/stats/status_codes.js', '/stats/domains.js',
    '/stats/protocols.js', '_css!animate'],
(rr, _, React, ReactDOM, RB, axios, util, etask, date, Common, StatusCode,
    Domain, Protocol)=>{

let mount, ga_event;
const E = {
    init_ga: ga=>ga_event = ga,
    install: mnt=>{
        E.sp = etask('stats', [function(){ return this.wait(); }]);
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
        return <StatusCode.Row class_value={this.state.class_value}
              class_bw={this.state.class_bw} {...this.props} />;
    }
}

class DomainRow extends StatRow {
    render(){
        return <Domain.Row class_value={this.state.class_value}
              class_bw={this.state.class_bw} {...this.props} />;
    }
}

class ProtoRow extends StatRow {
    render(){
        return <Protocol.Row class_value={this.state.class_value}
              class_bw={this.state.class_bw} {...this.props} />;
    }
}

class StatTable extends React.Component {
    enter = ()=>{
        let dt = this.props.dataType;
        E.sp.spawn(this.sp = etask(function*(){
            yield etask.sleep(2*date.ms.SEC);
            ga_event('stats panel', 'hover', dt);
        }));
    }
    leave = ()=>{
        this.sp.return();
    }
    render(){
        const Table = this.props.table || Common.StatTable;
        return <div onMouseEnter={this.enter} onMouseLeave={this.leave}>
              <Table {...this.props} />
            </div>;
    }
}

class CertificateButton extends React.Component {
    render() {
        return <div className="col-md-6 col-md-offset-3 text-center">
              <Button className="btn btn-success">
                Enable HTTPS statistics</Button>
            </div>;
    }
}

class Stats extends React.Component {
    constructor(props){
        super(props);
        this.state = {
            statuses: {stats: []},
            domains: {stats: []},
            protocols: {stats: []},
        };
    }
    get_stats = etask._fn(function*(_this){
        while (true)
        {
            let res = yield etask(()=>axios.get('/api/request_stats/top'));
            let state = _.reduce(res.data.top, (s, v, k)=>{
                if (_.isInteger(+k))
                    return s.statuses.stats.push({code: k, value: v.count,
                        bw: v.bw}) && s;
                if (['http', 'https'].includes(k))
                {
                    return s.protocols.stats.push({proto: k, bw: v.bw,
                        value: v.count}) && s;
                }
                return s.domains.stats.push({hostname: k, value: v.count,
                    bw: v.bw}) && s;
            }, {statuses: {stats: []}, domains: {stats: []},
                protocols: {stats: []}});
            if (!state.protocols.stats.some(_.matches({proto: 'https'})))
                state.protocols.stats.push({proto: 'https', bw: 0, value: 0});
            for (let k of ['statuses', 'domains', 'protocols'])
            {
                state[k] = {
                    show_more: state[k].stats.length>5,
                    stats: _(state[k].stats).sortBy('value').take(5).reverse()
                    .value(),
                };
            }
            _this.setState(state);
            yield etask.sleep(date.ms.SEC);
        }
    })
    componentDidMount(){
        E.sp.spawn(this.get_stats());
    }
    close = ()=>this.setState({show_reset: false})
    confirm = ()=>this.setState({show_reset: true})
    reset_stats = ()=>{
        if (this.state.resetting)
            return;
        this.setState({resetting: true});
        const _this = this;
        E.sp.spawn(etask(function*(){
            yield etask(()=>axios.get('/api/request_stats/reset'));
            _this.setState({resetting: undefined});
            _this.close();
        }));
    }
    render(){
        const {Button, ButtonToolbar, Row, Col, Panel, Modal} = RB;
        return <Panel header={
                <Row>
                  <Col md={6}>Recent statistics</Col>
                  <Col md={6} className="text-right">
                    <Button bsSize="xsmall" onClick={this.confirm}>
                      Reset</Button>
                  </Col>
                </Row>
              }>
              <StatTable table={StatusCode.Table} row={StatusCodeRow}
                title={`Top ${_.min([5, this.state.statuses.stats.length])||''}
                    status codes`} dataType="status_codes"
                stats={this.state.statuses.stats}
                show_more={this.state.statuses.show_more} />
              <StatTable table={Domain.Table} row={DomainRow}
                dataType="domains" stats={this.state.domains.stats}
                show_more={this.state.domains.show_more}
                title={`Top ${_.min([5, this.state.domains.stats.length])||''}
                    domains`} />
              <StatTable table={Protocol.Table} row={ProtoRow}
                dataType="protocols" stats={this.state.protocols.stats}
                show_more={this.state.protocols.show_more} />
              <Modal show={this.state.show_reset} onHide={this.close}>
                <Modal.Header closeButton>
                  <Modal.Title>Reset stats</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                  <h4>Are you sure you want to reset stats?</h4>
                </Modal.Body>
                <Modal.Footer>
                  <ButtonToolbar>
                    <Button bsStyle="primary" onClick={this.reset_stats}
                      disabled={this.state.resetting}>
                      {this.state.resetting ? 'Resetting...' : 'OK'}
                    </Button>
                    <Button onClick={this.close}>Cancel</Button>
                  </ButtonToolbar>
                </Modal.Footer>
              </Modal>
            </Panel>;
    }
}

return E; });
