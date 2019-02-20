// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import Pure_component from '/www/util/pub/pure_component.js';
import React from 'react';
import $ from 'jquery';
import _ from 'lodash';
import moment from 'moment';
import classnames from 'classnames';
import {withRouter} from 'react-router-dom';
import React_tooltip from 'react-tooltip';
import setdb from '../../util/setdb.js';
import ajax from '../../util/ajax.js';
import zescape from '../../util/escape.js';
import {status_codes, bytes_format} from './util.js';
import Waypoint from 'react-waypoint';
import {Toolbar_button, Devider, Sort_icon, with_resizable_cols,
    Toolbar_container, Toolbar_row, Tooltip} from './chrome_widgets.js';
import Preview from './har_preview.js';
import {Tooltip_bytes, Checkbox} from './common.js';
import ws from './ws.js';

const loader = {
    start: ()=>$('#har_viewer').addClass('waiting'),
    end: ()=>$('#har_viewer').removeClass('waiting'),
};

class Har_viewer extends Pure_component {
    moving_width = false;
    min_width = 50;
    state = {
        cur_preview: null,
        tables_width: 200,
        search: this.props.domain||'',
        type_filter: 'All',
        filters: {
            port: this.props.port||false,
            status_code: this.props.code||false,
            protocol: this.props.protocol||false,
        },
    };
    componentDidMount(){
        window.document.addEventListener('mousemove', this.on_mouse_move);
        window.document.addEventListener('mouseup', this.on_mouse_up);
        this.setdb_on('head.proxies_running', proxies=>{
            if (proxies)
                this.setState({proxies});
        });
        this.etask(function*(){
            const suggestions = yield ajax.json(
                {url: '/api/logs_suggestions'});
            setdb.set('head.logs_suggestions', suggestions);
        });
    }
    willUnmount(){
        loader.end();
        window.document.removeEventListener('mousemove', this.on_mouse_move);
        window.document.removeEventListener('mouseup', this.on_mouse_up);
    }
    open_preview = req=>this.setState({cur_preview: req});
    close_preview = ()=>this.setState({cur_preview: null});
    start_moving_width = e=>{
        if (e.nativeEvent.which!=1)
            return;
        this.moving_width = true;
        $(this.main_panel).addClass('moving');
        this.start_offset = e.pageX;
        this.start_width = this.state.tables_width;
    };
    on_resize_width = e=>{
        const offset = e.pageX-this.start_offset;
        let new_width = this.start_width+offset;
        if (new_width<this.min_width)
            new_width = this.min_width;
        const max_width = this.main_panel.offsetWidth-this.min_width;
        if (new_width>max_width)
            new_width = max_width;
        this.setState({tables_width: new_width});
    };
    on_mouse_move = e=>{
        if (this.moving_width)
            this.on_resize_width(e);
    };
    on_mouse_up = ()=>{
        this.moving_width = false;
        $(this.main_panel).removeClass('moving');
    };
    clear = ()=>{
        const _this = this;
        this.etask(function*(){
            loader.start();
            yield ajax({url: '/api/logs_reset'});
            _this.close_preview();
            setdb.emit_path('head.har_viewer.reset_reqs');
            loader.end();
        });
    };
    set_main_panel_ref = ref=>{ this.main_panel = ref; };
    main_panel_moving = ()=>{ $(this.main_panel).addClass('moving'); };
    main_panel_stopped_moving = ()=>{
        $(this.main_panel).removeClass('moving'); };
    on_change_search = e=>{ this.setState({search: e.target.value}); };
    set_type_filter = name=>{ this.setState({type_filter: name}); };
    set_filter = (name, {target: {value}})=>{
        this.setState(prev=>({filters: {...prev.filters, [name]: value}}));
    };
    undock = ()=>{
        if (this.props.dock_mode)
            return;
        const url = '/dock_logs';
        const opts = 'directories=0,titlebar=0,toolbar=0,location=0,'
        +'status=0,menubar=0,scrollbars=0,resizable=0,height=500,'
        +'width=800';
        const har_window = window.open(url, 'har_window', opts);
        if (window.focus)
            har_window.focus();
    };
    render(){
        if (!this.state.proxies)
            return null;
        const width = `calc(100% - ${this.state.tables_width}px`;
        const preview_style = {maxWidth: width, minWidth: width};
        return <div id="har_viewer" className="har_viewer chrome">
              <div className="main_panel vbox" ref={this.set_main_panel_ref}>
                <Toolbar
                  undock={this.undock}
                  dock_mode={this.props.dock_mode}
                  master_port={this.props.master_port}
                  filters={this.state.filters}
                  set_filter={this.set_filter}
                  proxies={this.state.proxies}
                  type_filter={this.state.type_filter}
                  set_type_filter={this.set_type_filter}
                  clear={this.clear}
                  on_change_search={this.on_change_search}
                  search_val={this.state.search}/>
                <div className="split_widget vbox flex_auto">
                  <Tables_container
                    key={''+this.props.master_port}
                    master_port={this.props.master_port}
                    main_panel_moving={this.main_panel_moving}
                    main_panel_stopped_moving={this.main_panel_stopped_moving}
                    main_panel={this.main_panel}
                    open_preview={this.open_preview}
                    width={this.state.tables_width}
                    search={this.state.search}
                    type_filter={this.state.type_filter}
                    filters={this.state.filters}
                    cur_preview={this.state.cur_preview}/>
                  <Preview cur_preview={this.state.cur_preview}
                    style={preview_style}
                    close={this.close_preview}/>
                  <Tables_resizer show={!!this.state.cur_preview}
                    start_moving={this.start_moving_width}
                    offset={this.state.tables_width}/>
                </div>
              </div>
            </div>;
    }
}

