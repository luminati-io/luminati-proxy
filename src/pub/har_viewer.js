// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import _ from 'lodash';
import $ from 'jquery';
import {Route, Link, withRouter} from 'react-router-dom';
import classnames from 'classnames';
import moment from 'moment';
import React_tooltip from 'react-tooltip';
import Pure_component from '/www/util/pub/pure_component.js';
import ajax from '../../util/ajax.js';
import etask from '../../util/etask.js';
import zescape from '../../util/escape.js';
import setdb from '../../util/setdb.js';
import zutil from '../../util/util.js';
import Tooltip from './common/tooltip.js';
import {Har_viewer} from './har/viewer.js';
import {Tooltip_bytes} from './common.js';
import {get_troubleshoot} from './util.js';
import ws from './ws.js';

const loader = {
    start: ()=>$('#har_viewer').addClass('waiting'),
    end: ()=>$('#har_viewer').removeClass('waiting'),
};

const enable_ssl_click = port=>etask(function*(){
    this.on('finally', ()=>{
        loader.end();
    });
    loader.start();
    yield window.fetch('/api/enable_ssl', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({port}),
    });
    const proxies = yield ajax.json({url: '/api/proxies_running'});
    setdb.set('head.proxies_running', proxies);
});

const table_cols = [
    {title: 'select', hidden: true, fixed: 27, tooltip: 'Select/unselect all'},
    {title: 'Name', sort_by: 'url', data: 'request.url',
        tooltip: 'Request url'},
    {title: 'Proxy port', sort_by: 'port', data: 'details.port'},
    {title: 'Status', sort_by: 'status_code', data: 'response.status',
        tooltip: 'Status code'},
    {title: 'Bandwidth', sort_by: 'bw', data: 'details.bw'},
    {title: 'Time', sort_by: 'elapsed', data: 'time'},
    {title: 'Peer proxy', sort_by: 'proxy_peer', data: 'details.proxy_peer'},
    {title: 'Troubleshooting', data: 'details.troubleshoot'},
    {title: 'Date', sort_by: 'timestamp', data: 'details.timestamp'},
];

