// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import ReactDOM from 'react-dom';
import {withRouter} from 'react-router-dom';
import ajax from '../../util/ajax.js';
import setdb from '../../util/setdb.js';
import zescape from '../../util/escape.js';
import csv from '../../util/csv.js';
import etask from '../../util/etask.js';
import zutil from '../../util/util.js';
import classnames from 'classnames';
import filesaver from 'file-saver';
import {get_static_country, report_exception} from './util.js';
import $ from 'jquery';
import Proxy_blank from './proxy_blank.js';
import {Checkbox, any_flag, flag_with_title, No_zones,
    Tooltip_bytes, Loader_small, Toolbar_button} from './common.js';
import Zone_description from './common/zone_desc.js';
import {Modal_dialog, Modal} from './common/modals.js';
import {T} from './common/i18n.js';
import {Search_box} from './chrome_widgets.js';
import {AutoSizer, Table, Column} from 'react-virtualized';
import 'react-virtualized/styles.css';
import Tooltip from './common/tooltip.js';
import {OverlayTrigger, Tooltip as B_tooltip} from 'react-bootstrap';
import './css/proxies.less';

const is_local = ()=>{
    const href = window.location.href;
    return href.includes('localhost') || href.includes('127.0.0.1');
};

const Actions_cell = ({proxy, mgr, scrolling, open_delete_dialog})=>{
    return <Actions proxy={proxy} get_status={mgr.get_status}
          update_proxies={mgr.update} scrolling={scrolling}
          open_delete_dialog={open_delete_dialog}/>;
};

class Targeting_cell extends Pure_component {
    render(){
        const {proxy, mgr} = this.props;
        const zones = mgr.state.zones;
        const static_country = get_static_country(proxy, zones);
        if (static_country && static_country!='any' && static_country!='*')
        {
            return flag_with_title(static_country,
                static_country.toUpperCase());
        }
        let val = proxy.country;
        if (!val||val=='any'||val=='*')
            return any_flag;
        val = val.toUpperCase();
        const state = proxy.state&&proxy.state.toUpperCase();
        if (!state)
            return flag_with_title(proxy.country, val);
        if (!proxy.city)
            return flag_with_title(proxy.country, `${val} (${state})`);
        return flag_with_title(proxy.country,
            `${val} (${state}), ${proxy.city}`);
    }
}

const Status_cell = ({proxy})=>{
    const status = proxy.status;
    const status_details = proxy.status_details;
    let details = (status_details||[]).map(d=>d.msg).join(',');
    if (!details.length && status!='ok')
        details = status;
    if (status=='testing')
        return <Tooltip title="Status is being tested">Testing</Tooltip>;
    else if (status && status!='ok')
        return <Tooltip title={details}>{details}</Tooltip>;
    else if (status=='ok' && details)
    {
        return <Tooltip title={details}>
            <span>OK<div className="ic_warning"/></span>
          </Tooltip>;
    }
    else if (status=='ok' && !details)
        return <Tooltip title="This proxy works correctly">OK</Tooltip>;
    return <Tooltip title="Status of this proxy is unknown">?</Tooltip>;
};

const Boolean_cell = ({proxy, col})=>{
    if (proxy[col]===true)
        return <img src="/img/ic_checkmark.svg"/>;
    return <img src="/img/ic_off.svg"/>;
};

const Static_ip_cell = ({proxy, mgr})=>{
    if (proxy.ip)
        return proxy.ip;
    const curr_zone = mgr.state.zones.zones.find(z=>z.name==proxy.zone);
    const curr_plan = curr_zone && curr_zone.plan;
    const is_static = curr_plan && (curr_plan.type||'').startsWith('static');
    if (is_static && proxy.pool_size)
    {
        if (Array.isArray(proxy.ips) && proxy.ips.length==1)
            return proxy.ips[0];
        return `Pool of ${proxy.pool_size} IP${proxy.pool_size==1 ? '' : 's'}`;
    }
    return null;
};

class Type_cell extends React.Component {
    render(){
        if (this.props.scrolling)
            return 'Luminati';
        const proxy = this.props.proxy;
        let val, tip;
        if (proxy.ext_proxies)
        {
            val = 'External';
            tip = 'Proxy port configured with external IP and credentials';
        }
        else
        {
            val = 'Luminati';
            tip = 'Proxy port using your Luminati account';
        }
        return <T>{t=><Tooltip title={t(tip)}>{t(val)}</Tooltip>}</T>;
    }
}

