// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import ajax from '../../../util/ajax.js';
import {Chrome_table} from '../chrome_widgets.js';
import Pure_component from '../../../www/util/pub/pure_component.js';
import {Nav_tabs, Nav_tab} from '../common.js';
import moment from 'moment';
import {withRouter} from 'react-router-dom';
import Har_viewer from '../har_viewer.js';

moment.relativeTimeThreshold('ss', 3);

export default class Logs extends Pure_component {
    state = {cur_tab: 'har'};
    set_tab = id=>this.setState({cur_tab: id});
    render(){
        return <div className="vbox" style={{height: '100%', width: '100%'}}>
              <Nav set_tab={this.set_tab} cur_tab={this.state.cur_tab}/>
              <Window tab={this.state.cur_tab}/>
            </div>;
    }
}

const Window = ({tab})=>{
    let Comp;
    switch (tab)
    {
    case 'sessions': Comp = Sessions; break;
    case 'banned_ips': Comp = Banned_ips; break;
    case 'har':
    default: Comp = Har_viewer;
    }
    return <div className="window_wrapper vbox">
          <Comp/>
        </div>;
};

const Nav = ({set_tab, cur_tab})=>
    <Nav_tabs narrow set_tab={set_tab} cur_tab={cur_tab}>
      <Nav_tab id="har" title="HAR viewer"/>
      <Nav_tab id="sessions" title="Sessions"/>
      <Nav_tab id="banned_ips" title="Banned IPs"/>
    </Nav_tabs>;

const banned_ips_cols = [
    {id: 'ip', title: 'IP'},
    {id: 'ms', title: 'Expire'},
];

const Banned_ips = withRouter(class Banned_ips extends Pure_component {
    fetch_data = ()=>{
        const _this = this;
        return this.etask(function*(){
            const port = _this.props.match.params.port;
            const url = `/api/banlist/${port}?full=true`;
            const data = yield ajax.json({url});
            return data.ips;
        });
    };
    render(){
        return <Chrome_table title="Sessions" cols={banned_ips_cols}
              fetch_data={this.fetch_data}>
              {d=>
                <tr key={d.ip}>
                  <td>{d.ip}</td>
                  <td>{d.to ? moment(d.to).fromNow() : ' - '}</td>
                </tr>
              }
            </Chrome_table>;
    }
});

const sessions_cols = [
    {id: 'ip', title: 'Last IP'},
    {id: 'session', title: 'Session'},
    {id: 'host', title: 'Host'},
];

const Sessions = withRouter(class Sessions extends Pure_component {
    fetch_data = ()=>{
        const _this = this;
        return this.etask(function*(){
            const port = _this.props.match.params.port;
            const url = `/api/sessions/${port}`;
            const res = yield ajax.json({url});
            return res.sessions;
        });
    };
    render(){
        return <Chrome_table title="Sessions" cols={sessions_cols}
              fetch_data={this.fetch_data}>
              {d=>
                <tr key={d.session}>
                  <td>{d.ip ? d.ip : ' - '}</td>
                  <td>{d.session}</td>
                  <td>{d.host}</td>
                </tr>
              }
            </Chrome_table>;
    }
});
