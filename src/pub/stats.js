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
import util from './util.js';
import filesaver from 'file-saver';
import Autosuggest from 'react-autosuggest';
import {Pagination} from 'react-bootstrap';
import {If} from '/www/util/pub/react.js';
import $ from 'jquery';

class Stats extends Pure_component {
    constructor(props){
        super(props);
        this.state = {
            entries: [],
            displayed_entries: [],
            filtered_entries: [],
            cur_page: 0,
            preview_entry: {},
            items_per_page: 20,
            sorted: {},
        };
    }
    componentWillMount(){
        const _this = this;
        this.etask(function*(){
            const har = yield ajax.json({url: '/api/request_stats/har'});
            _this.setState({har, entries: har.log.entries},
                _this.apply_filters);
        });
    }
    select_entry(uuid){
        this.setState(prev_state=>{
            const entry = prev_state.entries.filter(s=>s.uuid==uuid)[0]||{};
            return {preview_entry: entry};
        });
    }
    paginate(page=-1){
        page = page>-1 ? page : this.state.cur_page;
        const pages = Math.ceil(
            this.state.entries.length/this.state.items_per_page);
        const cur_page = Math.min(pages, page);
        const displayed_entries = this.state.filtered_entries.slice(
            cur_page*this.state.items_per_page,
            (cur_page+1)*this.state.items_per_page);
        this.setState({
            displayed_entries,
            cur_page,
            preview_entry: {},
        });
    }
    sort(field){
        let dir = 1;
        if (this.state.sorted.field==field)
            dir = -1*this.state.sorted.dir;
        const sorted = this.state.filtered_entries.sort((a, b)=>{
            let a_val = _.get(a, field);
            let b_val = _.get(b, field);
            if (a_val==b_val)
            {
                a_val = a.startedDateTime;
                b_val = b.startedDateTime;
            }
            return a_val > b_val ? 1*dir : -1*dir;
        });
        this.setState({sorted: {field, dir}, filtered_entries: sorted},
            this.paginate);
    }
    apply_filters(filters=[]){
        const filtered_entries = this.state.entries.filter(entry=>{
            return !filters.length||_.some(filters, filter=>{
                if (filter.section=='domain')
                    return filter.value==entry.request.host;
                else if (filter.section=='status code')
                    return filter.value==entry.response.status;
                else
                    return true;
            });
        });
        this.setState({filtered_entries}, this.paginate);
    }
    page_change = page=>this.paginate(page-1);
    download_har(){
        const blob = new Blob([JSON.stringify(this.state.har)],
            {type: "text/plain;charset=utf-8"});
        filesaver.saveAs(blob, 'recent_stats.har');
    }
    render(){
        let pagination = null;
        if (this.state.entries.length>this.state.items_per_page)
        {
            let next = false;
            let pages = Math.ceil(
                this.state.entries.length/this.state.items_per_page);
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
              <Filtering apply_filters={this.apply_filters.bind(this)}/>
              <div>
                <h3 className="top_header">Summary</h3>
                <div className="panel summary_panel">
                  <div className="panel_heading">
                    <h2>Recent Requests</h2>
                    <button onClick={this.download_har.bind(this)}
                      className="btn btn_lpm btn_lpm_normal btn_har">
                      HAR
                    </button>
                  </div>
                  <div className="panel_body">
                    <Main_table entries={this.state.displayed_entries}
                      select_entry={this.select_entry.bind(this)}
                      preview_entry={this.state.preview_entry}
                      sort={this.sort.bind(this)} sorted={this.state.sorted}/>
                    <div className="pagination_panel">{pagination}</div>
                  </div>
                </div>
              </div>
            </div>
        );
    }
}

class Filtering extends Pure_component {
    constructor(props){
        super(props);
        this.state = {value: '', suggestions: [], selected_filters: []};
        this.filters = [{
            title: 'Domains',
            name: 'domain',
            values: ['amazon.com', 'lumtest.com'],
        }, {
            title: 'Status Codes',
            name: 'status code',
            values: ['200', '503', '301'],
        }, {
            title: 'Protocols',
            name: 'protocol',
            values: ['http', 'https'],
        }];
        this.filters.forEach(f=>{
            f.values = f.values.map(v=>({val: v, section: f.name}));
        });
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
    on_suggestion_selected(e, chosen){
        const new_filter = {
            value: chosen.suggestion.val,
            section: chosen.suggestion.section,
        };
        this.setState(prev_state=>({
            selected_filters: [...prev_state.selected_filters, new_filter],
            value: '',
        }), this.apply_current_filters);
    }
    remove_filter(filter){
        this.setState(prev=>({
            selected_filters: prev.selected_filters.filter(f=>f!=filter),
        }), this.apply_current_filters);
    }
    apply_current_filters(){
        this.props.apply_filters(this.state.selected_filters); }
    should_render_suggestions(){ return true; }
    get_suggestions(value){
        const input_value = value.trim().toLowerCase();
        const input_len = input_value.length;
        return input_len==0 ? this.filters : this.filters.filter(f=>
            f.title.toLowerCase().slice(0, input_len)==input_value
        );
    }
    render(){
        const inputProps = {
            placeholder: 'Search requests history',
            value: this.state.value,
            onChange: this.on_input_change,
            className: 'search_input',
        };
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
                {this.state.selected_filters.map(f=>(
                  <div key={f.section+f.value} className="filter">
                    <div className="text">
                      <span className="section">{f.section}: </span>
                      <span className="value">{f.value}</span>
                    </div>
                    <div onClick={()=>this.remove_filter(f)}
                      className="x_btn_wrapper">
                      <div className="x_btn"/>
                    </div>
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
            sort_by: 'request.url',
        }, {
            title: 'Code',
            sort_by: 'response.status',
        }, {
            title: 'Bandwidth',
            sort_by: 'details.bw',
        }, {
            title: 'Date',
            sort_by: 'startedDateTime',
        }, {
            title: 'Time',
            sort_by: 'time',
        }, {
            title: 'Proxy Peer',
            sort_by: 'details.proxy_peer',
        }];
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
              <div className="filler"/>
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

const Tab_nav = props=>(
    <div className="tab_nav">
      <div onClick={props.click_reset} className="tab_btn x_btn"/>
      <Tab_btn set_tab={props.set_tab} title="Headers" id="general"
        curr_tab={props.curr_tab}/>
      <Tab_btn set_tab={props.set_tab} title="Response" id="response"
        curr_tab={props.curr_tab}/>
      <div className="filler"/>
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
    const local = moment(new Date(entry.startedDateTime))
    .format('YYYY-MM-DD HH:mm:ss');
    const active = preview_uuid==entry.uuid;
    return (
        <tr className={classnames({active})}
          onClick={()=>select_entry(entry.uuid)}>
          <td className="fixed_col">
            <Tooltip title={entry.request.url}>{entry.request.host}</Tooltip>
          </td>
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