class Toolbar extends Pure_component {
    state = {select_visible: false, filters_visible: false,
        actions_visible: false};
    componentDidMount(){
        this.setdb_on('har_viewer.select_visible', visible=>
            this.setState({select_visible: visible}));
        this.setdb_on('har_viewer.select_mode', actions_visible=>
            this.setState({actions_visible}));
    }
    toggle_filters = ()=>
        this.setState({filters_visible: !this.state.filters_visible});
    toggle_actions = ()=>{
        setdb.set('har_viewer.select_mode', !this.state.actions_visible);
    };
    render(){
        const {clear, search_val, on_change_search, type_filter,
            set_type_filter, filters, set_filter, master_port, undock,
            dock_mode} = this.props;
        return <Toolbar_container>
              <Toolbar_row>
                <Toolbar_button id="clear" tooltip="Clear" on_click={clear}/>
                {!dock_mode &&
                  <Toolbar_button id="docker"
                    tooltip="Undock into separate window" on_click={undock}/>
                }
                <Toolbar_button id="filters" tooltip="Show/hide filters"
                  on_click={this.toggle_filters}
                  active={this.state.filters_visible}/>
                <Toolbar_button id="download" tooltip="Export as HAR file"
                  href="/api/logs_har"/>
                <Toolbar_button id="actions" on_click={this.toggle_actions}
                  active={this.state.actions_visible}
                  tooltip="Show/hide additional actions"/>
              </Toolbar_row>
              {this.state.actions_visible &&
                <Toolbar_row>
                  <Actions/>
                </Toolbar_row>
              }
              {this.state.filters_visible &&
                <Toolbar_row>
                  <Search_box val={search_val} on_change={on_change_search}/>
                  <Type_filters filter={type_filter} set={set_type_filter}/>
                  <Devider/>
                  <Filters set_filter={set_filter} filters={filters}
                    master_port={master_port}/>
                </Toolbar_row>
              }
            </Toolbar_container>;
    }
}

class Actions extends Pure_component {
    state = {any_checked: false};
    componentDidMount(){
        this.setdb_on('har_viewer.checked_list', list=>{
            if (!list)
                return;
            const any_checked = Object.keys(list).filter(o=>list[o]).length;
            this.setState({any_checked});
        });
    }
    resend = ()=>{
        const list = setdb.get('har_viewer.checked_list')||[];
        if (!Object.keys(list).length)
            return;
        const uuids = Object.keys(list).filter(o=>list[o]);
        this.etask(function*(){
            this.on('uncaught', console.error);
            yield window.fetch('/api/logs_resend', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({uuids}),
            });
        });
    };
    render(){
        const resend_classes = classnames('filter',
            {disabled: !this.state.any_checked});
        return <div className="actions">
                <div className="filters">
                  <Tooltip title="Resend requests" placement="bottom">
                    <div className={resend_classes}
                      onClick={this.resend}>Resend</div>
                  </Tooltip>
                </div>
            </div>;
    }
}