export default withRouter(
class Lpm_har_viewer extends Pure_component {
    constructor(props){
        super(props);
        this.state = {
            reqs: [],
            sorted: {field: 'timestamp', dir: 1},
            search: this.props.domain||'',
            type_filter: 'All',
            filters: {
                port: this.props.port||false,
                status_code: this.props.code||false,
                protocol: this.props.protocol||false,
            },
        };
        this.uri = '/api/logs';
        this.batch_size = 30;
        this.loaded = {from: 0, to: 0};
        this.reqs_to_render = [];
        this.temp_total = 0;
        this.take_reqs_from_pool = _.throttle(this.take_reqs_from_pool, 100);
        this.set_new_params_debounced = _.debounce(this.set_new_params, 400);
    }
    componentDidMount(){
        ws.addEventListener('message', this.on_message);
        this.setdb_on('head.proxies_running', proxies=>{
            if (proxies)
                this.setState({proxies});
        });
        this.setdb_on('head.settings', settings=>{
            if (settings)
                this.setState({logs: settings.logs});
        });
        this.setdb_on('head.har_viewer.reset_reqs', ()=>{
            this.loaded.to = 0;
            this.setState({
                reqs: [],
                stats: {total: 0, sum_out: 0, sum_in: 0},
            });
        }, {init: false});
        this.setdb_on('head.har_viewer.reqs', reqs=>{
            if (reqs)
                this.setState({reqs});
        });
        this.setdb_on('head.har_viewer.stats', stats=>{
            if (stats)
                this.setState({stats});
        });
        this.etask(function*(){
            const suggestions = yield ajax.json(
                {url: '/api/logs_suggestions'});
            suggestions.status_codes.unshift(...[2, 3, 4, 5].map(v=>`${v}**`));
            setdb.set('head.logs_suggestions', suggestions);
        });
    }
    willUnmount(){
        ws.removeEventListener('message', this.on_message);
        setdb.set('head.har_viewer.reqs', []);
        setdb.set('head.har_viewer.stats', null);
        setdb.set('har_viewer', null);
        loader.end();
        this.take_reqs_from_pool.cancel();
    }
    on_message = event=>{
        const json = JSON.parse(event.data);
        if (json.msg=='har_viewer')
            this.on_request_message(json.req);
        else if (json.msg=='har_viewer_start')
            this.on_request_started_message(json.req);
    };
    on_request_started_message = req=>{
        req.pending = true;
        this.on_request_message(req);
    };
    on_request_message = req=>{
        this.reqs_to_render.push(req);
        this.take_reqs_from_pool();
    };
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
        if (this.state.search && !req.request.url.match(
            new RegExp(this.state.search)))
        {
            return true;
        }
        if (this.state.type_filter && this.state.type_filter!='All' &&
            req.details.content_type!=this.state.type_filter.toLowerCase())
        {
            return true;
        }
        if (this.state.filters.port &&
            this.state.filters.port!=req.details.port)
        {
            return true;
        }
        if (this.state.filters.protocol &&
            this.state.filters.protocol!=req.details.protocol)
        {
            return true;
        }
        if (this.state.filters.status_code &&
            this.state.filters.status_code!=req.response.status)
        {
            return true;
        }
        return false;
    };
    is_visible = r=>!this.is_hidden(r);
    take_reqs_from_pool = ()=>{
        if (!this.reqs_to_render.length)
            return;
        const reqs = this.reqs_to_render.filter(this.is_visible);
        const all_reqs = this.reqs_to_render;
        if (this.batch_size>this.state.reqs.length)
        {
            this.loaded.to = Math.min(this.batch_size,
                this.state.reqs.length+reqs.length);
        }
        const new_reqs_set = {};
        [...this.state.reqs, ...reqs].forEach(r=>{
            if (!new_reqs_set[r.uuid])
                return new_reqs_set[r.uuid] = r;
            if (new_reqs_set[r.uuid].pending)
                new_reqs_set[r.uuid] = r;
        });
        const sorted_field = table_cols.find(
            c=>c.sort_by==this.state.sorted.field).data;
        const dir = this.state.sorted.dir;
        const new_reqs = Object.values(new_reqs_set)
        .sort((a, b)=>{
            const val_a = zutil.get(a, sorted_field);
            const val_b = zutil.get(b, sorted_field);
            if (val_a==val_b)
                return a.uuid > b.uuid ? -1*dir : dir;
            return val_a > val_b ? -1*dir : dir;
        }).slice(0, Math.max(this.state.reqs.length, this.batch_size));
        this.reqs_to_render = [];
        this.setState(prev=>{
            const new_state = {reqs: new_reqs};
            if (prev.stats)
            {
                new_state.stats = {
                    total: prev.stats.total+
                        all_reqs.filter(r=>r.pending).length,
                    sum_out: prev.stats.sum_out+all_reqs.reduce((acc, r)=>
                        acc+(r.details.out_bw||0), 0),
                    sum_in: prev.stats.sum_in+all_reqs.reduce((acc, r)=>
                        acc+(r.details.in_bw||0), 0),
                };
            }
            else
                this.temp_total += all_reqs.filter(r=>r.pending).length;
            return new_state;
        });
    };
    set_sort = field=>{
        if (this.sql_loading)
            return;
        let dir = 1;
        if (this.state.sorted.field==field)
            dir = -1*this.state.sorted.dir;
        this.setState({sorted: {field, dir}}, this.set_new_params);
    };
    set_new_params = ()=>{
        if (this.sql_loading)
            return;
        this.loaded.to = 0;
        setdb.emit_path('head.har_viewer.dc_top');
        this.get_data({replace: true});
    };
    fetch_missing_data = ()=>{
        if (this.state.stats && this.state.stats.total &&
            this.state.reqs.length==this.state.stats.total)
        {
            return;
        }
        this.get_data({skip: this.loaded.to-this.temp_total});
    };
    get_params = opt=>{
        const params = opt;
        params.limit = opt.limit||this.batch_size;
        params.skip = opt.skip||0;
        if (this.props.match.params.port)
            params.port = this.props.match.params.port;
        if (this.state.search && this.state.search.trim())
            params.search = this.state.search;
        if (this.state.sorted)
        {
            params.sort = this.state.sorted.field;
            if (this.state.sorted.dir==1)
                params.sort_desc = true;
        }
        if (this.state.type_filter && this.state.type_filter!='All')
            params.content_type = this.state.type_filter.toLowerCase();
        for (let filter in this.state.filters)
        {
            let val;
            if (val = this.state.filters[filter])
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
            this.on('uncaught', e=>console.error(e));
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
            const stats = {
                total: res.total+_this.temp_total,
                sum_out: res.sum_out,
                sum_in: res.sum_in,
            };
            _this.temp_total = 0;
            if (!_this.state.stats)
                setdb.set('head.har_viewer.stats', stats);
        });
    };
    clear_logs = cb=>{
        const params = {};
        if (this.props.match && this.props.match.params.port)
            params.port = this.props.match.params.port;
        const url = zescape.uri('/api/logs_reset', params);
        this.etask(function*(){
            loader.start();
            yield ajax({url});
            loader.end();
            if (cb)
                cb();
        });
    };
    on_change_search = e=>{
        this.setState({search: e.target.value},
            this.set_new_params_debounced());
    };
    set_type_filter = name=>{
        this.setState({type_filter: name}, this.set_new_params);
    };
    set_filter = (name, {target: {value}})=>{
        this.setState(prev=>({filters: {...prev.filters, [name]: value}}),
            this.set_new_params);
    };
    disable_logs = ()=>{
        const save_settings = setdb.get('head.save_settings');
        if (save_settings)
            save_settings({logs: 0});
    };
    render(){
        const show = this.state.logs>0;
        if (!show)
        {
            return <Route path={['/logs', '/proxy/:port/logs/har']}
              component={Logs_off_notice}
            />;
        }
        return <Har_viewer {...this.props}
          Cell_value={Cell_value}
          table_cols={table_cols}
          proxies={this.state.proxies}
          clear_logs={this.clear_logs}
          disable_logs={this.disable_logs}
          stats={this.state.stats}
          reqs={this.state.reqs}
          sorted={this.state.sorted}
          set_sort={this.set_sort}
          handle_viewpoint_enter={this.fetch_missing_data}
          on_change_search={this.on_change_search}
          search={this.state.search}
          set_type_filter={this.set_type_filter}
          type_filter={this.state.type_filter}
          set_filter={this.set_filter}
          filters={this.state.filters}
        >
          {this.props.children}
        </Har_viewer>;
    }
});