class Browser_cell extends Pure_component {
    open_browser = e=>{
        e.stopPropagation();
        const _this = this;
        this.etask(function*(){
            const url = `/api/browser/${_this.props.proxy.port}`;
            const res = yield window.fetch(url);
            if (res.status==206)
                $('#fetching_chrome_modal').modal();
        });
    };
    render(){
        const class_names = 'btn btn_lpm btn_lpm_small';
        const tooltip = 'Open browser configured with this port';
        return is_local() && <T>{t=><Tooltip title={t(tooltip)}>
              <button className={class_names}
                onClick={this.open_browser}>Browser</button>
            </Tooltip>}</T>;
    }
}

class Port_cell extends Pure_component {
    state = {expanded: this.props.proxy.expanded};
    toggle = e=>{
        e.stopPropagation();
        const _this = this.props.mgr;
        const proxies = _this.state.proxies.slice();
        let master_proxy = proxies.find(p=>p.port==this.props.proxy.port);
        master_proxy.expanded = !master_proxy.expanded;
        const visible_proxies = _this.get_visible_proxies(proxies);
        _this.setState({proxies, visible_proxies});
        this.setState(prev=>({open: !prev.open}));
    };
    componentDidUpdate(){
        this.setState({expanded: this.props.proxy.expanded});
    }
    render(){
        const {proxy, scrolling} = this.props;
        if (scrolling)
            return proxy.port;
        const is_multiplied_port = !proxy.master_port && proxy.multiply &&
            proxy.multiply>1;
        const val = is_multiplied_port ? proxy.port+':1..'+proxy.multiply :
            proxy.port;
        const title = `${proxy.port} is a proxy port that refers to a specific
        virtual location on a computer. You can use it as a virtual proxy to
        send requests`;
        if (is_multiplied_port)
        {
            const c = this.state.expanded ? 'open' : 'before';
            const classes = classnames('expandable', c);
            return <Tooltip title={title}>
                  <div className='port_cell master'>
                    <div onClick={this.toggle} className={classes}/>
                    <div>{val}</div>
                  </div>
                </Tooltip>;
        }
        const c = proxy.master_port ? 'port_cell multiplied' : null;
        return <Tooltip title={title}>
              <div className={c}>{val}</div>
            </Tooltip>;
    }
}

const Success_rate_cell = ({proxy})=>{
    const val = !proxy.reqs ? '—' :
        (proxy.success/proxy.reqs*100).toFixed(2)+'%';
    return <T>{t=>
          <Tooltip title={`${t('Total')}: ${proxy.reqs||0}, ${
            t('Success')}: ${proxy.success||0}`}>{val}</Tooltip>
        }</T>;
};

const Reqs_cell = ({proxy})=>{
    const reqs = proxy.reqs||0;
    return <Tooltip title={`${reqs} requests sent through this proxy port`}>
        {reqs}</Tooltip>;
};

const Zone_cell = ({proxy, mgr, scrolling})=>{
    if (scrolling)
        return proxy.zone;
    const zones = mgr.state.zones;
    return <div>
          <OverlayTrigger
            placement="top"
            overlay={
              <B_tooltip id={`${proxy.port}-zone-tooltip`}>
                <div className="zone_tooltip">
                  <Zone_description zones={zones} zone_name={proxy.zone}/>
                </div>
              </B_tooltip>
            }
          >
            <span>{proxy.zone}</span>
          </OverlayTrigger>
        </div>;
};

const Rules_cell = ({proxy: {rules=[]}})=>{
    const tip = 'Number of defined rules for this proxy port';
    const val = rules.length;
    return !!val && <T>{t=><Tooltip title={t(tip)}>{t(val)}</Tooltip>}</T>;
};