class Filters extends Pure_component {
    state = {};
    componentDidMount(){
        this.setdb_on('head.logs_suggestions', suggestions=>{
            suggestions && this.setState({suggestions});
        });
    }
    render(){
        if (!this.state.suggestions)
            return null;
        const filters = [
            {
                name: 'port',
                default_value: this.props.master_port ?
                    `Multiplied ${this.props.master_port}` : 'All proxy ports',
                tooltip: 'Filter requests by ports',
            },
            {
                name: 'status_code',
                default_value: 'All status codes',
                tooltip: 'Filter requests by status codes',
            },
            {
                name: 'protocol',
                default_value: 'All protocols',
                tooltip: 'Filter requests by protocols',
            },
        ];
        return <div className="filters">
          {filters.map(f=>
            <Filter key={f.name} tooltip={f.tooltip}
              vals={this.state.suggestions[f.name+'s']}
              val={this.props.filters[f.name]}
              set={this.props.set_filter.bind(null, f.name)}
              default_value={f.default_value}/>
          )}
        </div>;
    }
}

const Filter = ({vals, val, set, default_value, tooltip})=>
    <Tooltip title={tooltip} placement="bottom">
      <div className="custom_filter">
        <select value={val} onChange={set}>
          <option value="">{default_value}</option>
          {vals.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <span className="arrow"/>
      </div>
    </Tooltip>;

const type_filters = [{name: 'XHR', tooltip: 'XHR and fetch'},
    {name: 'HTML', tooltip: 'HTML'}, {name: 'JS', tooltip: 'Scripts'},
    {name: 'CSS', tooltip: 'Stylesheets'}, {name: 'Img', tooltip: 'Images'},
    {name: 'Media', tooltip: 'Media'}, {name: 'Font', tooltip: 'Fonts'},
    {name: 'Other', tooltip: 'Other'}];
const Type_filters = ({filter, set})=>
    <div className="filters">
      <Type_filter name="All" on_click={set.bind(null, 'All')} cur={filter}
        tooltip="All types"/>
      <Devider/>
      {type_filters.map(f=>
        <Type_filter on_click={set.bind(null, f.name)} key={f.name}
          name={f.name} cur={filter} tooltip={f.tooltip}/>
      )}
    </div>;

const Type_filter = ({name, cur, tooltip, on_click})=>
    <Tooltip title={tooltip} placement="bottom">
      <div className={classnames('filter', {active: cur==name})}
        onClick={on_click}>{name}</div>
    </Tooltip>;

const Search_box = ({val, on_change})=>
    <div className="search_box">
      <input value={val}
        onChange={on_change}
        type="text"
        placeholder="Filter"/>
    </div>;

const Tables_resizer = ({show, offset, start_moving})=>{
    if (!show)
        return null;
    return <div className="data_grid_resizer" style={{left: offset-2}}
      onMouseDown={start_moving}/>;
};

const table_cols = [
    {title: 'select', hidden: true, fixed: 27, tooltip: 'Select/unselect all'},
    {title: 'Name', sort_by: 'url', data: 'request.url',
        tooltip: 'Request url'},
    {title: 'Proxy port', sort_by: 'port', data: 'details.port'},
    {title: 'Status', sort_by: 'status_code', data: 'response.status',
        tooltip: 'Status code'},
    {title: 'Bandwidth', sort_by: 'bw', data: 'details.bw'},
    {title: 'Time', sort_by: 'elapsed', data: 'time'},
    {title: 'Peer proxy', sort_by: 'proxy_peer',
        data: 'details.proxy_peer'},
    {title: 'Date', sort_by: 'timestamp', data: 'details.timestamp'},
];
const Tables_container = withRouter(with_resizable_cols(table_cols,
class Tables_container extends Pure_component {
    constructor(props){
        super(props);
        this.uri = '/api/logs';
        this.batch_size = 30;
        this.loaded = {from: 0, to: 0};
        this.state = {
            focused: false,
            reqs: [],
            sorted: {field: 'timestamp', dir: 1},
        };
        this.reqs_to_render = [];
        this.reqs_to_abort = [];
        this.take_reqs_from_pool = _.throttle(this.take_reqs_from_pool, 100);
    }
    componentDidUpdate(prev_props){
        if (this.props.search!=prev_props.search)
            this.set_new_params_debounced();
        if (this.props.type_filter!=prev_props.type_filter||
            this.props.filters!=prev_props.filters)
        {
            this.set_new_params();
        }
        if (prev_props.cur_preview!=this.props.cur_preview)
            this.props.resize_columns();
    }
    componentDidMount(){
        window.addEventListener('resize', this.props.resize_columns);
        this.setdb_on('head.har_viewer.reset_reqs', ()=>{
            setdb.set('har_viewer.checked_list', []);
            this.loaded.to = 0;
            this.setState({
                reqs: [],
                stats: {total: 0, sum_out: 0, sum_in: 0},
            });
        });
        this.setdb_on('head.har_viewer.refresh', refresh=>{
            if (!refresh)
                return;
            this.loaded.to = 0;
            this.setState({
                reqs: [],
                stats: {total: 0, sum_out: 0, sum_in: 0},
            });
        });
        this.setdb_on('head.har_viewer.reqs', reqs=>{
            if (reqs)
                this.setState({reqs});
        });
        this.setdb_on('head.har_viewer.stats', stats=>{
            if (stats)
                this.setState({stats});
        });
        ws.addEventListener('message', this.on_message);
        this.setdb_on('har_viewer.select_mode', select=>{
            if (select==undefined)
                return;
            if (select)
                this.props.show_column(0);
            else
                this.props.hide_column(0);
        });
    }
    willUnmount(){
        window.removeEventListener('resize', this.props.resize_columns);
        ws.removeEventListener('message', this.on_message);
        setdb.set('head.har_viewer.reqs', []);
        setdb.set('head.har_viewer.stats', null);
        setdb.set('har_viewer', null);
    }
    fetch_missing_data = pos=>{
        if (this.state.stats&&this.state.stats.total&&
            this.state.reqs.length==this.state.stats.total)
        {
            return;
        }
        if (pos=='bottom')
            this.get_data({skip: this.loaded.to});
    };
    get_params = opt=>{
        const params = opt;
        params.limit = opt.limit||this.batch_size;
        params.skip = opt.skip||0;
        if (this.props.match.params.port)
            params.port = this.props.match.params.port;
        if (this.props.master_port)
        {
            const proxies = setdb.get('head.proxies_running');
            const mp = proxies.find(p=>p.port==this.props.master_port);
            this.port_range = {from: mp.port, to: mp.port+mp.multiply-1};
            params.port_from = this.port_range.from;
            params.port_to = this.port_range.to;
        }
        if (this.props.search&&this.props.search.trim())
            params.search = this.props.search;
        if (this.state.sorted)
        {
            params.sort = this.state.sorted.field;
            if (this.state.sorted.dir==1)
                params.sort_desc = true;
        }
        if (this.props.type_filter&&this.props.type_filter!='All')
            params.content_type = this.props.type_filter.toLowerCase();
        for (let filter in this.props.filters)
        {
            let val;
            if (val = this.props.filters[filter])
                params[filter] = val;
        }
        return params;
    };
    get_data = (opt={})=>{
        if (this.sql_loading)
            return;
        const params = this.get_params(opt);
        const _this = this;
        this.sql_loading = true;
        this.etask(function*(){
            this.on('finally', ()=>{
                _this.sql_loading = false;
                loader.end();
            });
            loader.start();
            const url = zescape.uri(_this.uri, params);
            const res = yield ajax.json({url});
            const reqs = res.log.entries;
            const new_reqs = [...opt.replace ? [] : _this.state.reqs, ...reqs];
            const uuids = new Set();
            const new_reqs_unique = new_reqs.filter(r=>{
                if (uuids.has(r.uuid))
                    return false;
                uuids.add(r.uuid);
                return true;
            });
            setdb.set('head.har_viewer.reqs', new_reqs_unique);
            _this.loaded.to = opt.skip+reqs.length;
            const stats = {total: res.total, sum_out: res.sum_out,
                sum_in: res.sum_in};
            if (!_this.state.stats||!_this.state.stats.total)
                setdb.set('head.har_viewer.stats', stats);
        });
    };
    set_new_params = ()=>{
        if (this.sql_loading)
            return;
        this.loaded.to = 0;
        setdb.emit_path('head.har_viewer.dc_top');
        this.get_data({replace: true});
    };
    set_new_params_debounced = _.debounce(this.set_new_params, 400);
    set_sort = field=>{
        if (this.sql_loading)
            return;
        let dir = 1;
        if (this.state.sorted.field==field)
            dir = -1*this.state.sorted.dir;
        this.setState({sorted: {field, dir}}, this.set_new_params);
    };
    on_focus = ()=>this.setState({focused: true});
    on_blur = ()=>this.setState({focused: false});
    is_hidden = req=>{
        const cur_port = req.details.port;
        const port = this.props.match.params.port;
        if (port && cur_port!=port)
            return true;
        if (this.port_range &&
            (cur_port<this.port_range.from || cur_port>this.port_range.to))
        {
            return true;
        }
        if (this.props.search && !req.request.url.match(
            new RegExp(this.props.search)))
        {
            return true;
        }
        if (this.props.type_filter && this.props.type_filter!='All' &&
            req.details.content_type!=this.props.type_filter.toLowerCase())
        {
            return true;
        }
        if (this.props.filters.port &&
            this.props.filters.port!=req.details.port)
        {
            return true;
        }
        if (this.props.filters.protocol &&
            this.props.filters.protocol!=req.details.protocol)
        {
            return true;
        }
        if (this.props.filters.status_code &&
            this.props.filters.status_code!=req.response.status)
        {
            return true;
        }
        return false;
    };
    is_visible = r=>!this.is_hidden(r);
    on_message = event=>{
        const json = JSON.parse(event.data);
        if (json.type=='har_viewer')
            this.on_request_message(json.data);
        else if (json.type=='har_viewer_start')
            this.on_request_started_message(json.data);
        else if (json.type=='har_viewer_abort')
            this.on_request_aborted_message(json.data);
    };
    on_request_aborted_message = uuid=>{
        if (this.reqs_to_render.map(r=>r.uuid).includes(uuid))
        {
            return this.reqs_to_render =
                this.reqs_to_render.filter(r=>r.uuid!=uuid);
        }
        this.reqs_to_abort.push(uuid);
        this.take_reqs_from_pool();
    };
    on_request_started_message = req=>{
        req.pending = true;
        this.on_request_message(req);
    };
    on_request_message = req=>{
        this.reqs_to_render.push(req);
        this.take_reqs_from_pool();
    };
    take_reqs_from_pool = ()=>{
        if (!this.reqs_to_render.length && !this.reqs_to_abort.length)
            return;
        const reqs = this.reqs_to_render.filter(this.is_visible);
        const all_reqs = this.reqs_to_render;
        if (this.batch_size>this.state.reqs.length)
        {
            this.loaded.to = Math.min(this.batch_size,
                this.state.reqs.length + reqs.length);
        }
        const new_reqs_set = {};
        [...this.state.reqs, ...reqs].forEach(r=>{
            if (this.reqs_to_abort.includes(r.uuid))
                return;
            if (!new_reqs_set[r.uuid])
                return new_reqs_set[r.uuid] = r;
            if (new_reqs_set[r.uuid].pending)
                new_reqs_set[r.uuid] = r;
        });
        const sorted_field = this.props.cols.find(
            c=>c.sort_by==this.state.sorted.field).data;
        const dir = this.state.sorted.dir;
        const new_reqs = Object.values(new_reqs_set)
        .sort((a, b)=>{
            const val_a = _.get(a, sorted_field);
            const val_b = _.get(b, sorted_field);
            if (val_a==val_b)
                return a.uuid > b.uuid ? -1*dir : dir;
            return val_a > val_b ? -1*dir : dir;
        }).slice(0, Math.max(this.state.reqs.length, this.batch_size));
        this.reqs_to_render = [];
        this.reqs_to_abort = [];
        this.setState(prev=>{
            const new_state = {reqs: new_reqs};
            new_state.stats = {
                total: prev.stats.total + all_reqs.filter(r=>r.pending).length,
                sum_out: prev.stats.sum_out + all_reqs.reduce((acc, r)=>
                    acc+r.details.out_bw||0, 0),
                sum_in: prev.stats.sum_in + all_reqs.reduce((acc, r)=>
                    acc+r.details.in_bw||0, 0),
            };
            return new_state;
        });
    };
    on_mouse_up = ()=>{
        this.moving_col = null;
        this.props.main_panel_stopped_moving();
    };
    render(){
        const style = {};
        if (this.props.cur_preview)
        {
            style.flex = `0 0 ${this.props.width}px`;
            style.width = this.props.width;
            style.maxWidth = this.props.width;
        }
        return <div className="tables_container vbox"
              tabIndex="-1"
              style={style}
              onFocus={this.on_focus}
              onBlur={this.on_blur}>
              <div className="reqs_container">
                <Header_container cols={this.props.cols}
                  reqs={this.state.reqs}
                  sort={this.set_sort}
                  sorted={this.state.sorted}
                  only_name={!!this.props.cur_preview}/>
                <Data_container cols={this.props.cols}
                  fetch_missing_data={this.fetch_missing_data}
                  reqs={this.state.reqs}
                  focused={this.state.focused}
                  cur_preview={this.props.cur_preview}
                  open_preview={this.props.open_preview}/>
              </div>
              <Summary_bar stats={this.state.stats}/>
            </div>;
    }
}));

class Summary_bar extends Pure_component {
    render(){
        let {total, sum_in, sum_out} = this.props.stats||
            {total: 0, sum_in: 0, sum_out: 0};
        sum_out = bytes_format(sum_out)||'0 B';
        sum_in = bytes_format(sum_in)||'0 B';
        const txt = `${total} requests | ${sum_out} sent | ${sum_in} received`;
        return <div className="summary_bar">
              <span>
                <Tooltip title={txt}>{txt}</Tooltip>
              </span>
            </div>;
    }
}

class Header_container extends Pure_component {
    state = {checked_all: false};
    componentDidMount(){
        this.setdb_on('har_viewer.checked_all', checked_all=>{
            if (checked_all==undefined)
                return;
            this.setState({checked_all});
        });
    }
    toggle_all = ()=>{
        const checked_all = !this.state.checked_all;
        this.setState({checked_all});
        const uuids = this.props.reqs.map(r=>r.uuid);
        if (checked_all)
        {
            uuids.forEach(id=>
                setdb.set('har_viewer.checked_list.'+id, true));
        }
        else
        {
            Object.keys(setdb.get('har_viewer').checked_list).forEach(id=>
                setdb.set('har_viewer.checked_list.'+id, false));
        }
        setdb.emit_path('har_viewer.checked_list');
    };
    click = col=>{
        if (col.fixed)
            this.toggle_all();
        else
            this.props.sort(col.sort_by);
    };
    render(){
        let {cols, only_name, sorted} = this.props;
        if (!cols)
            return null;
        if (only_name)
            cols = [cols[1]];

        return <div className="header_container">
              <table>
                <colgroup>
                  {cols.map((c, idx)=>
                    <col key={c.title}
                      style={{width: only_name||idx==cols.length-1 ?
                        'auto' : c.width}}/>
                  )}
                </colgroup>
                <tbody>
                  <tr>
                    {cols.map(c=>
                      <Tooltip key={c.title} title={c.tooltip||c.title}>
                        <th key={c.title} onClick={()=>this.click(c)}>
                          <div>
                            {c.title=='select' &&
                              <Checkbox checked={this.state.checked_all}/>}
                            {c.title!='select' && c.title}
                          </div>
                          <Sort_icon show={c.sort_by==sorted.field}
                            dir={sorted.dir}/>
                        </th>
                      </Tooltip>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>;
    }
}

class Data_container extends Pure_component {
    state = {checked_all: false};
    componentDidMount(){
        this.setdb_on('head.har_viewer.dc_top', ()=>{
            if (this.dc.current)
                this.dc.current.scrollTop = 0;
        });
        this.setdb_on('har_viewer.checked_all', checked_all=>{
            if (checked_all!=undefined)
                this.setState({checked_all});
        });
    }
    handle_viewpoint_enter = ()=>{
        this.props.fetch_missing_data('bottom');
    };
    dc = React.createRef();
    render(){
        let {cols, open_preview, cur_preview, focused, reqs} = this.props;
        const preview_mode = !!cur_preview;
        cols = (cols||[]).map((c, idx)=>{
            if (!preview_mode)
                return c;
            if (preview_mode&&idx==1)
                return {...c, width: 'auto'};
            return {...c, width: 0};
        });
        return <div ref={this.dc} className="data_container">
              <table>
                <colgroup>
                  {cols.map((c, idx)=>
                    <col key={c.title}
                      style={{width: !preview_mode && idx==cols.length-1 ?
                        'auto': c.width}}/>
                  )}
                </colgroup>
                <Data_rows reqs={reqs} cols={cols} open_preview={open_preview}
                  cur_preview={cur_preview}
                  checked_all={this.state.checked_all} focused={focused}/>
              </table>
              <Waypoint key={reqs.length} scrollableAncestor={this.dc.current}
                onEnter={this.handle_viewpoint_enter}/>
            </div>;
    }
}

class Data_rows extends React.Component {
    shouldComponentUpdate(next_props){
        return next_props.reqs!=this.props.reqs ||
            next_props.cur_preview!=this.props.cur_preview ||
            next_props.focused!=this.props.focused||
            next_props.checked_all!=this.props.checked_all;
    }
    render(){
        return <tbody>
              {this.props.reqs.map(r=>
                <Data_row cols={this.props.cols} key={r.uuid}
                  open_preview={this.props.open_preview}
                  cur_preview={this.props.cur_preview}
                  checked_all={this.props.checked_all}
                  focused={this.props.focused} req={r}/>
              )}
              <tr className="filler">
                {this.props.cols.map(c=><td key={c.title}/>)}
              </tr>
            </tbody>;
    }
}

class Data_row extends React.Component {
    shouldComponentUpdate(next_props){
        const selected = _.get(this.props.cur_preview, 'uuid')==
            this.props.req.uuid;
        const will_selected = _.get(next_props.cur_preview, 'uuid')==
            next_props.req.uuid;
        const selection_changed = selected!=will_selected;
        const focused_changed = this.props.focused!=next_props.focused;
        const checked_all_changed = this.props.checked_all!=
            next_props.checked_all;
        const pending_changed = this.props.req.pending!=next_props.req.pending;
        return selection_changed||focused_changed&&selected||
            checked_all_changed||pending_changed;
    }
    render(){
        const {cur_preview, open_preview, cols, focused, req} = this.props;
        const selected = _.get(cur_preview, 'uuid')==req.uuid;
        const classes = classnames({
            selected,
            focused: selected&&focused,
            error: !req.details.success&&!req.pending,
            pending: !!req.pending,
        });
        return <tr className={classes}>
              {cols.map((c, idx)=>
                <td key={c.title} onClick={()=>idx!=0&&open_preview(req)}>
                  <Cell_value col={c.title} req={req}
                    checked_all={this.props.checked_all}/>
                </td>
              )}
            </tr>;
    }
}

const maybe_pending = Component=>function pies(props){
    if (props.pending)
    {
        return <Tooltip title="The request is still loading">
              <div className="disp_value">pending</div>
            </Tooltip>;
    }
    return <Component {...props}/>;
};

class Cell_value extends React.Component {
    render(){
        const {col, req, req: {details: {timeline, rule}}} = this.props;
        if (col=='select')
        {
            return <Select_cell uuid={req.uuid}
              checked_all={this.props.checked_all}/>;
        }
        if (col=='Name')
            return <Name_cell req={req} timeline={timeline} rule={rule}/>;
        else if (col=='Status')
        {
            return <Status_code_cell status={req.response.status}
                  pending={!!req.pending} uuid={req.uuid} req={req}/>;
        }
        else if (col=='Proxy port')
            return <Tooltip_and_value val={req.details.port}/>;
        else if (col=='Bandwidth')
            return <Tooltip_bytes chrome_style bytes={req.details.bw}/>;
        else if (col=='Time')
        {
            return <Time_cell time={req.time} url={req.request.url}
                  pending={!!req.pending} uuid={req.uuid}/>;
        }
        else if (col=='Peer proxy')
        {
            const ext_proxy = (setdb.get('head.proxies_running')||[])
                .some(p=>p.port==req.details.port && p.ext_proxies);
            return <Tooltip_and_value val={req.details.proxy_peer}
                tip={ext_proxy ? 'This feature is only available when using '
                +'proxies by Luminati network' : req.details.proxy_peer}
                pending={!!req.pending}/>;
        }
        else if (col=='Date')
        {
            const local = moment(new Date(req.startedDateTime||
                req.details.timestamp)).format('YYYY-MM-DD HH:mm:ss');
            return <Tooltip_and_value val={local}/>;
        }
        return col;
    }
}

class Name_cell extends Pure_component {
    go_to_timeline = e=>setdb.emit('har_viewer.set_pane', 3);
    render(){
        const {req, timeline, rule} = this.props;
        const rule_tip = 'At least one rule has been applied to this'
        +' request. Click to see more details';
        const status_check = req.details.context=='STATUS CHECK';
        return <div className="col_name">
              <div>
                <div className="icon script"/>
                {(timeline && timeline.length>1 || rule) &&
                  <Tooltip title={rule_tip}>
                    <div onClick={this.go_to_timeline}
                      className="small_icon rules"/>
                  </Tooltip>
                }
                <Tooltip title={req.request.url}>
                  <div className="disp_value">
                    {status_check && 'status check'}
                    {!status_check && req.request.url}
                  </div>
                </Tooltip>
              </div>
            </div>;
    }
}

const Status_code_cell = maybe_pending(({status, uuid, req})=>{
    const enable_ssl_click = e=>{
        e.stopPropagation();
        $('#enable_ssl_modal').modal();
    };
    const get_desc = ()=>{
        const err_header = req.response.headers.find(
            r=>r.name=='x-luminati-error'||r.name=='x-lpm-error');
        if (status==502&&err_header)
            return err_header.value;
        return status_codes[status];
    };
    if (status=='unknown')
    {
        return <div onClick={e=>e.stopPropagation()} className="disp_value">
              <React_tooltip id={'s'+uuid} type="info" effect="solid"
                delayHide={100} delayShow={0} delayUpdate={500}
                offset={{top: -10}}>
                <div>
                  Status code of this request could not be parsed becasue the
                  connection is encrypted.
                </div>
                <div style={{marginTop: 10}}>
                  <a onClick={enable_ssl_click} className="link">
                    Enable SSL analyzing</a>
                  <span> to see the status codes and other information about
                    requests</span>
                </div>
              </React_tooltip>
              <div data-tip="React-tooltip" data-for={'s'+uuid}>
                <span>unknown</span>
                <div className="small_icon status info"/>
              </div>
            </div>;
    }
    const desc = get_desc(status);
    return <Tooltip title={`${status} ${desc}`}>
          <div className="disp_value">{status}</div>
        </Tooltip>;
});

const Time_cell = maybe_pending(({time, url, uuid})=>{
    const enable_ssl_click = e=>{
        e.stopPropagation();
        $('#enable_ssl_modal').modal();
    };
    if (!url.endsWith(':443')||!time)
        return <Tooltip_and_value val={time&&time+' ms'}/>;
    return <div onClick={e=>e.stopPropagation()} className="disp_value">
          <React_tooltip id={'t'+uuid} type="info" effect="solid"
            delayHide={100} delayShow={0} delayUpdate={500}
            offset={{top: -10}}>
            <div>
              Timing of this request could not be parsed becasue the
              connection is encrypted.
            </div>
            <div style={{marginTop: 10}}>
              <a onClick={enable_ssl_click} className="link">
                Enable SSL analyzing</a>
              <span> to see the timing and other information about requests
              </span>
            </div>
          </React_tooltip>
          <div data-tip="React-tooltip" data-for={'t'+uuid}>
             {time+' ms'}
             {url.endsWith(':443')&&<div className="small_icon status info"/>}
          </div>
        </div>;
});

class Select_cell extends React.Component {
    state = {checked: false};
    shouldComponentUpdate(next_props, next_state){
        return next_state.checked!=this.state.checked||
            next_props.checked_all!=this.props.checked_all;
    }
    componentDidMount(){
        this.checked_listener = setdb.on(
            'har_viewer.checked_list.'+this.props.uuid, checked=>{
                if (checked==undefined)
                    return;
                this.setState({checked});
            });
    }
    componentWillUnmount(){
        setdb.off(this.checked_listener);
    }
    toggle = ()=>{
        setdb.set('har_viewer.checked_list.'+this.props.uuid,
            !this.state.checked);
        setdb.emit_path('har_viewer.checked_list');
    };
    render(){
        return <Checkbox checked={this.state.checked||this.props.checked_all}
          on_change={this.toggle}/>;
    }
}

const Tooltip_and_value = maybe_pending(({val, tip})=>
    <Tooltip title={tip||val}>
      <div className="disp_value">{val||'—'}</div>
    </Tooltip>
);

export default Har_viewer;
