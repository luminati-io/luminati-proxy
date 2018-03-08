// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import Pure_component from '../../www/util/pub/pure_component.js';
import React from 'react';
import moment from 'moment';
import classnames from 'classnames';
import setdb from 'hutil/util/setdb';
import etask from 'hutil/util/etask';
import ajax from 'hutil/util/ajax';
import zurl from 'hutil/util/url';
import util from './util.js';
import {Pagination} from 'react-bootstrap';
import {If} from '/www/util/pub/react_util.js';
import $ from 'jquery';

class Stats extends Pure_component {
    constructor(props){
        super(props);
        this.state = {
            entries: [],
            cur_page: 0,
            preview_entry: {},
        };
    }
    componentWillMount(){
        const _this = this;
        this.etask(function*(){
            const har = yield ajax.json({url: '/api/request_stats/har'});
            _this.setState({har, entries: har.log.entries});
        });
    }
    select_entry(uuid){
        this.setState(prev_state=>{
            const entry = prev_state.entries.filter(s=>s.uuid==uuid)[0]||{};
            return {preview_entry: entry};
        });
    }
    render(){
        let pagination = null;
        if (this.state.entries.length>20)
        {
            let next = false;
            let pages = Math.ceil(this.state.entries.length/20);
            if (this.state.cur_page+1<pages)
                next = 'Next';
            pagination = (
                <Pagination next={next} boundaryLinks
                  activePage={this.state.cur_page+1}
                  bsSize="small" onSelect={this.page_change}
                  items={pages} maxButtons={5}/>
            );
        }
        return (
            <div className="lpm stats">
              <div className="panel top_panel">
                <div className="panel_single_heading">
                  <h3>Stats</h3>
                </div>
              </div>
              <div>
                <h3 className="top_header">Summary</h3>
                <div className="panel summary_panel">
                  <div className="panel_heading">
                    <h2>Recent Requests</h2>
                  </div>
                  <div className="panel_body">
                    <Main_table entries={this.state.entries}
                      select_entry={this.select_entry.bind(this)}
                      preview_entry={this.state.preview_entry}/>
                    <div className="pagination_panel">{pagination}</div>
                  </div>
                </div>
              </div>
            </div>
        );
    }
}

class Main_table extends Pure_component {
    constructor(props){
        super(props);
        this.default_state = {curr_tab: 'general'};
        this.state = this.default_state;
    }
    reset(){
        this.props.select_entry(null);
        this.setState(this.default_state);
    }
    set_tab(tab){ this.setState({curr_tab: tab}); }
    render(){
        return (
            <div className="requests_table">
              <If when={this.props.preview_entry&&
                  this.props.preview_entry.uuid}>
                <Tab_nav click_reset={this.reset.bind(this)}
                  curr_tab={this.state.curr_tab}
                  set_tab={this.set_tab.bind(this)}/>
              </If>
              <Preview curr_tab={this.state.curr_tab}
                entry={this.props.preview_entry}/>
              <table>
                <thead>
                  <tr>
                    <th className="fixed_col">Domain</th>
                    <th>Code</th>
                    <th>Bandwidth</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Proxy Peer</th>
                  </tr>
                </thead>
                <tbody>
                  {this.props.entries.map(r=>(
                    <Row select_entry={this.props.select_entry}
                      key={r.uuid} entry={r}
                      preview_uuid={this.props.preview_entry.uuid}/>
                  ))}
                </tbody>
              </table>
            </div>
        );
    }
}

const Tab_nav = props=>(
    <div className="tab_nav">
      <div onClick={props.click_reset} className="x_btn"/>
      <Tab_btn set_tab={props.set_tab} title="General" id="general"
        curr_tab={props.curr_tab}/>
      <Tab_btn set_tab={props.set_tab} title="Response" id="response"
        curr_tab={props.curr_tab}/>
    </div>
);

const Tab_btn = props=>(
    <div onClick={()=>props.set_tab(props.id)}
      className={classnames('tab_btn', {active: props.id==props.curr_tab})}>
      {props.title}
    </div>
);

class Tooltip extends Pure_component {
    componentDidMount(){
        $(this.el).tooltip({
            template: `<div class="stats_tooltip tooltip" role="tooltip">
              <div class="tooltip-arrow"></div>
              <div class="tooltip-inner"></div>
            </div>`,
        });
    }
    ref(el){ this.el = el; }
    render(){
        const {children, title} = this.props;
        return (
            <span style={{display: 'inline-block'}} data-toggle="tooltip"
              data-placement="top" title={title} ref={this.ref.bind(this)}
              data-container="body">
              {children}
            </span>
        );
    }
}

const Row = ({entry, preview_uuid, select_entry})=>{
    const host = zurl.parse(entry.request.url).authority;
    const local = moment(new Date(entry.startedDateTime))
    .format('YYYY-MM-DD HH:mm:ss');
    const active = preview_uuid==entry.uuid;
    return (
        <tr className={classnames({active})}
          onClick={()=>select_entry(entry.uuid)}>
          <td className="fixed_col">
            <Tooltip title={entry.request.url}>{host}</Tooltip>
          </td>
          <td>
            <Tooltip>{entry.response.status}</Tooltip>
          </td>
          <td>{util.bytes_format(entry.details.bw)}</td>
          <td>{local}</td>
          <td>{entry.time} ms</td>
          <td>{entry.details.proxy_peer}</td>
        </tr>
    );
};

const Preview = ({curr_tab, entry})=>{
    if (!entry||!entry.uuid)
        return null;
    const width = 'calc(100% - 200px)';
    const height = 'calc(100% - 76px)';
    const style = {minWidth: width, maxWidth: width, height};
    return (
        <div className="preview" style={style}>
          <If when={curr_tab=='general'}>
            <General_tab status={entry.response.status}
              url={entry.request.url}
              request_headers={entry.request.headers}
              response_headers={entry.response.headers}/>
          </If>
          <If when={curr_tab=='response'}>
            <Response_tab body={'pies'}/>
          </If>
        </div>
    );
};

const General_tab = ({status, url, request_headers, response_headers})=>{
    const general_entries = [{name: 'Request URL', value: url},
        {name: 'Status Code', value: status}];
    return (
        <div className="tab header_tab">
          <Preview_section title="General" pairs={general_entries}/>
          <Preview_section title="Response headers"
            pairs={response_headers}/>
          <Preview_section title="Request headers"
            pairs={request_headers}/>
        </div>
    );
};

const Response_tab = ({body})=>(
    <div className="tab header_tab">
      <Preview_section title="Response body" pairs={[{value: body}]}/>
    </div>
);

const Preview_section = ({title, pairs})=>(
    <div className="section">
      <div className="title">{title}</div>
      {(pairs||[]).map(pair=>
        <Key_value key={pair.value} name={pair.name} value={pair.value}/>
      )}
    </div>
);

const Key_value = ({name, value})=>(
    <div className="key_value">
      <If when={name}><div className="key">{name}</div></If>
      <div className="value">{value}</div>
    </div>
);

export default Stats;