const columns = [
    {
        key: 'actions',
        title: 'lpm_ports_actions',
        tooltip: `Delete/duplicate/refresh sessions/open browser`,
        ext: true,
        sticky: true,
        render: Actions_cell,
        width: 80,
        shrink: 0,
        grow: 0,
        csv: false,
    },
    {
        key: 'internal_name',
        title: 'Internal name',
        tooltip: `An internal name is used for proxy ports to be easily \
            distinguished. Those don't change any proxy behavior and it's only
            cosmetic`,
        ext: true,
        calc_show: proxies=>proxies.some(p=>p.internal_name),
    },
    {
        key: 'port',
        title: 'Proxy port',
        sticky: true,
        render: Port_cell,
        tooltip: 'A proxy port is a number that refers to a specific virtual '
            +'location on a computer. Create and configure proxy ports, then '
            +'connect the crawler to send requests through the port',
        ext: true,
        dynamic: true,
        width: 90,
    },
    {
        key: 'proxy_type',
        title: 'Type',
        render: Type_cell,
        tooltip: 'Type of connected proxy - Luminati proxy or external proxy '
            +'(non-Luminati)',
        ext: true,
        width: 70,
    },
    {
        key: 'status',
        title: 'Status',
        type: 'status',
        render: Status_cell,
        default: true,
        tooltip: 'Real time proxy status',
        ext: true,
        dynamic: true,
        width: 55,
    },
    {
        key: 'iface',
        title: 'Interface',
        type: 'options',
        tooltip: 'Specific network interface on which the local machine is '
            +'running. Switch interfaces in the proxy configuration page',
        ext: true,
    },
    {
        key: 'multiply',
        title: 'Multiply',
        type: 'number',
        tooltip: 'Number of multiplied proxy ports. A proxy port can be '
            +'multiplied in the proxy configuration page',
        ext: true,
    },
    {
        key: 'ssl',
        title: 'SSL Analyzing',
        render: Boolean_cell,
        tooltip: 'In order to log HTTPS requests, enable SSL request logs in '
            +'proxy configuration',
        ext: true,
    },
    {
        key: 'proxy_connection_type',
        title: 'Proxy connection type',
        tooltip: 'Connection type between LPM and Super Proxy',
        ext: true,
    },
    {
        key: 'zone',
        title: 'Zone',
        type: 'options',
        default: true,
        tooltip: 'Specific Luminati zone configured for this proxy. Switch '
            +'zones in proxy configuration page.',
        render: Zone_cell,
    },
    {
        key: 'country',
        title: 'Targeting',
        type: 'options',
        default: true,
        render: Targeting_cell,
        tooltip: 'Exit node (IP) GEO location',
        width: 62,
    },
    {
        key: 'asn',
        title: 'ASN',
        type: 'number',
        tooltip: 'ASN uniquely identifies each network on the internet. You '
            +'can target exit nodes (IPs) on specific ASNs',
    },
    {
        key: 'rotate_session',
        title: 'Rotate IPs',
        render: Boolean_cell,
        ext: true,
    },
    {
        key: 'pool_size',
        title: 'Pool size',
        type: 'number',
        ext: true,
    },
    {
        key: 'sticky_ip',
        title: 'Sticky IP',
        render: Boolean_cell,
        ext: true,
    },
    {
        key: 'rules',
        title: 'Rules',
        render: Rules_cell,
        ext: true,
    },
    {
        key: 'dns',
        title: 'DNS',
        type: 'options',
    },
    {
        key: 'ip',
        title: 'Static IPs',
        type: 'text',
        calc_show: proxies=>proxies.some(p=>p.multiply_ips),
        render: Static_ip_cell,
    },
    {
        key: 'user',
        title: 'User',
        type: 'text',
        ext: true,
        calc_show: proxies=>proxies.some(p=>p.multiply_users),
    },
    {
        key: 'vip',
        title: 'gIP',
        type: 'number',
        tooltip: 'A gIP is a group of exclusive residential IPs. Using gIPs '
            +'ensures that nobody else uses the same IPs with the same target '
            +'sites as you do.',
    },
    {
        key: 'proxy',
        title: 'Super Proxy',
        type: 'text'
    },
    {
        key: 'throttle',
        title: 'Throttle concurrent connections',
        type: 'number',
        ext: true,
    },
    {
        key: 'success',
        title: 'Success',
        tooltip: 'The ratio of successful requests out of total requests. A '
            +'request is considered as successful if the server of the '
            +'destination website responded',
        render: Success_rate_cell,
        default: true,
        ext: true,
        dynamic: true,
        width: 58,
    },
    {
        key: 'in_bw',
        title: 'BW up',
        render: ({proxy})=>Tooltip_bytes({bytes: proxy.out_bw}),
        ext: true,
        tooltip: 'Data transmitted to destination website. This includes'
            +'request headers, request data, response headers, response data',
        dynamic: true,
        width: 90,
    },
    {
        key: 'out_bw',
        title: 'BW down',
        render: ({proxy})=>Tooltip_bytes({bytes: proxy.in_bw}),
        ext: true,
        tooltip: 'Data transmitted to destination website. This includes'
            +'request headers, request data, response headers, response data',
        dynamic: true,
        width: 90,
    },
    {
        key: 'bw',
        title: 'BW',
        render: ({proxy})=>Tooltip_bytes({bytes: proxy.bw,
            bytes_out: proxy.out_bw, bytes_in: proxy.in_bw}),
        default: true,
        ext: true,
        tooltip: 'Data transmitted to destination website. This includes'
            +'request headers, request data, response headers, response data',
        dynamic: true,
        width: 90,
    },
    {
        key: 'reqs',
        title: 'Requests',
        render: Reqs_cell,
        default: true,
        ext: true,
        tooltip: 'Number of all requests sent from this proxy port',
        dynamic: true,
        grow: 1,
        width: 60,
    },
    {
        key: 'browser',
        title: 'Browser',
        render: Browser_cell,
        default: true,
        tooltip: 'Open browser configured with this port',
        width: 80,
        grow: 0,
        shrink: 0,
        hide_col_title: true,
    },
];

