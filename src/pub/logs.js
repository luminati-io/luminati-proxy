// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import Pure_component from '../../www/util/pub/pure_component.js';
import React from 'react';
import moment from 'moment';
import _ from 'lodash';
import classnames from 'classnames';
import setdb from 'hutil/util/setdb';
import etask from 'hutil/util/etask';
import ajax from 'hutil/util/ajax';
import zurl from 'hutil/util/url';
import zescape from 'hutil/util/escape';
import util from './util.js';
import filesaver from 'file-saver';
import Autosuggest from 'react-autosuggest';
import {If} from '/www/util/pub/react.js';
import $ from 'jquery';
import {Pagination_panel, Tooltip, Link_icon, Loader} from './common.js';

class Logs extends Pure_component {
    constructor(props){
        super(props);
        this.state = {
            reqs: [],
            total: 0,
            cur_page: 0,
            preview_entry: {},
            items_per_page: 20,
            sorted: {field: 'timestamp', dir: 1},
            filters: [],
            selected_filters: {},
        };
    }
    componentDidMount(){
        const _this = this;
        this.etask(function*(){
            const suggestions = yield ajax.json({url: 'api/logs_suggestions'});
            const filters = _this.prepare_filters(suggestions);
            _this.setState({filters});
        });
        setTimeout(()=>{
            const url_o = zurl.parse(document.location.href);
            const qs_o = zurl.qs_parse((url_o.search||'').substr(1));
            const selected_filters = {};
            Object.keys(qs_o).forEach(param=>{
                if (param)
                    selected_filters[param] = [qs_o[param]];
            });
            if (this.props.form)
            {
                selected_filters.port = selected_filters.port||[];
                selected_filters.port.push(''+this.props.form.port);
            }
            this.setState({selected_filters}, this.get_data);
        });
    }
    get_params(opt={}){
        const params = {
            limit: this.state.items_per_page,
            skip: this.state.cur_page*this.state.items_per_page,
        };
        if (opt.no_limit)
            params.limit = 0;
        if (this.state.sorted)
        {
            params.sort = this.state.sorted.field;
            if (this.state.sorted.dir==1)
                params.sort_desc = true;
        }
        Object.entries(this.state.selected_filters).forEach(e=>{
            params[e[0]] = e[1].join(','); });
        return params;
    }
    get_data(){
        const _this = this;
        this.etask(function*(){
            const uri = '/api/logs';
            const params = _this.get_params();
            const url = zescape.uri(uri, params);
            const res = yield ajax.json({url});
            _this.setState({reqs: res.log.entries, total: res.total});
        });
    }
    download_har(){
        const _this = this;
        this.etask(function*(){
            const uri = '/api/logs';
            const params = _this.get_params({no_limit: true});
            const url = zescape.uri(uri, params);
            const res = yield ajax.json({url});
            const blob = new Blob([JSON.stringify({log: res.log})],
                {type: "text/plain;charset=utf-8"});
            filesaver.saveAs(blob, 'logs.har');
        });
    }
    prepare_filters(suggestions){
        const filters = [{
            title: 'Ports',
            name: 'port',
            values: suggestions.ports.map(p=>''+p),
        }, {
            title: 'Domains',
            name: 'domain',
            values: suggestions.domains,
        }, {
            title: 'Status Codes',
            name: 'code',
            values: suggestions.codes.map(c=>''+c),
        }, {
            title: 'Protocols',
            name: 'protocol',
            values: suggestions.protocols,
        }].filter(f=>f.name!='port'||!this.props.form);
        filters.forEach(f=>{
            f.values = f.values.map(v=>({val: v, section: f.name}));
        });
        return filters;
    }
    select_entry(uuid){
        this.setState(prev_state=>{
            const entry = prev_state.reqs.filter(s=>s.uuid==uuid)[0]||{};
            return {preview_entry: entry};
        });
    }
    update_items_per_page(items_per_page){
        this.setState({items_per_page, cur_page: 0}, this.get_data); }
    update_page(page){
        this.setState({cur_page: page-1}, this.get_data); }
    sort(field){
        let dir = 1;
        if (this.state.sorted.field==field)
            dir = -1*this.state.sorted.dir;
        this.setState({sorted: {field, dir}}, this.get_data);
    }
    add_filter(section, val){
        this.setState(prev_state=>({
            selected_filters: {
                ...prev_state.selected_filters,
                [section]: [...(prev_state.selected_filters[section]||[]), val]
            },
            cur_page: 0,
        }), this.get_data);
    }
    remove_filter(section, val){
        this.setState(prev=>({
            selected_filters: {
                ...prev.selected_filters,
                [section]: prev.selected_filters[section].filter(f=>f!=val),
            },
        }), this.get_data);
    }
    render(){
        return (
            <div className="lpm logs">
              <Loader show={this.state.show_loader}/>
              <div>
                <div className="panel logs_panel">
                  <div className="panel_heading">
                    <h2>Recent Requests</h2>
                    <Filtering
                      port_page={!!this.props.form}
                      add_filter={this.add_filter.bind(this)}
                      remove_filter={this.remove_filter.bind(this)}
                      selected_filters={this.state.selected_filters}
                      filters={this.state.filters}/>
                  </div>
                  <div className="panel_body with_table">
                    <Logs_pagination
                      total={this.state.total}
                      top
                      download_har={this.download_har.bind(this)}
                      items_per_page={this.state.items_per_page}
                      update_items_per_page={this.update_items_per_page.bind(this)}
                      update_page={this.update_page.bind(this)}
                      cur_page={this.state.cur_page}
                      update_items_page_page={()=>null}/>
                    <Main_table
                      entries={this.state.reqs}
                      select_entry={this.select_entry.bind(this)}
                      preview_entry={this.state.preview_entry}
                      sort={this.sort.bind(this)}
                      sorted={this.state.sorted}/>
                    <Logs_pagination
                      total={this.state.total}
                      bottom
                      download_har={this.download_har.bind(this)}
                      items_per_page={this.state.items_per_page}
                      update_items_per_page={this.update_items_per_page.bind(this)}
                      update_page={this.update_page.bind(this)}
                      cur_page={this.state.cur_page}
                      update_items_page_page={()=>null}/>
                  </div>
                </div>
              </div>
            </div>
        );
    }
}

