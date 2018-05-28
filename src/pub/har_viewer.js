// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import Pure_component from '../../www/util/pub/pure_component.js';
import React from 'react';
import _ from 'lodash';
import moment from 'moment';
import classnames from 'classnames';
import setdb from 'hutil/util/setdb';
import etask from 'hutil/util/etask';
import ajax from 'hutil/util/ajax';
import zescape from 'hutil/util/escape';
import $ from 'jquery';
import {status_codes, bytes_format} from './util.js';
import Waypoint from 'react-waypoint';
import {Toolbar_button, Tooltip, Devider, Sort_icon,
    with_resizable_cols} from './chrome_widgets.js';
import Preview from './har_preview.js';
import {Tooltip_bytes} from './common.js';

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
        return (
            <div id="har_viewer" className="har_viewer chrome">
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
                    close_preview={this.close_preview}/>
                  <Tables_resizer show={!!this.state.cur_preview}
                    start_moving={this.start_moving_width}
                    offset={this.state.tables_width}/>
                </div>
              </div>
            </div>
        );
    }
}

const Toolbar = ({clear, search_val, on_change_search, type_filter,
    set_type_filter, proxies, filters, set_filter, master_port, undock,
    dock_mode})=>
(
    <div className="toolbar_container">
      <div className="toolbar">
        <Toolbar_button id="clear" tooltip="Clear" on_click={clear}/>
        {!dock_mode &&
          <Toolbar_button id="docker" tooltip="Undock into separate window"
            on_click={undock}/>
        }
        <Devider/>
        <Search_box val={search_val} on_change={on_change_search}/>
        <Type_filters filter={type_filter} set={set_type_filter}/>
        <Devider/>
        <Filters set_filter={set_filter} filters={filters}
          master_port={master_port}/>
      </div>
    </div>
);

class Filters extends Pure_component {
    state = {};
    componentDidMount(){
        this.setdb_on('head.logs_suggestions', suggestions=>{
            this.setState({suggestions});
        });
    }
    render(){
        if (!this.state.suggestions)
            return null;
        const filters = [
            {name: 'port', default_value: this.props.master_port ?
                `Multiplied ${this.props.master_port}` : 'All proxy ports'},
            {name: 'status_code', default_value: 'All status codes'},
            {name: 'protocol', default_value: 'All protocols'},
        ];
        return (
            <div className="filters">
              {filters.map(f=>(
                <Filter key={f.name}
                  vals={this.state.suggestions[f.name+'s']}
                  val={this.props.filters[f.name]}
                  set={this.props.set_filter.bind(null, f.name)}
                  default_value={f.default_value}/>
              ))}
            </div>
        );
    }
}