const columns_obj = Object.keys(columns)
    .reduce((acc, col)=>({...acc, [columns[col].key]: columns[col]}), {});

class Columns_modal extends Pure_component {
    state = {selected_cols: []};
    componentDidMount(){
        const selected_cols = this.props.selected_cols.reduce((acc, e)=>
            Object.assign(acc, {[e]: true}), {});
        this.setState({selected_cols, saved_cols: selected_cols});
    }
    on_change = ({target: {value}})=>{
        this.setState(prev=>({selected_cols: {
            ...prev.selected_cols,
            [value]: !prev.selected_cols[value],
        }}));
    };
    click_ok = ()=>{
        const new_columns = Object.keys(this.state.selected_cols).filter(c=>
            this.state.selected_cols[c]);
        this.props.update_selected_cols(new_columns);
        window.localStorage.setItem('columns', JSON.stringify(
            this.state.selected_cols));
    };
    click_cancel = ()=>this.setState({selected_cols: this.state.saved_cols});
    select_all = ()=>{
        this.setState({selected_cols: columns.filter(c=>!c.sticky)
            .reduce((acc, e)=>Object.assign(acc, {[e.key]: true}), {})});
    };
    select_none = ()=>this.setState({selected_cols: {}});
    select_default = ()=>{
        this.setState({selected_cols: columns.filter(c=>!c.sticky&&c.default)
            .reduce((acc, e)=>Object.assign(acc, {[e.key]: true}), {})});
    };
    render(){
        const header = <div className="header_buttons">
              <button onClick={this.select_all} className="btn btn_lpm">
                <T>Check all</T></button>
              <button onClick={this.select_none} className="btn btn_lpm">
                <T>Uncheck all</T></button>
              <button onClick={this.select_default} className="btn btn_lpm">
                <T>Default</T></button>
            </div>;
        return <Modal id="edit_columns" custom_header={header}
              click_ok={this.click_ok} cancel_clicked={this.click_cancel}>
              <div className="row columns">
                {columns.filter(col=>!col.sticky).map(col=>
                  <div key={col.key} className="col-md-6">
                    <T>{t=>
                      <Checkbox text={t(col.title)} value={col.key}
                        on_change={this.on_change}
                        checked={!!this.state.selected_cols[col.key]}/>
                    }</T>
                  </div>
                )}
              </div>
            </Modal>;
    }
}

