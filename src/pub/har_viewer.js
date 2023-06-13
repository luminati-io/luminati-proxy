// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import _ from 'lodash4';
import $ from 'jquery';
import {Route, Link, withRouter} from 'react-router-dom';
import {Waypoint} from 'react-waypoint';
import classnames from 'classnames';
import moment from 'moment';
import React_tooltip from 'react-tooltip';
import codemirror from 'codemirror/lib/codemirror';
import Pure_component from '/www/util/pub/pure_component.js';
import etask from '../../util/etask.js';
import setdb from '../../util/setdb.js';
import zutil from '../../util/util.js';
import {trigger_types, action_types} from '../../util/rules_util.js';
import Tooltip from './common/tooltip.js';
import {Har_viewer, Pane_headers, Pane_info, JSON_viewer,
    Img_viewer} from '/www/util/pub/har.js';
import {Tooltip_bytes} from './common.js';
import {get_troubleshoot} from './util.js';
import ws from './ws.js';
import {main as Api} from './api.js';
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/htmlmixed/htmlmixed';

const loader = {
    start: ()=>$('#har_viewer').addClass('waiting'),
    end: ()=>$('#har_viewer').removeClass('waiting'),
};

const enable_ssl_click = port=>etask(function*(){
    this.on('finally', ()=>{
        loader.end();
    });
    loader.start();
    yield Api.json.post('enable_ssl', {port});
    const proxies = yield Api.json.get('proxies_running');
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

class Codemirror_wrapper extends Pure_component {
    componentDidMount(){
        this.cm = codemirror.fromTextArea(this.textarea, {
            readOnly: true,
            lineNumbers: true,
        });
        this.cm.setSize('100%', '100%');
        let text = this.props.req.response.content.text||'';
        try { text = JSON.stringify(JSON.parse(text), null, '\t'); }
        catch(e){}
        this.cm.doc.setValue(text);
        this.set_ct();
    }
    componentDidUpdate(){
        this.cm.doc.setValue(this.props.req.response.content.text||'');
        this.set_ct();
    }
    set_ct(){
        const content_type = this.props.req.details.content_type;
        let mode;
        if (!content_type||content_type=='xhr')
            mode = 'javascript';
        if (content_type=='html')
            mode = 'htmlmixed';
        this.cm.setOption('mode', mode);
    }
    set_textarea = ref=>{ this.textarea = ref; };
    render(){
        return <div className="codemirror_wrapper">
          <textarea ref={this.set_textarea}/>
        </div>;
    }
}

const is_json_str = str=>{
    let resp;
    try { resp = JSON.parse(str); }
    catch(e){ return false; }
    return resp;
};

const Encrypted_response_data = withRouter(
class Encrypted_response_data extends Pure_component {
    goto_ssl = ()=>{
        this.props.history.push({
            pathname: `/proxy/${this.props.port}`,
            state: {field: 'ssl'},
        });
    };
    render(){
        return <Pane_info>
          <div>This request is using SSL encryption.</div>
          <div>
            <span>You need to turn on </span>
            <a className="link" onClick={this.goto_ssl}>
              SSL analyzing</a>
            <span> to read the response here.</span>
          </div>
        </Pane_info>;
    }
});

const Enable_https = withRouter(props=>{
    const click = ()=>{
        props.history.push({
            pathname: `/proxy/${props.port}`,
            state: {field: 'ssl'},
        });
    };
    return <div className="footer_link">
      <a className="devtools_link"
        role="link"
        tabIndex="0"
        target="_blank"
        rel="noopener noreferrer"
        onClick={click}
        style={{display: 'inline', cursor: 'pointer'}}
      >
        Enable HTTPS logging
      </a> to view this timeline
    </div>;
});

class Single_timeline extends Pure_component {
    state = {open: true};
    toggle = ()=>this.setState(prev=>({open: !prev.open}));
    render(){
        const sections = ['Resource Scheduling', 'Request/Response'];
        const perc = [
            {label: 'Queueing', id: 'blocked', section: 0},
            {label: 'Connected', id: 'wait', section: 1},
            {label: 'Time to first byte', id: 'ttfb', section: 1},
            {label: 'Response', id: 'receive', section: 1},
        ].reduce((acc, el)=>{
            const cur_time = this.props.timeline[el.id];
            const left = acc.offset;
            const dur = Number((cur_time/this.props.time).toFixed(4));
            const right = 1-acc.offset-dur;
            return {offset: acc.offset+dur, data: [...acc.data,
                {...el, left: `${left*100}%`, right: `${right*100}%`}]};
        }, {offset: 0, data: []}).data
        .reduce((acc, el)=>{
            if (el.section!=acc.last_section)
                return {last_section: el.section, data: [...acc.data, [el]]};
            return {
                last_section: el.section,
                data: [
                    ...acc.data.slice(0, -1),
                    [...acc.data.slice(-1)[0], el],
                ],
            };
        }, {last_section: -1, data: []}).data;
        const children_classes = classnames('children', 'timeline',
            {open: this.state.open});
        const {timeline} = this.props;
        return [
            <li key="li" onClick={this.toggle}
              className={classnames('parent_title', 'expandable',
              {open: this.state.open})}>
              Proxy port: {timeline.port}, session: {timeline.session}
            </li>,
            <ol key="ol" className={children_classes}>
              <table>
                <colgroup>
                  <col className="labels"/>
                  <col className="bars"/>
                  <col className="duration"/>
                </colgroup>
                <tbody>
                  {perc.map((s, i)=>
                    <Timing_header key={i} title={sections[s[0].section]}>
                      {s.map(p=>
                        <Timing_row
                          title={p.label}
                          id={p.id}
                          left={p.left}
                          key={p.id}
                          right={p.right}
                          time={this.props.timeline[p.id]}
                        />
                      )}
                    </Timing_header>
                  )}
                </tbody>
              </table>
            </ol>,
        ];
    }
}

const Timing_header = ({title, children})=>[
    <tr key="timing_header" className="table_header">
      <td>{title}</td>
      <td></td>
      <td>TIME</td>
    </tr>,
    ...children,
];

const Timing_row = ({title, id, left, right, time})=>
    <tr className="timing_row">
      <td>{title}</td>
      <td>
        <div className="timing_bar_wrapper">
          <span className={classnames('timing_bar', id)} style={{left, right}}>
            &#8203;</span>
        </div>
      </td>
      <td><div className="timing_bar_title">{time} ms</div></td>
    </tr>;

export const Pane_timing = class Pane_timing extends Pure_component {
    state = {};
    componentDidMount(){
        this.setdb_on('head.recent_stats', stats=>this.setState({stats}));
    }
    render(){
        const {startedDateTime} = this.props.req;
        const started_at = moment(new Date(startedDateTime)).format(
            'YYYY-MM-DD HH:mm:ss');
        return <div className="timing_view_wrapper">
          <div className="timeline_info">Started at {started_at}</div>
          <ol className="tree_outline">
            {this.props.req.details.timeline.map((timeline, idx)=>
              <Single_timeline key={idx} timeline={timeline}
                time={this.props.req.time} req={this.props.req}/>
            )}
          </ol>
          <div className="timeline_info total">
            Total: {this.props.req.time} ms</div>
          {this.props.req.request.url.endsWith('443') &&
            this.state.stats && this.state.stats.ssl_enable &&
            <Enable_https port={this.props.req.details.port}/>
          }
        </div>;
    }
};
Pane_timing.width = 57;
Pane_timing.id = 'timing';

export const Pane_preview = class Pane_preview extends Pure_component {
    render(){
        const content_type = this.props.req.details.content_type;
        const text = this.props.req.response.content.text;
        const port = this.props.req.details.port;
        let json;
        if (content_type=='unknown')
            return <Encrypted_response_data port={port}/>;
        if (content_type=='xhr' && (json = is_json_str(text)))
            return <JSON_viewer json={json}/>;
        if (content_type=='img')
            return <Img_viewer img={this.props.req.request.url}/>;
        if (content_type=='html')
            return <Codemirror_wrapper req={this.props.req}/>;
        return <div className="pane_preview"></div>;
    }
};
Pane_preview.width = 63;
Pane_preview.id = 'preview';

const No_response_data = ()=>
    <div className="empty_view">
      <div className="block">This request has no response data available.</div>
    </div>;

export const Pane_response = class Pane_response extends Pure_component {
    render(){
        const req = this.props.req;
        const {port, content_type} = req.details;
        if (content_type=='unknown')
            return <Encrypted_response_data port={port}/>;
        if (!content_type||['xhr', 'css', 'js', 'font', 'html', 'other']
            .includes(content_type))
        {
            return <Codemirror_wrapper req={req}/>;
        }
        return <No_response_data/>;
    }
};
Pane_response.width = 72;
Pane_response.id = 'response';

class Pane_troubleshoot extends Pure_component {
    render(){
        const response = this.props.req.response;
        const troubleshoot = get_troubleshoot(response.content.text,
            response.status, response.headers);
        if (troubleshoot.title)
        {
            return <div className="timing_view_wrapper">
              <ol className="tree_outline">
                <li key="li" onClick={this.toggle}
                  className="parent_title expandable open">
                  {troubleshoot.title}
                </li>
                <ol>{troubleshoot.info}</ol>
              </ol>
            </div>;
        }
        return <Pane_info>
          <div>There's not troubleshooting for this request.</div>
        </Pane_info>;
    }
}
Pane_troubleshoot.width = 110;
Pane_troubleshoot.id = 'troubleshooting';

const Pane_rules = withRouter(class Pane_rules extends Pure_component {
    goto_ssl = ()=>{
        this.props.history.push({
            pathname: `/proxy/${this.props.req.details.port}`,
            state: {field: 'trigger_type'},
        });
    };
    render(){
        const {details: {rules}} = this.props.req;
        if (!rules || !rules.length)
        {
            return <Pane_info>
              <div>
                <span>No rules have been triggered on this request. </span>
                <a className="link" onClick={this.goto_ssl}>
                  Configure Rules</a>
              </div>
            </Pane_info>;
        }
        return <div className="rules_view_wrapper">
          <ol className="tree_outline">
            {rules.map((r, idx)=>
              <Rule_preview key={idx} rule={r} idx={idx+1}/>
            )}
          </ol>
        </div>;
    }
});
Pane_rules.width = 50;
Pane_rules.id = 'rules';

class Rule_preview extends Pure_component {
    state = {open: true};
    toggle = ()=>this.setState(prev=>({open: !prev.open}));
    render(){
        const {rule, idx} = this.props;
        const children_classes = classnames('children', 'timeline',
            {open: this.state.open});
        const first_trigger = trigger_types.find(t=>rule[t.value])||{};
        return [
            <li key="li" onClick={this.toggle}
              className={classnames('parent_title', 'expandable',
              {open: this.state.open})}>
              {idx}. {first_trigger.key}
            </li>,
            <ol key="ol" className={children_classes}>
              <Trigger_section rule={rule}/>
              <Action_section actions={rule.action}/>
            </ol>,
        ];
    }
}

const Trigger_section = ({rule})=>
    <div className="trigger_section">
      {trigger_types.map(t=><Trigger key={t.value} type={t} rule={rule}/>)}
    </div>;

const Trigger = ({type, rule})=>{
    if (!rule[type.value])
        return null;
    return <div className="trigger">
      {type.key}: {rule[type.value]}
    </div>;
};

const Action_section = ({actions})=>
    <div className="action_section">
      {Object.keys(actions).map(a=>
        <Action key={a} action={a} value={actions[a]}/>
      )}
    </div>;

const Action = ({action, value})=>{
    const key = (action_types.find(a=>a.value==action)||{}).key;
    const val = action=='request_url' ? value&&value.url : value;
    return <div className="action">
      {key} {val ? `: ${val}` : ''}
    </div>;
};

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
        this.batch_size = 30;
        this.loaded = {from: 0, to: 0};
        this.reqs_to_render = [];
        this.temp_total = 0;
        this.take_reqs_from_pool = _.throttle(this.take_reqs_from_pool, 100);
        this.set_new_params_debounced = _.debounce(this.set_new_params, 400);
    }
    componentDidMount(){
        ws.addEventListener('har_viewer', this.on_request);
        ws.addEventListener('har_viewer_start', this.on_request_started);
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
            const suggestions = yield Api.json.get('logs_suggestions');
            suggestions.status_codes.unshift(...[2, 3, 4, 5].map(v=>`${v}**`));
            setdb.set('head.logs_suggestions', suggestions);
        });
    }
    willUnmount(){
        ws.removeEventListener('har_viewer', this.on_request);
        ws.removeEventListener('har_viewer_start', this.on_request_started);
        setdb.set('head.har_viewer.reqs', []);
        setdb.set('head.har_viewer.stats', null);
        setdb.set('har_viewer', null);
        loader.end();
        this.take_reqs_from_pool.cancel();
    }
    on_request_started = event=>{
        event.data.req.pending = true;
        this.on_request(event);
    };
    on_request = ({data})=>{
        this.reqs_to_render.push(data.req);
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
            const res = yield Api.json.get('logs', {qs: params});
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
        this.etask(function*(){
            loader.start();
            yield Api.put('logs_reset', {}, {qs: params});
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
        const show = this.state.proxies && this.state.logs>0;
        if (!show)
        {
            return <Route
              path={['/logs', '/proxy/:port/logs/har']}
              component={Logs_off_notice}
            />;
        }
        const panes = [
            Pane_headers,
            Pane_preview,
            Pane_response,
            Pane_timing,
            Pane_rules,
            Pane_troubleshoot,
        ];
        return <Har_viewer
          {...this.props}
          panes={panes}
          Cell_value={Cell_value}
          table_cols={table_cols}
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
          toolbar
          Waypoint={Waypoint}
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

