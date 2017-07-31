// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import regeneratorRuntime from 'regenerator-runtime';
import _ from 'lodash';
import React from 'react';
import ReactDOM from 'react-dom';
import {Button, ButtonToolbar, Row, Col, Panel, Modal} from 'react-bootstrap';
import util from 'app/util.js';
import etask from 'hutil/util/etask';
import date from 'hutil/util/date';
import Common from './common.js';
import StatusCode from './status_codes.js';
import Domain from './domains.js';
import Protocol from './protocols.js';
import 'animate.css';

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
    };
    leave = ()=>{
        if (this.sp)
            this.sp.return();
    };
    render(){
        const Table = this.props.table || Common.StatTable;
        return <div onMouseEnter={this.enter} onMouseLeave={this.leave}>
              <Table {...this.props} />
            </div>;
    }
}

class CertificateButton extends React.Component {
    render(){
        return <Col md={6} mdOffset={3} className="text-center">
              <Button bsStyle="success">Enable HTTPS statistics</Button>
            </Col>;
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
        this.catch(e=>console.log(e));
        while (true)
        {
            _this.setState(yield Common.StatsService.get_top({sort: 'value',
                limit: 5}));
            yield etask.sleep(date.ms.SEC);
        }
    });
    componentDidMount(){
        E.sp.spawn(this.get_stats());
    }
    close = ()=>this.setState({show_reset: false});
    confirm = ()=>this.setState({show_reset: true});
    reset_stats = ()=>{
        if (this.state.resetting)
            return;
        this.setState({resetting: true});
        const _this = this;
        E.sp.spawn(etask(function*(){
            yield Common.StatsService.reset();
            _this.setState({resetting: undefined});
            _this.close();
        }));
    };
    render(){
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
                show_more={this.state.statuses.has_more} />
              <StatTable table={Domain.Table} row={DomainRow}
                dataType="domains" stats={this.state.domains.stats}
                show_more={this.state.domains.has_more}
                title={`Top ${_.min([5, this.state.domains.stats.length])||''}
                  domains`} />
              <StatTable table={Protocol.Table} row={ProtoRow}
                dataType="protocols" stats={this.state.protocols.stats}
                show_more={this.state.protocols.has_more} />
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

export default E;