const Proxies = withRouter(class Proxies extends Pure_component {
    update_window_dimensions = ()=>
        this.setState({height: window.innerHeight});
    constructor(props){
        super(props);
        let from_storage = JSON.parse(window.localStorage.getItem(
            'columns'))||{};
        from_storage = Object.keys(from_storage).filter(c=>from_storage[c]);
        const default_cols = columns.filter(c=>c.default).map(col=>col.key);
        this.state = {
            selected_cols: from_storage.length && from_storage || default_cols,
            proxies: [],
            selected_proxies: {},
            checked_all: false,
            proxy_filter: '',
            sort: {sort_by: 'port', sort_direction: 'asc'},
            visible_proxies: null,
            loaded: false,
            height: window.innerHeight,
            open_delete_dialog: false,
            delete_proxies: [],
        };
        setdb.set('head.proxies.update', this.update);
    }
    componentDidMount(){
        this.setdb_on('head.proxies_running', proxies=>{
            if (!proxies)
                return;
            let proxy_filter = proxies.length ? this.state.proxy_filter : '';
            proxies = this.prepare_proxies(proxies);
            const visible_proxies = this.get_visible_proxies(proxies,
                proxy_filter);
            this.setState(
                {proxies, visible_proxies, proxy_filter, loaded: true});
        });
        this.setdb_on('head.locations', locations=>{
            if (!locations)
                return;
            const countries = locations.countries_by_code;
            this.setState({countries});
        });
        this.setdb_on('ws.zones', zones=>{
            if (!zones)
                return;
            this.setState({zones});
            return this.update();
        });
        this.timeout_id = window.setTimeout(this.req_status);
        this.update_window_dimensions();
        window.addEventListener('resize', this.update_window_dimensions);
    }
    willUnmount(){
        window.clearTimeout(this.timeout_id);
        window.removeEventListener('resize', this.update_window_dimensions);
    }
    get_visible_proxies = (proxies, proxy_filter, sort)=>{
        if (proxy_filter===undefined)
            proxy_filter = this.state.proxy_filter;
        sort = sort||this.state.sort;
        const is_master_proxy = port=>proxy=>proxy.port==port;
        proxies = proxies.filter(p=>{
            if (proxy_filter &&
                !(p.internal_name||'').includes(proxy_filter) &&
                !(p.zone||'').includes(proxy_filter) &&
                !(''+p.port||'').includes(proxy_filter))
            {
                return false;
            }
            if (p.proxy_type=='duplicate')
            {
                return proxies.filter(is_master_proxy(p.master_port))[0]
                    .expanded;
            }
            return true;
        });
        let {zones} = this.state;
        const res = [...proxies].sort((p1, p2)=>{
            let v1 = p1[sort.sort_by], v2 = p2[sort.sort_by];
            if (sort.sort_by=='country')
            {
                v1 = get_static_country(p1, zones)||p1.country||'any';
                v2 = get_static_country(p2, zones)||p2.country||'any';
            }
            return (sort.sort_direction=='asc' ? 1 : -1) *
                (v1 > v2 ? 1 : v1 < v2 ? -1 : 0);
        });
        return res;
    };
    prepare_proxies = proxies=>{
        proxies.sort(function(a, b){ return a.port>b.port ? 1 : -1; });
        for (let i=0; i<proxies.length; i++)
        {
            const cur = proxies[i];
            if (Array.isArray(cur.proxy)&&cur.proxy.length==1)
                cur.proxy = cur.proxy[0];
            cur.status_details = cur.status_details||[];
        }
        return proxies;
    };
    req_status = ()=>{
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>_this.etask(function*(){
                yield report_exception(e, 'proxies.Proxies.req_status');
            }));
            const params = {};
            const url = zescape.uri('/api/recent_stats', params);
            const stats = yield ajax.json({url});
            setdb.set('head.recent_stats', stats);
            if (!_this.state.proxies.length ||
                zutil.equal_deep(stats, _this.state.stats))
            {
                yield etask.sleep(1000);
                _this.req_status();
                return;
            }
            _this.setState(prev=>{
                const new_proxies_a = prev.proxies.map(p=>{
                    let stat = {reqs: 0, success: 0, in_bw: 0, out_bw: 0,
                        bw: 0};
                    if (''+p.port in stats.ports)
                        stat = stats.ports[p.port];
                    p.in_bw = stat.in_bw;
                    p.out_bw = stat.out_bw;
                    p.bw = p.in_bw+p.out_bw;
                    p.reqs = stat.reqs;
                    p.success = stat.success;
                    p.last_req = {url: stat.url, ts: stat.timestamp};
                    if (p.proxy_type!='duplicate')
                        p.expanded = !!p.expanded;
                    return p;
                });
                const new_proxies = {};
                for (let p of new_proxies_a)
                    new_proxies[p.port] = p;
                for (let p of Object.values(new_proxies))
                {
                    if (p.proxy_type=='duplicate')
                    {
                        const master_port = new_proxies[p.master_port];
                        master_port.in_bw += p.in_bw;
                        master_port.out_bw += p.out_bw;
                        master_port.bw += p.bw;
                        master_port.reqs += p.reqs;
                        master_port.success += p.success;
                        if (!master_port.last_req.ts ||
                            p.last_req.ts &&
                            p.last_req.ts>master_port.last_req.ts)
                        {
                            master_port.last_req = p.last_req;
                        }
                    }
                }
                const visible_proxies = _this.get_visible_proxies(
                    Object.values(new_proxies));
                return {proxies: Object.values(new_proxies), visible_proxies,
                    stats};
            });
            yield etask.sleep(1000);
            _this.req_status();
        });
    };
    update = ()=>{
        this.setState({selected_proxies: {}, checked_all: false});
        return this.etask(function*(){
            const proxies = yield ajax.json({url: '/api/proxies_running'});
            setdb.set('head.proxies_running', proxies);
        });
    };
    download_csv = ()=>{
        const cols = this.get_cols().filter(c=>c.csv==undefined || c.csv);
        const titles = [cols.map(col=>col.title)];
        const data = titles.concat(this.state.proxies.map(p=>{
            return cols.map(col=>{
                const val = zutil.get(p, col.key);
                if (val==undefined)
                    return '-';
                return val;
            });
        }));
        filesaver.saveAs(csv.to_blob(data), 'proxies.csv');
    };
    edit_columns = ()=>$('#edit_columns').modal('show');
    update_selected_columns = new_columns=>
        this.setState({selected_cols: new_columns});
    select_renderer = function Select_renderer(props){
        if (props.rowData=='filler')
            return <div className="cp_td"></div>;
        const {selected_proxies} = this.state;
        const checked = !!selected_proxies[props.rowData.port];
        return <Checkbox checked={checked}
          on_change={()=>this.on_row_select(props.rowData)}
          on_click={e=>e.stopPropagation()}/>;
    };
    on_row_select = proxy=>{
        const {selected_proxies} = this.state;
        const new_selected = Object.assign({}, selected_proxies);
        if (selected_proxies[proxy.port])
            delete new_selected[proxy.port];
        else
            new_selected[proxy.port] = proxy;
        this.setState({selected_proxies: new_selected});
    };
    all_rows_select = ()=>{
        const checked_all = !this.state.checked_all;
        const selected_proxies = checked_all ?
            this.state.visible_proxies.reduce((obj, p)=>{
                obj[p.port] = p;
                return obj;
            }, {}) : {};
        this.setState({selected_proxies, checked_all});
    };
    cell_renderer = function Cell_renderer(props){
        return <Cell {...props}
            mgr={this}
            history={this.props.history}
            open_delete_dialog={this.open_delete_dialog}/>;
    };
    on_row_click = e=>{
        const proxy = e.rowData;
        if (proxy.proxy_type!='persist')
            return;
        if (proxy.master_port)
            return;
        this.props.history.push(`/proxy/${proxy.port}`);
    };
    get_cols = ()=>{
        if (!is_local())
        {
            const actions_idx = columns.findIndex(col=>col.key=='actions');
            columns[actions_idx].width = 60;
        }
        return columns.filter(col=>this.state.selected_cols.includes(col.key)
            || col.sticky || col.calc_show && col.calc_show(
                this.state.visible_proxies||[]));
    };
    open_delete_dialog = proxies=>{
        this.setState({delete_proxies: proxies, open_delete_dialog: true});
    };
    close_delete_dialog = ()=>{
        this.setState({open_delete_dialog: false});
    };
    set_proxy_filter(e){
        let proxy_filter = e.target.value;
        const visible_proxies = this.get_visible_proxies(this.state.proxies,
            proxy_filter);
        this.setState({proxy_filter, visible_proxies, selected_proxies: {}});
    }
    set_sort({sortBy: sort_by, sortDirection: sort_direction}){
        if (sort_by=='select')
            return;
        sort_direction = sort_direction.toLowerCase();
        let sort = {sort_by, sort_direction};
        const visible_proxies = this.get_visible_proxies(this.state.proxies,
            undefined, sort);
        this.setState({sort, visible_proxies, selected_proxies: {}});
    }
    render(){
        let {proxies, visible_proxies, proxy_filter} = this.state;
        const cols = this.get_cols();
        if (!this.state.zones || !this.state.countries || !visible_proxies)
        {
            return <div className="proxies_panel">
              <div className="main_panel vbox">
                <Loader_small show loading_msg="Loading..."/>
              </div>
            </div>;
        }
        let {sort_by, sort_direction} = this.state.sort;
        let show_table = !!proxies.length;
        if (!this.state.zones.zones.length)
            return <No_zones/>;
        if (this.state.loaded && !show_table)
            return <Proxy_blank/>;
        return <React.Fragment>
            <div className="main_panel vbox cp_panel proxies_panel">
              <Header_panel edit_columns={this.edit_columns}
                download_csv={this.download_csv}
                selected={this.state.selected_proxies}
                open_delete_dialog={this.open_delete_dialog}
                proxy_filter={proxy_filter}
                on_proxy_filter_change={e=>this.set_proxy_filter(e)}/>
              {this.state.loaded && show_table &&
                <div className="main_panel vbox">
                  <div className="main_panel flex">
                  <AutoSizer>
                    {({height, width})=>
                      <T>{t=><Table width={width}
                        height={height}
                        onRowClick={this.on_row_click}
                        onHeaderClick={({dataKey})=>dataKey=='select' &&
                          this.all_rows_select()}
                        headerHeight={30}
                        headerClassName="cp_th"
                        rowClassName={({index})=>
                            visible_proxies[index] &&
                            visible_proxies[index].master_port ?
                            'cp_tr disabled filler' : 'cp_tr'}
                        rowHeight={40}
                        sort={sort=>this.set_sort(sort)}
                        sortBy={sort_by}
                        sortDirection={sort_direction.toUpperCase()}
                        rowCount={visible_proxies.length}
                        rowGetter={({index})=>
                          visible_proxies[index]||'filler'}>
                        <Column key="select"
                          cellRenderer={this.select_renderer.bind(this)}
                          label={<Checkbox checked={this.state.checked_all}
                            on_change={()=>null}/>}
                          dataKey="select"
                          className="cp_td"
                          flexGrow={0}
                          flexShrink={0}
                          width={14}/>
                        {cols.map(col=>
                          <Column key={col.key}
                            cellRenderer={this.cell_renderer.bind(this)}
                            label={col.hide_col_title ? '' : t(col.title)}
                            className="cp_td"
                            dataKey={col.key}
                            flexGrow={col.grow!==undefined ? col.grow : 1}
                            flexShrink={col.shrink!==undefined ?
                              col.shrink : 1}
                            width={col.width||100}/>
                        )}
                      </Table>}</T>
                    }
                  </AutoSizer>
                  </div>
                </div>
              }
            </div>
            <Columns_modal selected_cols={this.state.selected_cols}
              update_selected_cols={this.update_selected_columns}/>
            <Delete_dialog open={this.state.open_delete_dialog}
              close_dialog={this.close_delete_dialog}
              proxies={this.state.delete_proxies}
              update_proxies={this.update}/>
          </React.Fragment>;
    }
});

