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
import Tooltip from '../common/tooltip.js';
import {T} from '../common/i18n.js';

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
      <Nav_tab id="banned_ips" title="lpm_banned_ip"/>
    </Nav_tabs>;

const banned_ips_cols = [
    {id: 'unban', width: 25},
    {id: 'ip', title: 'IP'},
    {id: 'domain', title: 'Domain'},
    {id: 'ms', title: 'Expire'},
];

const Banned_ips = withRouter(class Banned_ips extends Pure_component {
    state = {ips: [], unbanning: false};
    componentDidMount(){
        this.fetch_ips_data();
    }
    fetch_ips_data = ()=>{
        const _this = this;
        return this.etask(function*(){
            const port = _this.props.match.params.port;
            const url = `/api/banlist/${port}?full=true`;
            const data = yield ajax.json({url});
            _this.setState({ips: data.ips});
        });
    };
    unbanip = (ip, domain)=>{
        const _this = this;
        this.setState({unbanning: true});
        return this.etask(function*(){
            this.on('finally', ()=>_this.setState({unbanning: false}));
            const port = _this.props.match.params.port;
            const data = yield ajax.json({
                url: `/api/proxies/${port}/unbanip`,
                method: 'POST',
                data: {ip, domain},
            });
            _this.setState({ips: data.ips});
        });
    };
    render(){
        const {ips, unbanning} = this.state;
        if (setdb.get('head.proxy_edit.form.ext_proxies'))
            return <Note><Ext_tooltip/></Note>;
        return <Chrome_table
            title={<T>{t=>t('lpm_banned_ip')+` (${ips.length})`}</T>}
            cols={banned_ips_cols} class_name="banned_ips_panel">
              {ips.map(d=>
                <tr key={`${d.ip}-${d.domain}`}>
                  <td>
                    <Tooltip title="Unban IP">
                      <button className="btn_unban" disabled={unbanning}
                        onClick={()=>this.unbanip(d.ip, d.domain)}>
                        <i className="chrome_icon return"/>
                      </button>
                    </Tooltip>
                  </td>
                  <td>{d.ip}</td>
                  <td>{d.domain||' - '}</td>
                  <td>{d.to ? moment(d.to).fromNow() : ' - '}</td>
                </tr>
              )}
            </Chrome_table>;
    }
});