const Logs_off_notice = ()=>
    <div>
      <h4>
        Request logs are disabled. You can enable it back in
        &nbsp;
        <Link to="/settings">General settings</Link>
      </h4>
    </div>;

const maybe_pending = Component=>function pies(props){
    if (props.pending)
    {
        return <Tooltip title="The request is still loading">
          <div className="disp_value">pending</div>
        </Tooltip>;
    }
    return <Component {...props}/>;
};

const Status_code_cell = maybe_pending(props=>{
    const {status, status_text, uuid, req} = props;
    const get_desc = ()=>{
        const err_header = req.response.headers.find(
            r=>r.name=='x-luminati-error'||r.name=='x-lpm-error');
        if (status==502 && err_header)
            return err_header.value;
        return status=='canceled' ? '' : status_text;
    };
    if (status=='unknown')
    {
        return <Encrypted_cell name="Status code"
          id={`s${uuid}`}
          port={req.details.port}
        />;
    }
    const desc = get_desc(status);
    return <Tooltip title={`${status} ${desc}`}>
      <div className="disp_value">{status}</div>
    </Tooltip>;
});

const Time_cell = maybe_pending(props=>{
    const {port, time, url, uuid} = props;
    if (!url.endsWith(':443') || !time)
        return <Tooltip_and_value val={time && time+' ms'}/>;
    return <Encrypted_cell name="Timing" id={uuid} port={port}/>;
});

const Tooltip_and_value = maybe_pending(({val, tip})=>
    <Tooltip title={tip||val}>
      <div className="disp_value">{val||'—'}</div>
    </Tooltip>
);