const Header_panel = props=>
    <div className="cp_panel_header">
      <h2>Proxy ports</h2>
      <Toolbar {...props}/>
    </div>;

class Delete_dialog extends Pure_component {
    delete_proxies = e=>{
        e.stopPropagation();
        const _this = this;
        const ports = _this.props.proxies.map(p=>p.port);
        this.etask(function*(){
            yield window.fetch('/api/proxies/delete', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ports}),
            });
            yield _this.props.update_proxies();
            _this.props.close_dialog();
        });
    };
    render(){
        const {proxies, open, close_dialog} = this.props;
        let title = 'Are you sure you want to delete ';
        if (proxies.length==1)
            title += `proxy port ${proxies[0].port}?`;
        else
            title += `${proxies.length} proxy ports?`;
        return <Portal>
          <Modal_dialog open={open}
            title={title}
            ok_clicked={this.delete_proxies}
            cancel_clicked={close_dialog} />
        </Portal>;
    }
}

class Toolbar extends Pure_component {
    state = {
        filters: false,
    };
    open_delete_dialog_with_proxies = e=>{
        e.stopPropagation();
        this.props.open_delete_dialog(this.get_to_delete());
    };
    get_to_delete = ()=>{
        const {selected} = this.props;
        return Object.values(selected).filter(p=>p.proxy_type=='persist');
    };
    toggle_filters(){
        this.setState({filters: !this.state.filters});
    }
    render(){
        const {edit_columns, download_csv} = this.props;
        const to_delete = this.get_to_delete();
        return <div className="toolbar">
            {this.state.filters &&
              <Search_box val={this.props.proxy_filter}
                on_change={this.props.on_proxy_filter_change}/>
            }
            <Toolbar_button tooltip="Filters"
              on_click={()=>this.toggle_filters()} id="filters"/>
            <Toolbar_button tooltip="Edit columns" on_click={edit_columns}
              id="columns"/>
            <Toolbar_button tooltip="Download all proxy ports as CSV"
              on_click={download_csv} id="download"/>
            {!!to_delete.length &&
              <Toolbar_button tooltip="Delete selected proxies"
                on_click={this.open_delete_dialog_with_proxies} id="remove"/>
            }
          </div>;
    }
}

