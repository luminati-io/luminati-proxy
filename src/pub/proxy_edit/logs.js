// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import ajax from '../../../util/ajax.js';
import {Chrome_table} from '../chrome_widgets.js';
import Pure_component from '/www/util/pub/pure_component.js';
import {Note, Ext_tooltip} from '../common.js';
import moment from 'moment';
import {withRouter, Switch, Route, Redirect} from 'react-router-dom';
import Har_viewer from '../har_viewer.js';
import setdb from '../../../util/setdb.js';
import {Nav_tabs, Nav_tab} from '../common/nav_tabs.js';

moment.relativeTimeThreshold('ss', 60);
moment.relativeTimeThreshold('s', 50);

const Logs = withRouter(class Logs extends Pure_component {
    set_tab = id=>{
        const port = this.props.match.params.port;
        const pathname = `/proxy/${port}/logs/${id}`;
        this.props.history.push({pathname});
    };
    render(){
        const path = this.props.match.path;
        return <div className="in_logs vbox"
              style={{height: '100%', width: '100%'}}>
              <Nav set_tab={this.set_tab}/>
              <div className="window_wrapper vbox">
                <Switch>
                  <Route path={`${path}/sessions`} component={Sessions}/>
                  <Route path={`${path}/banned_ips`} component={Banned_ips}/>
                  <Route path={`${path}/har`} component={Har_viewer}/>
                  <Route exact path={path} component={({location})=>
                    <Redirect to={`${location.pathname}/har`}/>}/>
                </Switch>
              </div>
            </div>;
    }
});

export default Logs;

const Nav = ({set_tab, cur_tab})=>
    <Nav_tabs narrow set_tab={set_tab} cur_tab={cur_tab}>
      <Nav_tab id="har" title="HAR viewer"/>
      <Nav_tab id="sessions" title="Sessions"/>
      <Nav_tab id="banned_ips" title="Banned IPs"/>
    </Nav_tabs>;

const banned_ips_cols = [
    {id: 'ip', title: 'IP'},
    {id: 'domain', title: 'Domain'},
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
        if (setdb.get('head.proxy_edit.form.ext_proxies'))
            return <Note><Ext_tooltip/></Note>;
        return <Chrome_table title="Sessions" cols={banned_ips_cols}
              fetch_data={this.fetch_data}>
              {d=>
                <tr key={d.ip}>
                  <td>{d.ip}</td>
                  <td>{d.domain||' - '}</td>
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
    {id: 'created', title: 'Created'},
];

const Sessions = withRouter(class Sessions extends Pure_component {
    state = {sessions: 0};
    fetch_data = ()=>{
        const _this = this;
        return this.etask(function*(){
            const port = _this.props.match.params.port;
            const url = `/api/sessions/${port}`;
            const res = yield ajax.json({url});
            _this.setState({sessions: res.sessions});
            return res.sessions;
        });
    };
    render(){
        if (setdb.get('head.proxy_edit.form.ext_proxies'))
            return <Note><Ext_tooltip/></Note>;
        const sessions_n = (this.state.sessions||[]).length;
        const title = `Sessions (${sessions_n})`;
        const port = this.props.match.params.port;
        return <Chrome_table title={title} cols={sessions_cols}
              fetch_data={this.fetch_data}>
              {data=><Session_row data={data} key={data.session} port={port}/>}
            </Chrome_table>;
    }
});

class Session_row extends Pure_component {
    state = {};
    componentDidMount(){
        const session = this.props.data.session;
        const port = this.props.port;
        this.setdb_on('ws.sessions.'+port+'.'+session, data=>{
            if (!data)
                return;
            this.setState(data);
        });
    }
    render(){
        const data = this.props.data;
        const ip = this.state.ip||data.ip;
        const host = this.state.host||data.host;
        return <tr>
              <td>{ip ? ip : ' - '}</td>
              <td>{data.session}</td>
              <td>{host}</td>
              <Created_cell created={data.created}/>
            </tr>;
    }
}

class Created_cell extends Pure_component {
    state = {};
    componentDidMount(){
        const _this = this;
        let timer = 0;
        this.interval = setInterval(()=>{
            timer++;
            _this.setState({timer});
        }, 10*1000);
    }
    willUnmount(){
        clearInterval(this.interval);
    }
    render(){
        const {created} = this.props;
        return <td>{moment(created).fromNow()}</td>;
    }
}