const Filter = ({vals, val, set, default_value})=>(
    <div className="custom_filter">
      <select value={val} onChange={set}>
        <option value="">{default_value}</option>
        {vals.map(p=>(
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <span className="arrow"/>
    </div>
);

const type_filters = [{name: 'XHR', tooltip: 'XHR and fetch'},
    {name: 'JS', tooltip: 'Scripts'}, {name: 'CSS', tooltip: 'Stylesheets'},
    {name: 'Img', tooltip: 'Images'}, {name: 'Media', tooltip: 'Media'},
    {name: 'Font', tooltip: 'Fonts'}, {name: 'Other', tooltip: 'Other'}];
const Type_filters = ({filter, set})=>(
    <div className="filters">
      <Type_filter name="All" on_click={set.bind(null, 'All')} cur={filter}
        tooltip="All types"/>
      <Devider/>
      {type_filters.map(f=>(
        <Type_filter on_click={set.bind(null, f.name)} key={f.name}
          name={f.name} cur={filter} tooltip={f.tooltip}/>
      ))}
    </div>
);

const Type_filter = ({name, cur, tooltip, on_click})=>(
    <Tooltip title={tooltip} placement="bottom">
      <div className={classnames('filter', {active: cur==name})}
        onClick={on_click}>{name}</div>
    </Tooltip>
);

const Search_box = ({val, on_change})=>(
    <div className="search_box">
      <input value={val}
        onChange={on_change}
        type="text"
        placeholder="Filter"/>
    </div>
);

const Tables_resizer = ({show, offset, start_moving})=>{
    if (!show)
        return null;
    return (
        <div className="data_grid_resizer" style={{left: offset-2}}
          onMouseDown={start_moving}/>
    );
};

const cols = [
    {title: 'Name', sort_by: 'url', data: 'request.url'},
    {title: 'Proxy port', sort_by: 'port', data: 'details.port'},
    {title: 'Status', sort_by: 'status_code', data: 'response.status'},
    {title: 'Bandwidth', sort_by: 'bw', data: 'details.bw'},
    {title: 'Time', sort_by: 'elapsed', data: 'time'},
    {title: 'Peer proxy', sort_by: 'proxy_peer',
        data: 'details.proxy_peer'},
    {title: 'Date', sort_by: 'timestamp', data: 'details.timestamp'},
];
const Tables_container = with_resizable_cols(cols,
class Tables_container extends Pure_component {
    uri = '/api/logs';
    batch_size = 30;
    loaded = {from: 0, to: 0};
    state = {
        focused: false,
        reqs: [],
        sorted: {field: 'timestamp', dir: 1},
    };
    componentDidUpdate(prev_props){
        if (this.props.search!=prev_props.search)
            this.set_new_params_debounced();
        if (this.props.type_filter!=prev_props.type_filter||
            this.props.filters!=prev_props.filters)
        {
            this.set_new_params();
        }
    }
    componentDidMount(){
        window.addEventListener('resize', this.props.resize_columns);
        this.setdb_on('head.har_viewer.reset_reqs', ()=>{
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
        this.setdb_on('head.har_viewer.sub_stats', sub_stats=>
            this.setState({sub_stats}));
        this.setdb_on('head.ws', ws=>{
            if (!ws||this.ws)
                return;
            this.ws = ws;
            this.ws.addEventListener('message', this.on_message);
        });
    }
    willUnmount(){
        window.removeEventListener('resize', this.props.resize_columns);
        if (this.ws)
            this.ws.removeEventListener('message', this.on_message);
        setdb.set('head.har_viewer.reqs', []);
        setdb.set('head.har_viewer.stats', null);
    }
    fetch_missing_data = pos=>{
        if (this.state.stats&&this.state.reqs.length==this.state.stats.total)
            return;
        if (pos=='bottom')
            this.get_data({skip: this.loaded.to});
    };
    get_params = opt=>{
        const params = opt;
        params.limit = opt.limit||this.batch_size;
        params.skip = opt.skip||0;
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
        const params = this.get_params(opt);
        const _this = this;
        this.etask(function*(){
            loader.start();
            const url = zescape.uri(_this.uri, params);
            const res = yield ajax.json({url});
            const reqs = res.log.entries;
            const new_reqs = [...(opt.replace ? [] : _this.state.reqs),
                ...reqs];
            setdb.set('head.har_viewer.reqs', new_reqs);
            _this.loaded.to = opt.skip+reqs.length;
            const stats = {total: res.total, sum_out: res.sum_out,
                sum_in: res.sum_in};
            if (!_this.state.stats||!_this.state.stats.total)
                setdb.set('head.har_viewer.stats', stats);
            if (params.search)
                setdb.set('head.har_viewer.sub_stats', stats);
            else if (_this.state.sub_stats)
                setdb.set('head.har_viewer.sub_stats', null);
            loader.end();
        });
    };
    set_new_params = ()=>{
        this.loaded.to = 0;
        setdb.emit_path('head.har_viewer.dc_top');
        this.get_data({replace: true});
    };
    set_new_params_debounced = _.debounce(this.set_new_params, 400);
    set_sort = field=>{
        let dir = 1;
        if (this.state.sorted.field==field)
            dir = -1*this.state.sorted.dir;
        this.setState({sorted: {field, dir}}, this.set_new_params);
    };
    on_focus = ()=>this.setState({focused: true});
    on_blur = ()=>this.setState({focused: false});
    is_hidden = (request)=>{
        const cur_port = request.details.port;
        if (this.port&&cur_port!=this.port)
            return true;
        if (this.port_range&&
            (cur_port<this.port_range.from||cur_port>this.port_range.to))
        {
            return true;
        }
        if (this.props.search&&!request.request.url.match(
            new RegExp(this.props.search)))
        {
            return true;
        }
        if (this.props.type_filter&&this.props.type_filter!='All'&&
            request.details.content_type!=this.props.type_filter.toLowerCase())
        {
            return true;
        }
        if (this.props.filters.port&&
            this.props.filters.port!=request.details.port)
        {
            return true;
        }
        if (this.props.filters.protocol&&
            this.props.filters.protocol!=request.details.protocol)
        {
            return true;
        }
        if (this.props.filters.status_code&&
            this.props.filters.status_code!=request.response.status)
        {
            return true;
        }
        return false;
    };
    on_message = event=>{
        const req = JSON.parse(event.data);
        this.setState(prev=>({
            stats: {
                total: prev.stats.total+1,
                sum_out: prev.stats.sum_out+req.details.out_bw,
                sum_in: prev.stats.sum_in+req.details.in_bw,
            },
        }));
        if (this.is_hidden(req))
            return;
        const sorted_field = this.props.cols.find(
            c=>c.sort_by==this.state.sorted.field).data;
        const dir = this.state.sorted.dir;
        const new_size = Math.max(this.state.reqs.length, this.batch_size);
        if (new_size>this.state.reqs.length)
            this.loaded.to = this.loaded.to+1;
        const new_reqs = [...this.state.reqs, req].sort((a, b)=>{
            const val_a = _.get(a, sorted_field);
            const val_b = _.get(b, sorted_field);
            if (val_a==val_b)
                return a.uuid > b.uuid ? -1*dir : dir;
            return val_a > val_b ? -1*dir : dir;
        }).slice(0, new_size);
        this.setState({reqs: new_reqs});
        if (this.state.sub_stats)
        {
            this.setState(prev=>({
                sub_stats: {
                    total: prev.sub_stats.total+1,
                    sum_out: prev.sub_stats.sum_out+req.details.out_bw,
                    sum_in: prev.sub_stats.sum_in+req.details.in_bw,
                },
            }));
        }
    };
    on_mouse_up = ()=>{
        this.moving_col = null;
        this.props.main_panel_stopped_moving();
    };
    render(){
        const style = {};
        if (!!this.props.cur_preview)
        {
            style.flex = `0 0 ${this.props.width}px`;
            style.width = this.props.width;
            style.maxWidth = this.props.width;
        }
        return (
            <div className="tables_container vbox"
              tabIndex="-1"
              style={style}
              onFocus={this.on_focus}
              onBlur={this.on_blur}>
              <div className="reqs_container">
                <Header_container cols={this.props.cols}
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
              <Summary_bar stats={this.state.stats}
                sub_stats={this.state.sub_stats}/>
            </div>
        );
    }
});

class Summary_bar extends Pure_component {
    render(){
        let {total, sum_in, sum_out} = this.props.stats||
            {total: 0, sum_in: 0, sum_out: 0};
        sum_out = bytes_format(sum_out)||'0 B';
        sum_in = bytes_format(sum_in)||'0 B';
        let text;
        if (!this.props.sub_stats)
            text = `${total} requests | ${sum_out} sent | ${sum_in} received`;
        else
        {
            let sub_total = this.props.sub_stats.total;
            let sub_sum_out = this.props.sub_stats.sum_out;
            let sub_sum_in = this.props.sub_stats.sum_in;
            sub_sum_out = bytes_format(sub_sum_out)||'0 B';
            sub_sum_in = bytes_format(sub_sum_in)||'0 B';
            text = `${sub_total} / ${total} requests | ${sub_sum_out} /
            ${sum_out} sent | ${sub_sum_in} / ${sum_in} received`;
        }
        return (
            <div className="summary_bar">
              <span>
                <Tooltip title={text}>{text}</Tooltip>
              </span>
            </div>
        );
    }
}

const Header_container = ({cols, only_name, sorted, sort})=>{
    if (!cols)
        return null;
    if (only_name)
        cols = cols.slice(0, 1);
    return (
        <div className="header_container">
          <table>
            <colgroup>
              {cols.map((c, idx)=>(
                <col key={c.title}
                  style={{width: only_name||idx==cols.length-1 ?
                    'auto' : c.width}}/>
              ))}
            </colgroup>
            <tbody>
              <tr>
                {cols.map(c=>(
                  <th key={c.title} onClick={()=>sort(c.sort_by)}>
                    <div>{c.title}</div>
                    <Sort_icon show={c.sort_by==sorted.field}
                      dir={sorted.dir}/>
                  </th>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
    );
};

class Data_container extends Pure_component {
    componentDidMount(){
        this.setdb_on('head.har_viewer.dc_top', ()=>{
            if (this.dc)
                this.dc.scrollTop = 0;
        });
    }
    set_dc_ref = ref=>{ this.dc = ref; };
    handle_viewpoint_enter = ()=>{
        this.props.fetch_missing_data('bottom');
    };
    render(){
        let {cols, open_preview, cur_preview, focused, reqs} = this.props;
        const preview_mode = !!cur_preview;
        cols = (cols||[]).map((c, idx)=>{
            if (!preview_mode)
                return c;
            if (preview_mode&&idx==0)
                return {...c, width: 'auto'};
            return {...c, width: 0};
        });
        return (
            <div ref={this.set_dc_ref} className="data_container">
              <table>
                <colgroup>
                  {cols.map((c, idx)=>(
                    <col key={c.title}
                      style={{width: !preview_mode&&idx==cols.length-1 ?
                        'auto': c.width}}/>
                  ))}
                </colgroup>
                <Data_rows reqs={reqs}
                  cols={cols}
                  open_preview={open_preview}
                  cur_preview={cur_preview}
                  focused={focused}/>
              </table>
              <Waypoint
                key={reqs.length}
                scrollableAncestor={this.dc}
                onEnter={this.handle_viewpoint_enter}/>
            </div>
        );
    }
}

class Data_rows extends React.Component {
    shouldComponentUpdate(next_props){
        return next_props.reqs!=this.props.reqs ||
            next_props.cur_preview!=this.props.cur_preview ||
            next_props.focused!=this.props.focused;
    }
    render(){
        return (
            <tbody>
              {this.props.reqs.map(r=>(
                <Data_row cols={this.props.cols} key={r.uuid}
                  open_preview={this.props.open_preview}
                  cur_preview={this.props.cur_preview}
                  focused={this.props.focused} req={r}/>
              ))}
              <tr className="filler">
                {this.props.cols.map(c=><td key={c.title}/>)}
              </tr>
            </tbody>
        );
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
        return selection_changed||focused_changed&&selected;
    }
    render(){
        const {cur_preview, open_preview, cols, focused, req} = this.props;
        const selected = _.get(cur_preview, 'uuid')==req.uuid;
        const classes = classnames({
            selected,
            focused: selected&&focused,
            error: !req.details.success,
        });
        return (
            <tr className={classes}>
              {cols.map(c=>(
                <td key={c.title} onClick={()=>open_preview(req)}>
                  <Cell_value col={c.title} req={req}/>
                </td>
              ))}
            </tr>
        );
    }
}

const Cell_value = ({col, req})=>{
    if (col=='Name')
    {
        return (
            <Tooltip title={req.request.url}>
              <div>
                <div className="icon script"/>
                <div className="disp_value">{req.request.url}</div>
              </div>
            </Tooltip>
        );
    }
    else if (col=='Status')
    {
        const status = status_codes[req.response.status];
        return (
            <Tooltip title={req.response.status+' '+status}>
              <div className="disp_value">{req.response.status}</div>
            </Tooltip>
        );
    }
    else if (col=='Proxy port')
        return <Tooltip_and_value val={req.details.port}/>;
    else if (col=='Bandwidth')
        return <Tooltip_bytes chrome_style bytes={req.details.bw}/>;
    else if (col=='Time')
        return <Tooltip_and_value val={req.time+' ms'}/>;
    else if (col=='Peer proxy')
        return <Tooltip_and_value val={req.details.proxy_peer}/>;
    else if (col=='Date')
    {
        const local = moment(new Date(req.startedDateTime)).format(
            'YYYY-MM-DD HH:mm:ss');
        return <Tooltip_and_value val={local}/>;
    }
    return col;
};

const Tooltip_and_value = ({val})=>(
    <Tooltip title={val}>
      <div className="disp_value">{val}</div>
    </Tooltip>
);

export default Har_viewer;
