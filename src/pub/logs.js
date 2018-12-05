// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Har_viewer from './har_viewer.js';
import {withRouter} from 'react-router-dom';
import {Nav_tabs, Tooltip} from './common.js';
import {Chrome_table} from './chrome_widgets.js';
import zurl from '../../util/url.js';
import ajax from '../../util/ajax.js';
import Pure_component from '../../www/util/pub/pure_component.js';
import classnames from 'classnames';
import moment from 'moment';

const Window = ({tab, ...props})=>{
    let Comp;
    switch (tab)
    {
    case 'banned_ips': Comp = Banned_ips; break;
    case 'har':
    default: Comp = Har_viewer;
    }
    return <div style={{flex: 1}} className="window_wrapper vbox">
          <Comp {...props}/>
        </div>;
};

export const Logs = withRouter(class Logs extends Pure_component {
    state = {cur_tab: 'har'};
    click_tab = id=>this.setState({cur_tab: id});
    render(){
        const {location, match} = this.props;
        const qs_o = zurl.qs_parse((location.search||'').substr(1));
        return <div className="logs vbox"
                style={{height: '100%', width: '100%', padding: 15}}>
                <Nav click_tab={this.click_tab} cur_tab={this.state.cur_tab}/>
                <Window tab={this.state.cur_tab} {...qs_o}/>
              </div>;
    }
});

const Nav = ({click_tab, cur_tab})=>
    <Nav_tabs narrow>
      <Tab_btn id="har" on_click={click_tab} title="HAR viewer"
        active={'har'==cur_tab}/>
      <Tab_btn id="banned_ips" on_click={click_tab} title="Banned IPs"
        active={'banned_ips'==cur_tab}/>
    </Nav_tabs>;

const Tab_btn = ({id, on_click, title, tooltip, active})=>
    <Tooltip title={tooltip}>
      <div onClick={()=>on_click(id)}
        className={classnames('btn_tab', {active})}>
        <div className={classnames('icon', id)}/>
        <div className="title">{title}</div>
        <div className="arrow"/>
      </div>
    </Tooltip>;

const banned_ips_cols = [
    {id: 'ip', title: 'IP'},
    {id: 'ms', title: 'Expire'},
];

const Banned_ips = withRouter(class Banned_ips extends Pure_component {
    fetch_data = ()=>{
        return this.etask(function*(){
            const url = `/api/banlist?full=true`;
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

export const Dock_logs = ()=>
    <div className="dock_logs">
      <Har_viewer dock_mode/>
    </div>;