const Logs_pagination = ({entries, items_per_page, cur_page, bottom,
    top, update_page, update_items_per_page, download_har, total})=>
(
    <Pagination_panel entries={entries} items_per_page={items_per_page}
      cur_page={cur_page} page_change={update_page} top={top} bottom={bottom}
      update_items_per_page={update_items_per_page} total={total}>
        <Tooltip title="Download all logs as HAR">
          <span className="icon_link" onClick={download_har}>
            <i className="glyphicon glyphicon-download"></i>
          </span>
        </Tooltip>
    </Pagination_panel>
);

class Filtering extends Pure_component {
    constructor(props){
        super(props);
        this.state = {value: '', suggestions: []};
    }
    on_input_change = (e, ref)=>{
        this.setState({value: ref.newValue}); };
    on_suggestions_fetch_requested = ({value})=>{
        this.setState({suggestions: this.get_suggestions(value)}); };
    on_suggestions_clear_requested = ()=>{
        this.setState({suggestions: []}); };
    render_section_title(section){ return section.title; }
    render_suggestion(suggestion){ return suggestion.val; }
    get_section_suggestions(section){ return section.values; }
    get_suggestion_value(s){ return s.val; }
    should_render_suggestions(){ return true; }
    get_suggestions(value){
        const input_value = value.trim().toLowerCase();
        const input_len = input_value.length;
        const unsel_filters = this.props.filters.reduce((acc, e)=>{
            const sel_values = this.props.selected_filters[e.name]||[];
            const unsel_values = e.values.filter(v=>
                !sel_values.includes(v.val));
            if (unsel_values.length)
                return acc.concat({...e, values: unsel_values});
            return acc;
        }, []);
        if (input_len==0)
            return unsel_filters;
        const _this = this;
        return unsel_filters.reduce((acc, e)=>{
            if (e.title.toLowerCase().slice(0, input_len)==input_value)
                return acc.concat(e);
            const values = e.values.filter(v=>
                v.val.toLowerCase().slice(0, input_len)==input_value);
            if (values.length)
                return acc.concat(Object.assign(e, {values}));
            return acc;
        }, []);
    }
    on_suggestion_selected(e, chosen){
        const {val, section} = chosen.suggestion;
        this.props.add_filter(section, val);
        this.setState({value: ''});
    }
    render(){
        const inputProps = {
            placeholder: 'Search requests history',
            value: this.state.value,
            onChange: this.on_input_change,
            className: 'search_input',
        };
        const filters = Object.entries(this.props.selected_filters)
        .filter(f=>f[0]!='port'||!this.props.port_page)
        .reduce((acc, e)=>
            acc.concat(e[1].map(f=>({section: e[0], val: f}))), []);
        return (
            <div className="filtering">
              <Autosuggest suggestions={this.state.suggestions}
                onSuggestionsFetchRequested={this.on_suggestions_fetch_requested}
                onSuggestionsClearRequested={this.on_suggestions_clear_requested}
                getSuggestionValue={this.get_suggestion_value}
                renderSuggestion={this.render_suggestion}
                renderSectionTitle={this.render_section_title}
                getSectionSuggestions={this.get_section_suggestions}
                inputProps={inputProps} multiSection
                shouldRenderSuggestions={this.should_render_suggestions}
                onSuggestionSelected={this.on_suggestion_selected.bind(this)}/>
              <div className="filters_list">
                {filters.map(f=>(
                  <div key={f.section+f.val} className="filter">
                    <div className="text">
                      <span className="section">{f.section}: </span>
                      <span className="value">{f.val}</span>
                    </div>
                    <Link_icon tooltip="Remove filter" id="remove" small
                      on_click={()=>this.props.remove_filter(f.section, f.val)}
                      classes="remove_filter_btn"/>
                  </div>
                ))}
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
        this.columns = [{
            title: 'Domain',
            class_name: 'fixed_col',
            sort_by: 'url',
        }, {
            title: 'Port',
            sort_by: 'port',
        }, {
            title: 'Code',
            sort_by: 'status_code',
        }, {
            title: 'Bandwidth',
            sort_by: 'bw',
        }, {
            title: 'Date',
            sort_by: 'timestamp',
        }, {
            title: 'Time',
            sort_by: 'elapsed',
        }, {
            title: 'Proxy Peer',
            sort_by: 'proxy_peer',
        }];
    }
    reset(){
        this.props.select_entry(null);
        this.setState(this.default_state);
    }
    set_tab(tab){ this.setState({curr_tab: tab}); }
    render(){
        const open = this.props.preview_entry&&this.props.preview_entry.uuid;
        return (
            <div className={classnames('requests_table', {open})}>
              <If when={open}>
                <Tab_nav click_reset={this.reset.bind(this)}
                  curr_tab={this.state.curr_tab}
                  set_tab={this.set_tab.bind(this)}/>
              </If>
              <Preview curr_tab={this.state.curr_tab}
                entry={this.props.preview_entry}/>
              <table>
                <thead>
                  <tr>
                    {this.columns.map(c=>(
                      <Column key={c.title} col={c} sort={this.props.sort}
                        sorted={this.props.sorted}/>
                    ))}
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

const Column = ({col, sort, sorted})=>{
    const glyph_class = classnames('glyphicon', 'sort_arrow', {
        'glyphicon-chevron-up': sorted.field==col.sort_by && sorted.dir==1,
        'glyphicon-chevron-down': sorted.field==col.sort_by && sorted.dir==-1,
        'glyphicon-chevron-down invisible': sorted.field!=col.sort_by,
    });
    return (
        <th onClick={()=>sort(col.sort_by)}
          className={col.class_name}>
          {col.title}
          <span className={glyph_class}/>
        </th>
    );
};

const Tab_btn = props=>(
    <div onClick={()=>props.set_tab(props.id)}
      className={classnames('tab_btn', {active: props.id==props.curr_tab})}>
      {props.title}
    </div>
);

const Row = ({entry, preview_uuid, select_entry})=>{
    const local = moment(new Date(entry.startedDateTime))
    .format('YYYY-MM-DD HH:mm:ss');
    const active = preview_uuid==entry.uuid;
    let host;
    if (entry.request.host.length>25)
        host = entry.request.host.slice(0, 22)+'...';
    else
        host = entry.request.host;
    return (
        <tr className={classnames({active})}
          onClick={()=>select_entry(entry.uuid)}>
          <td className="fixed_col">
            <Tooltip title={entry.request.url}>{host}</Tooltip>
          </td>
          <td>{entry.details.port}</td>
          <td>
            <Tooltip title={entry.response.statusText}>
              {entry.response.status}</Tooltip>
          </td>
          <td>{util.bytes_format(entry.details.bw)}</td>
          <td>{local}</td>
          <td>{entry.time} ms</td>
          <td>{entry.details.proxy_peer}</td>
        </tr>
    );
};

const panel_width = 'calc(100% - 179px)';

const Tab_nav = props=>{
    const style = {minWidth: panel_width, maxWidth: panel_width};
    return (
        <div className="tab_nav" style={style}>
          <div className="close_btn">
            <Link_icon tooltip="Close" id="remove" on_click={props.click_reset}
              small/>
          </div>
          <Tab_btn set_tab={props.set_tab} title="Headers" id="general"
            curr_tab={props.curr_tab}/>
          <Tab_btn set_tab={props.set_tab} title="Response" id="response"
            curr_tab={props.curr_tab}/>
          <div className="filler"/>
        </div>
    );
};

const Preview = ({curr_tab, entry})=>{
    if (!entry||!entry.uuid)
        return null;
    const height = '400px';
    const min_height = 'calc(100% - 57px)';
    const style = {minWidth: panel_width, maxWidth: panel_width, height,
        minHeight: min_height};
    return (
        <div className="preview" style={style}>
          <If when={curr_tab=='general'}>
            <General_tab status={entry.response.status}
              url={entry.request.url}
              request_headers={entry.request.headers}
              response_headers={entry.response.headers}/>
          </If>
          <If when={curr_tab=='response'}>
            <Response_tab body={entry.response.content.text}/>
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

class Preview_section extends Pure_component {
    constructor(props){
        super(props);
        this.state = {open: true};
    }
    toggle(){ this.setState(prev=>({open: !prev.open})); }
    render(){
        const glyph_class = classnames('glyphicon sort_arrow', {
            'glyphicon-chevron-down': this.state.open,
            'glyphicon-chevron-right': !this.state.open,
        });
        return (
            <div className="section">
              <div className="title" onClick={this.toggle.bind(this)}>
                <span className={glyph_class}/>
                {this.props.title}
              </div>
              <If when={this.state.open}>
                {(this.props.pairs||[]).map(pair=>
                  <Key_value key={pair.value} name={pair.name}
                    value={pair.value}/>
                )}
              </If>
            </div>
        );
    }
}

const Key_value = ({name, value})=>(
    <div className="key_value">
      <If when={name}><div className="key">{name}:</div></If>
      <div className="value">{value}</div>
    </div>
);

export default Logs;