class Name_cell extends Pure_component {
    go_to_rules = e=>setdb.emit('har_viewer.set_pane', 4);
    render(){
        const {req, rules} = this.props;
        const rule_tip = 'At least one rule has been applied to this '
        +'request. Click to see more details';
        const status_check = req.details.context=='STATUS CHECK';
        const is_ban = r=>Object.keys(r.action||{})
            .some(a=>a.startsWith('ban_ip'));
        const bad = (rules||[]).some(is_ban);
        const icon_classes = classnames('small_icon', 'rules', {
            good: !bad, bad});
        return <div className="col_name">
          <div>
            <div className="icon script"/>
            {!!rules && !!rules.length &&
              <Tooltip title={rule_tip}>
                <div onClick={this.go_to_rules} className={icon_classes}/>
              </Tooltip>
            }
            <Tooltip title={req.request.url}>
              <div className="disp_value">
                {req.request.url + (status_check ? ' (status check)' : '')}
              </div>
            </Tooltip>
          </div>
        </div>;
    }
}

class Encrypted_cell extends Pure_component {
    state = {proxies: []};
    componentDidMount(){
        this.setdb_on('head.proxies_running', proxies=>{
            if (!proxies)
                return;
            this.setState({proxies});
        });
    }
    is_ssl_on = port=>{
        const proxy = this.state.proxies.find(p=>p.port==port);
        if (!proxy)
            return false;
        return proxy.ssl;
    };
    render(){
        const {id, name, port} = this.props;
        const ssl = this.is_ssl_on(port);
        return <div onClick={e=>e.stopPropagation()} className="disp_value">
          <React_tooltip id={id}
            type="info"
            effect="solid"
            delayHide={100}
            delayShow={0}
            delayUpdate={500}
            offset={{top: -10}}>
            <div>
              {name} of this request could not be parsed because the
              connection is encrypted.
            </div>
            {!ssl &&
                <div style={{marginTop: 10}}>
                  <a onClick={()=>enable_ssl_click(port)}
                    className="link">
                    Enable SSL analyzing
                  </a>
                  <span>
                    to see {name} and other information about requests
                  </span>
                </div>
            }
            {ssl &&
                <div style={{marginTop: 10}}>
                  SSL analyzing is already turned on and all the future
                  requestes will be decoded. This request can't be decoded
                  retroactively
                </div>
            }
          </React_tooltip>
          <div data-tip="React-tooltip" data-for={id}>
            <span>unknown</span>
            <div className="small_icon status info"/>
          </div>
        </div>;
    }
}

class Cell_value extends React.Component {
    render(){
        const {col, req, req: {details: {timeline, rules}}} = this.props;
        if (col=='Name')
            return <Name_cell req={req} timeline={timeline} rules={rules}/>;
        else if (col=='Status')
        {
            return <Status_code_cell req={req}
              status={req.response.status}
              status_text={req.response.statusText}
              pending={!!req.pending}
              uuid={req.uuid}
            />;
        }
        else if (col=='Proxy port')
            return <Tooltip_and_value val={req.details.port}/>;
        else if (col=='Bandwidth')
            return <Tooltip_bytes bytes={req.details.bw}/>;
        else if (col=='Time')
        {
            return <Time_cell time={req.time}
              url={req.request.url}
              pending={!!req.pending}
              uuid={req.uuid}
              port={req.details.port}
            />;
        }
        else if (col=='Peer proxy')
        {
            const ip = req.details.proxy_peer;
            const ext_proxy = (setdb.get('head.proxies_running')||[])
                .some(p=>p.port==req.details.port && p.ext_proxies);
            let val;
            if (ip && (ip=='superproxy bypass' || ip.length < 16))
                val = ip;
            else if (ip)
                val = `...${ip.slice(-5)}`;
            else
                val = '';
            const tip = ext_proxy ? 'This feature is only available when '
                +'using proxies by Luminati network' : ip;
            return <Tooltip_and_value
              val={val}
              tip={tip}
              pending={!!req.pending}
            />;
        }
        else if (col=='Date')
        {
            const local = moment(new Date(req.details.timestamp))
                .format('YYYY-MM-DD HH:mm:ss');
            return <Tooltip_and_value val={local}/>;
        }
        else if (col=='Troubleshooting')
        {
            const troubleshoot = get_troubleshoot(req.response.content.text,
                req.response.status, req.response.headers);
            return <Tooltip_and_value val={troubleshoot.title}/>;
        }
        return col;
    }
}