class Cell extends React.Component {
    shouldComponentUpdate(next_props){
        if (this.props.dataKey=='last_req.url')
            return true;
        return this.props.cellData!=next_props.cellData ||
            this.props.rowData!=next_props.rowData;
    }
    cell_clicked = e=>{
        const p = this.props.rowData;
        if (p.master_port)
            return;
        e.stopPropagation();
        this.props.history.push({
            pathname: `/proxy/${p.port}`,
            state: {field: this.props.dataKey},
        });
    };
    render(){
        const props = this.props;
        const col = columns_obj[props.dataKey];
        const proxy = props.rowData;
        if (props.rowData=='filler')
            return <div className="cp_td"></div>;
        else if (!col.ext && proxy.ext_proxies)
            return '—';
        else if (col.render)
        {
            const S_cell = col.render;
            return <span onClick={this.cell_clicked}>
                <S_cell proxy={props.rowData}
                  mgr={props.mgr}
                  col={props.dataKey}
                  open_delete_dialog={props.open_delete_dialog}/>
              </span>;
        }
        return props.cellData||'';
    }
}

class Actions extends Pure_component {
    componentDidMount(){
        if (!this.props.proxy.status)
            this.get_status();
    }
    // XXX krzysztof: this logic is a mess, rewrite it
    get_status = (opt={})=>{
        const proxy = this.props.proxy;
        if (!opt.force && proxy.status=='ok')
            return;
        return this.etask(function*(){
            this.on('uncaught', e=>{
                proxy.status = 'error';
                proxy.status_details = [{msg: e.message}];
                setdb.emit_path('head.proxies_running');
            });
            const params = {};
            if (!proxy.status)
                proxy.status = 'testing';
            if (opt.force)
            {
                proxy.status = 'testing';
                params.force = true;
            }
            if (proxy.status=='testing')
                setdb.emit_path('head.proxies_running');
            const uri = '/api/proxy_status/'+proxy.port;
            const url = zescape.uri(uri, params);
            const res = yield ajax.json({url, timeout: 25000});
            if (res.status!='ok')
            {
                const errors = res.status_details||[];
                res.status_details = errors.length ?
                    errors : [{msg: res.status}];
                res.status = 'error';
            }
            proxy.status = res.status;
            proxy.status_details = res.status_details||[];
            setdb.emit_path('head.proxies_running');
        });
    };
    refresh_sessions = e=>{
        e.stopPropagation();
        const _this = this;
        this.etask(function*(){
            const url = '/api/refresh_sessions/'+_this.props.proxy.port;
            yield ajax.json({url, method: 'POST'});
            yield _this.get_status({force: true});
        });
    };
    duplicate = event=>{
        event.stopPropagation();
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>_this.etask(function*(){
                yield report_exception(e, 'proxies.Actions.duplicate');
            }));
            yield window.fetch('/api/proxy_dup', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({port: _this.props.proxy.port}),
            });
            yield _this.props.update_proxies();
        });
    };
    open_delete_dialog_with_port = e=>{
        e.stopPropagation();
        this.props.open_delete_dialog([this.props.proxy]);
    };
    render(){
        const persist = this.props.proxy.proxy_type=='persist';
        return <div className={is_local() ? 'proxies_actions' :
          'proxies_actions_local'}>
            {!!persist &&
              <React.Fragment>
                <Action_icon id="remove" scrolling={this.props.scrolling}
                  on_click={this.open_delete_dialog_with_port}
                  tooltip="Delete" invisible={!persist}/>
                <Action_icon id="duplicate" on_click={this.duplicate}
                  tooltip="Duplicate proxy port" invisible={!persist}
                  scrolling={this.props.scrolling}/>
              </React.Fragment>
            }
            <Action_icon id="refresh" scrolling={this.props.scrolling}
              on_click={this.refresh_sessions}
              tooltip="Refresh Sessions"/>
          </div>;
    }
}

const Portal = props=>ReactDOM.createPortal(props.children,
    document.getElementById('del_modal'));

const Action_icon = props=>{
    let {on_click, invisible, id, tooltip, scrolling} = props;
    const classes = classnames('action_icon', 'cp_icon', id,
        {invisible});
    if (scrolling)
        return <div className={classes}/>;
    return <T>{t=><Tooltip title={t(tooltip)}>
          <div onClick={on_click} className={classes}/>
        </Tooltip>}</T>;
};

export default Proxies;
