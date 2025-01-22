// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React, {useMemo} from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import {OverlayTrigger, Tooltip as B_tooltip} from 'react-bootstrap';
import {withRouter} from 'react-router-dom';
import filesaver from 'file-saver';
import $ from 'jquery';
import _ from 'lodash4';
import {
    Input,
    Modal,
    Tooltip,
    Button,
    Table,
    Link,
} from 'uikit';
import ajax from '../../util/ajax.js';
import setdb from '../../util/setdb.js';
import csv from '../../util/csv.js';
import etask from '../../util/etask.js';
import zutil from '../../util/util.js';
import {
    get_static_country,
    report_exception,
    networks,
    is_local,
} from './util.js';
import Proxy_blank from './proxy_blank.js';
import {
    any_flag,
    flag_with_title,
    No_zones,
    Inline_wrapper,
    Tooltip_bytes,
    Warnings,
    Icon_text,
    Icon_check,
    Icon_close,
    Context_menu,
} from './common.js';
import Zone_description from './common/zone_desc.js';
import {t} from './common/i18n.js';
import 'react-virtualized/styles.css';
import ws from './ws.js';
import {main as Api} from './api.js';
import Toolbar from './proxies_toolbar.js';
import './css/proxies.less';

const {Popup} = Modal, {Checkbox} = Input, {keys, values, assign} = Object;

const Actions_cell = ({row, column})=>{
    const {proxy, mgr} = row.original;
    return <Actions proxy={proxy} open_delete_dialog={mgr.open_delete_dialog}
          update_proxies={mgr.update} get_status={mgr.get_status}
          show_error_ntf={mgr.show_error_ntf} tooltip={column.tooltip}/>;
};

const Targeting_cell = props=>{
    const {proxy, mgr} = props.row.original;
    const title = (t_country, t_state, t_city, t_zip)=>{
        let _val = t_country;
        if (t_state)
            _val += ` (${t_state})`;
        if (t_state && t_city)
            _val += `, ${t_city}`;
        if (t_zip)
            _val += ` (${t_zip})`;
        return _val;
    };
    const zones = mgr.state.zones;
    const static_country = get_static_country(proxy, zones);
    if (static_country && static_country!='any' && static_country!='*')
    {
        return flag_with_title(static_country,
            static_country.toUpperCase());
    }
    let val = proxy.country;
    if (!val||val=='any'||val=='*')
        return any_flag();
    return flag_with_title(proxy.country, title(val.toUpperCase(),
        proxy.state && proxy.state.toUpperCase(), proxy.city, proxy.zip));
};

const Status_cell = ({value: proxy})=>{
    const status = proxy.status;
    const status_details = proxy.status_details;
    let details = (status_details||[]).map(d=>d.msg).join(',');
    if (!details.length && status!='ok')
        details = status;
    if (status=='testing')
    {
        return <Tooltip tooltip="Status is being tested">
            Testing
        </Tooltip>;
    }
    else if (status && status!='ok')
    {
        return <Tooltip tooltip={details}>
            {details}
        </Tooltip>;
    }
    else if (status=='ok' && details)
    {
        return <Tooltip tooltip={details}>
            <Icon_text
                name="Warning"
                text="Ok"
                color="gray_10"
                size="xs"
                verticalAlign="top"
            />
        </Tooltip>;
    }
    else if (status=='ok' && !details)
    {
        return <Tooltip tooltip="This proxy works correctly">
            OK
        </Tooltip>;
    }
   return <Tooltip tooltip="Status of this proxy is unknown">
        ?
    </Tooltip>;
};

const Boolean_cell = ({value})=>value===true ? <Icon_check />
    : <Icon_close />;

const Static_ip_cell = props=>{
    const {proxy, mgr} = props.row.original;
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

const Type_cell = ({value: ext_proxy})=>{
    let nw = ext_proxy ? 'ext' : 'brd';
    let {label, desc} = networks.find(n=>n.value==nw)||{};
    return <Tooltip tooltip={t(desc)}>{t(label||nw)}</Tooltip>;
};

class Browser_cell extends Pure_component {
    open_browser = e=>{
        e.stopPropagation();
        const _this = this;
        ws.post_event('Browser Click');
        this.etask(function*(){
            const res = yield Api.get(`browser/${_this.props.value.port}`);
            if ((res||'').includes('Fetching'))
                $('#fetching_chrome_modal').modal('show');
        });
    };
    render(){
        const tooltip = 'Open browser configured with this port';
        return is_local() && <Tooltip tooltip={t(tooltip)}>
            <Link
                icon="ArrowUpRight"
                onClick={this.open_browser}
                text={t('Browser')}
            />
        </Tooltip>;
    }
}

const Port_cell = ({value: proxy})=>{
    const is_multiplied = !proxy.master_port && proxy.multiply &&
        proxy.multiply>1;
    const val = is_multiplied ? proxy.port+':1..'+proxy.multiply :
        proxy.port;
    const pl = is_multiplied ? 's' : '';
    const tip = `${is_multiplied ? proxy.port+'-'+(proxy.port+proxy.multiply)
        +' are' : proxy.port+' is a'} proxy port${pl} that refers to a specific
        virtual location${pl} on a computer. You can use it as a virtual proxy
        to send requests`;
    return <Tooltip tooltip={tip}>{val}</Tooltip>;
};

const Success_rate_cell = ({value: proxy})=>{
    const val = !proxy.reqs ? '—' :
        (proxy.success/proxy.reqs*100).toFixed(2)+'%';
    const tip = `${t('Total')}: ${proxy.reqs||0}, ${t('Success')}:`
        +proxy.success||0;
    return <Tooltip title={tip}>
        {val}
    </Tooltip>;
};

const Reqs_cell = ({value: reqs=0})=>{
    const tip = `${+reqs} requests sent through this proxy port`;
    return <Tooltip tooltip={tip}>
        {+reqs}
    </Tooltip>;
};

const Zone_cell = props=>{
    const {proxy, mgr} = props.row.original;
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

const Rules_cell = ({value: {rules=[]}})=>{
    const tip = 'Number of defined rules for this proxy port';
    const val = rules.length;
    return !!val && <Tooltip tooltip={t(tip)}>{t(val)}</Tooltip>;
};

const DNS_cell = ({value})=>value||'local';

const Header_cell = ({column})=>{
    if (column.hide_col_title)
        return '';
    return <Tooltip tooltip={column.tooltip||column.title||column.id}>
        {t(column.title||column.id)}
    </Tooltip>;
};

const T_cell = ({value})=>{
    return <Tooltip tooltip={value}>
        {value}
    </Tooltip>;
};

const Select_rows_header = ({column})=>{
    const {mgr: {all_rows_select, state: {checked_all}}} = column;
    return <Checkbox onChange={all_rows_select} checked={checked_all} />;
};

const Select_row_cell = props=>{
    const {proxy, mgr} = props.row.original;
    let checked = mgr.state.checked_all
        || !!mgr.state.selected_proxies[proxy.port];
    return <Checkbox
        onChange={mgr.on_row_select.bind(mgr, proxy)}
        checked={checked}
    />;
};

const columns = [
    {
        id: 'internal_name',
        Cell: T_cell,
        title: 'Internal name',
        tooltip: `An internal name is used for proxy ports to be easily
            distinguished.\nThose don't change any proxy behavior and it's only
            cosmetic.`,
        maxWidth: 100,
        minWidth: 70,
        can_sort: true,
    },
    {
        id: 'port',
        title: 'Proxy port',
        accessor: 'proxy',
        Cell: Port_cell,
        tooltip: 'A proxy port is a number that refers to a specific virtual '
            +'location on a computer. Create and configure proxy ports, then '
            +'connect the crawler to send requests through the port',
        sticky: true,
        default: true,
        ext: true,
        dynamic: true,
        maxWidth: 90,
        minWidth: 50,
        can_sort: true,
    },
    {
        id: 'proxy_type',
        accessor: 'proxy.ext_proxies',
        title: 'Type',
        Cell: Type_cell,
        tooltip: 'Type of connected proxy - Bright Data proxy or external'
            +' proxy (non Bright Data)',
        ext: true,
        maxWidth: 70,
        minWidth: 50,
    },
    {
        id: 'status',
        title: 'Status',
        accessor: 'proxy',
        Cell: Status_cell,
        tooltip: 'Real time proxy status',
        default: true,
        type: 'string',
        ext: true,
        dynamic: true,
        width: 40,
        can_sort: true,
    },
    {
        id: 'iface',
        title: 'Interface',
        tooltip: 'Specific network interface on which the local machine is '
            +'running. Switch interfaces in the proxy configuration page',
        type: 'string',
        ext: true,
        width: 50,
    },
    {
        id: 'multiply',
        title: 'Multiply',
        tooltip: 'Number of multiplied proxy ports. A proxy port can be '
            +'multiplied in the proxy configuration page',
        type: 'string',
        ext: true,
        can_sort: true,
        width: 50,
    },
    {
        id: 'ssl',
        title: 'SSL Analyzing',
        accessor: 'proxy.ssl',
        Cell: Boolean_cell,
        tooltip: 'In order to log HTTPS requests, enable SSL request logs in '
            +'proxy configuration',
        ext: true,
        width: 40,
    },
    {
        id: 'proxy_connection_type',
        title: 'SP Protocol',
        tooltip: 'Connection type between Proxy Manager and Super Proxy',
        ext: true,
        width: 30,
    },
    {
        id: 'zone',
        title: 'Zone',
        default: true,
        Cell: Zone_cell,
        tooltip: 'Specific Bright Data zone configured for this proxy. Switch '
            +'zones in proxy configuration page.',
        width: 30,
    },
    {
        id: 'country',
        title: 'Targeting',
        default: true,
        Cell: Targeting_cell,
        tooltip: 'Exit node (IP) GEO location',
        width: 30,
    },
    {
        id: 'asn',
        title: 'ASN',
        tooltip: 'ASN uniquely identifies each network on the internet. You '
            +'can target exit nodes (IPs) on specific ASNs',
    },
    {
        id: 'rotate_session',
        title: 'Rotate IPs',
        accessor: 'proxy.rotate_session',
        Cell: Boolean_cell,
        ext: true,
    },
    {
        id: 'pool_size',
        title: 'Pool size',
        type: 'number',
        ext: true,
    },
    {
        id: 'sticky_ip',
        title: 'Sticky IP',
        accessor: 'proxy.sticky_ip',
        Cell: Boolean_cell,
        ext: true,
    },
    {
        id: 'rules',
        title: 'Rules',
        accessor: 'proxy',
        Cell: Rules_cell,
        ext: true,
    },
    {
        id: 'dns',
        title: 'DNS',
        accessor: 'proxy.dns',
        Cell: DNS_cell,
    },
    {
        id: 'ip',
        title: 'Static IPs',
        calc_show: proxies=>proxies.some(p=>p.multiply_ips),
        Cell: Static_ip_cell,
    },
    {
        id: 'user',
        title: 'User',
        ext: true,
        calc_show: proxies=>proxies.some(p=>p.multiply_users),
    },
    {
        id: 'vip',
        title: 'gIP',
        tooltip: 'A gIP is a group of exclusive residential IPs. Using gIPs '
            +'ensures that nobody else uses the same IPs with the same target '
            +'sites as you do.',
    },
    {
        id: 'proxy',
        title: 'SP',
        tooltip: 'Super Proxy',
    },
    {
        id: 'throttle',
        title: 'Throttle',
        tooltip: 'Throttle concurrent connections',
        ext: true,
    },
    {
        id: 'success',
        title: 'Success',
        tooltip: 'The ratio of successful requests out of total requests. A '
            +'request is considered as successful if the server of the '
            +'destination website responded',
        accessor: 'proxy',
        Cell: Success_rate_cell,
        default: true,
        ext: true,
        dynamic: true,
        width: 58,
    },
    {
        id: 'in_bw',
        title: 'BW up',
        accessor: 'proxy',
        Cell: ({value})=>Tooltip_bytes({bytes: value.out_bw}),
        ext: true,
        tooltip: 'Data transmitted to destination website. This includes'
            +'request headers, request data, response headers, response data',
        dynamic: true,
        width: 60,
    },
    {
        id: 'out_bw',
        title: 'BW down',
        accessor: 'proxy',
        Cell: ({value})=>Tooltip_bytes({bytes: value.in_bw}),
        ext: true,
        tooltip: 'Data transmitted to destination website. This includes'
            +'request headers, request data, response headers, response data',
        dynamic: true,
        width: 60,
    },
    {
        id: 'bw',
        title: 'BW',
        accessor: 'proxy',
        Cell: ({value})=>Tooltip_bytes({bytes: value.bw,
            bytes_out: value.out_bw, bytes_in: value.in_bw}),
        default: true,
        ext: true,
        tooltip: 'Data transmitted to destination website. This includes'
            +'request headers, request data, response headers, response data',
        dynamic: true,
        width: 60,
    },
    {
        id: 'reqs',
        title: 'Requests',
        Cell: Reqs_cell,
        default: true,
        ext: true,
        tooltip: 'Number of all requests sent from this proxy port',
        dynamic: true,
        grow: 1,
        width: 60,
    },
    ...is_local() ? [{
        id: 'browser',
        title: 'Browser',
        accessor: 'proxy',
        Cell: Browser_cell,
        default: true,
        tooltip: 'Open browser configured with this port',
        width: 80,
        grow: 0,
        shrink: 0,
        hide_col_title: true,
    }] : [],
    {
        id: 'actions',
        title: 'Actions',
        tooltip: `Delete/duplicate/refresh sessions/open browser`,
        ext: true,
        sticky: true,
        Cell: Actions_cell,
        width: 10,
        maxWidth: 10,
        minWidth: 10,
        shrink: 0,
        grow: 0,
        csv: false,
        hide_col_title: true,
    },

].map(col=>assign({
    Header: Header_cell,
    accessor: ({proxy})=>proxy[col.id]||'',
    width: 30,
    maxWidth: 50,
    minWidth: 50,
}, col));

class Columns_modal extends Pure_component {
    constructor(props){
        super(props);
        this.state = {
            selected_cols: [],
        };
    }
    componentDidMount(){
        this.setdb_on('head.settings', settings=>{
            if (!settings)
                return;
            this.setState({settings});
        });
        const selected_cols = this.props.selected_cols.reduce((acc, e)=>
            assign(acc, {[e]: true}), {});
        this.setState({selected_cols, saved_cols: selected_cols});
    }
    on_change = value=>{
        this.setState(prev=>({selected_cols: {
            ...prev.selected_cols,
            [value]: !prev.selected_cols[value],
        }}));
    };
    click_ok = ()=>{
        const new_columns = keys(this.state.selected_cols).filter(c=>
            this.state.selected_cols[c]);
        this.props.update_selected_cols(new_columns);
        window.localStorage.setItem('columns', JSON.stringify(
            this.state.selected_cols));
        this.props.on_hide();
    };
    click_cancel = ()=>
        this.setState({selected_cols: this.state.saved_cols},
            this.props.on_hide);
    select_all = ()=>{
        this.setState({selected_cols: columns.filter(c=>!c.sticky)
            .reduce((acc, e)=>assign(acc, {[e.key]: true}), {})});
    };
    select_none = ()=>this.setState({selected_cols: {}});
    select_default = ()=>{
        this.setState({selected_cols: columns.filter(c=>!c.sticky&&c.default)
            .reduce((acc, e)=>assign(acc, {[e.key]: true}), {})});
    };
    render(){
        const header = <Inline_wrapper>
          <Button
            onClick={this.select_all}
            text="Check all"
            variant="secondary"
            size="sm"
          />
          <Button
            onClick={this.select_none}
            text="Uncheck all"
            variant="secondary"
            size="sm"
          />
          <Button
            onClick={this.select_default}
            text="Default"
            variant="secondary"
            size="sm"
          />
        </Inline_wrapper>;
        const content = <div className="row columns">
            {columns.filter(col=>!col.sticky).map(col=>
                <div key={col.id} className="col-md-6">
                    <Checkbox
                        label={t(col.title||col.id)}
                        onChange={this.on_change.bind(this, col.id)}
                        checked={!!this.state.selected_cols[col.id]}
                    />
                </div>
            )}
        </div>;
        return <Popup
            show={this.props.show}
            onOk={this.click_ok}
            onCancel={this.click_cancel}
            title={header}
            content={content}
            shadow="sm"
            size="lg"
        />;
    }
}

const Proxies = withRouter(class Proxies extends Pure_component {
    update_window_dimensions = ()=>
        this.setState({height: window.innerHeight});
    constructor(props){
        super(props);
        let from_storage = JSON.parse(window.localStorage.getItem(
            'columns'))||{};
        from_storage = keys(from_storage).filter(c=>from_storage[c]);
        const default_cols = columns.filter(c=>c.default).map(col=>col.id);
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
            errors: [],
            err_ntf_list: [],
            show_errors_modal: false,
            show_columns_modal: false,
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
        this.setdb_on('head.settings', settings=>{
            if (!settings)
                return;
            this.setState({settings});
        });
        this.setdb_on('ws.zones', zones=>{
            if (!zones)
                return;
            this.setState({zones});
            return this.update();
        });
        this.setdb_on('head.app_errors', errors=>{
            if ((errors||[]).length)
                this.setState({errors});
        });
        this.timeout_id = window.setTimeout(this.req_status);
        this.update_window_dimensions();
        window.addEventListener('resize', this.update_window_dimensions);
    }
    willUnmount(){
        window.clearTimeout(this.timeout_id);
        window.removeEventListener('resize', this.update_window_dimensions);
    }
    get select_rows_col(){
        return {
            id: 'select_rows',
            Header: Select_rows_header,
            Cell: Select_row_cell,
            mgr: this,
            ext: true,
            sticky: true,
            style: {
                width: 'fit-content',
            },
            maxWidth: 40,
            shrink: 0,
            grow: 0,
            csv: false,
        };
    }
    get_visible_proxies = (proxies, proxy_filter, sort)=>{
        if (proxy_filter===undefined)
            proxy_filter = this.state.proxy_filter;
        sort = sort||this.state.sort;
        const master_ports_idx = new Map();
        proxies.forEach(p=>!p.master_port && master_ports_idx.set(p.port, p));
        proxies = proxies.filter(p=>{
            if (proxy_filter &&
                !(p.internal_name||'').includes(proxy_filter) &&
                !(p.zone||'').includes(proxy_filter) &&
                !(''+p.port||'').includes(proxy_filter))
            {
                return false;
            }
            if (p.master_port && !master_ports_idx.has(p.master_port))
                throw 'duplicate_port_number';
            if (p.proxy_type=='duplicate')
                return master_ports_idx.get(p.master_port).expanded;
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
            const stats = yield Api.json.get('recent_stats');
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
                for (let p of values(new_proxies))
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
                    values(new_proxies));
                return {proxies: values(new_proxies), visible_proxies,
                    stats};
            });
            yield etask.sleep(1000);
            _this.req_status();
        });
    };
    update = ()=>{
        this.setState({selected_proxies: {}, checked_all: false});
        return this.etask(function*(){
            const proxies = yield Api.json.get('proxies_running');
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
        ws.post_event('Toolbar Download CVS Clicked');
        filesaver.saveAs(csv.to_blob(data), 'proxies.csv');
    };
    edit_columns = ()=>{
        ws.post_event('Toolbar Edit Columns Clicked');
        this.setState({show_columns_modal: true});
    };
    hide_edit_columns = ()=>{
        this.setState({show_columns_modal: false});
    };
    update_selected_columns = new_columns=>
        this.setState({selected_cols: new_columns});
    on_row_select = (proxy, value, e)=>{
        e.stopPropagation();
        const {selected_proxies, visible_proxies} = this.state;
        const new_selected = assign({}, selected_proxies);
        if (!value)
            delete new_selected[proxy.port];
        else
            new_selected[proxy.port] = proxy;
        const checked_all = value &&
            keys(new_selected).length==visible_proxies.length;
        this.setState({selected_proxies: new_selected, checked_all});
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
    show_error_ntf = err_ntf_list=>
        this.setState({err_ntf_list, show_errors_modal: true});
    hide_error_ntf = ()=>
        this.setState({err_ntf_list: [], show_errors_modal: false});
    on_row_click = ({proxy})=>{
        if (!document.getSelection().isCollapsed)
            return;
        if (proxy.proxy_type!='persist')
            return;
        if (proxy.master_port)
            return;
        ws.post_event('Proxy Port Click', {port: proxy.port});
        this.props.history.push(`/proxy/${proxy.port}`);
    };
    get_cols = ()=>[this.select_rows_col, ...columns].filter(col=>{
        if (col.sticky)
            return true;
        if (col.calc_show && col.calc_show(this.state.visible_proxies||[]))
            return true;
        return this.state.selected_cols.includes(col.id);
    });
    open_delete_dialog = proxies=>{
        this.setState({delete_proxies: proxies, open_delete_dialog: true});
    };
    close_delete_dialog = ()=>{
        this.setState({open_delete_dialog: false});
    };
    set_proxy_filter = value=>{
        this.setState({
            visible_proxies: this.get_visible_proxies(this.state.proxies,
                value),
            proxy_filter: value,
            selected_proxies: {},
        });
    };
    set_sort({sortBy: sort_by, sortDirection: sort_direction}){
        if (sort_by=='select')
            return;
        sort_direction = sort_direction.toLowerCase();
        let sort = {sort_by, sort_direction};
        const visible_proxies = this.get_visible_proxies(this.state.proxies,
            undefined, sort);
        this.setState({sort, visible_proxies, selected_proxies: {}});
    }
    get_row_data = proxy=>({
        proxy,
        mgr: this,
    });
    render(){
        let {proxies, visible_proxies, show_columns_modal, proxy_filter}
            = this.state;
        let is_loading = !this.state.zones || !this.state.countries
            || !visible_proxies;
        if (this.state.errors.length)
        {
            return this.state.errors.map(e=>
                <div key={e} className="warning error settings-alert">
                  {e}
                </div>);
        }
        let show_table = !!proxies.length;
        if (this.state.zones && !this.state.zones.zones.length)
            return <No_zones/>;
        if (this.state.loaded && !show_table)
            return <Proxy_blank/>;
        return <React.Fragment>
            <div className="main_panel vbox cp_panel proxies_panel
                force_cp_panel">
              <Header_panel
                selected={this.state.selected_proxies}
                open_delete_dialog={this.open_delete_dialog}
                download_csv={this.download_csv}
                edit_columns={this.edit_columns}
                set_proxy_filter={this.set_proxy_filter}
                proxy_filter={proxy_filter}
                toggle_stats={this.props.toggle_stats||_.noop}
                request_stats={this.props.request_stats}
              />
              {this.state.loaded && show_table &&
                <Table.Provider
                    fullWidth
                    hideFooter
                    disableEditing
                    disablePinning
                    manualPagination
                    disableHiding
                    isLoading={is_loading}
                    columns={this.get_cols()}
                    data={visible_proxies.map(this.get_row_data)}
                >
                    <Table
                        rowDensity="busy_bee"
                        onRowClick={this.on_row_click}
                    />
                </Table.Provider>
              }
            </div>
            <Columns_modal selected_cols={this.state.selected_cols}
              update_selected_cols={this.update_selected_columns}
              show={show_columns_modal} on_hide={this.hide_edit_columns}/>
            <Delete_dialog open={this.state.open_delete_dialog}
              close_dialog={this.close_delete_dialog}
              proxies={this.state.delete_proxies}
              update_proxies={this.update}/>
            <Popup
                show={this.state.show_errors_modal}
                onOk={this.hide_error_ntf}
                cancelDisabled
                title="Errors"
                content={<Warnings warnings={this.state.err_ntf_list}/>}
                shadow="sm"
                size="lg"
            />
          </React.Fragment>;
    }
});

const Actions_bulk = ({selected, open_delete_dialog})=>{
    const to_delete = useMemo(()=>
        values(selected).filter(p=>p.proxy_type=='persist'), [selected]);
    const bulk_refresh_session = e=>{
        e.stopPropagation();
        ws.post_event('Toolbar Action Refresh Click',
            {ports: to_delete.map(p=>p.port)});
        values(selected).forEach(p=>
            setdb.emit_path('actions.refresh_sessions.'+p.port));
    };
    const bulk_open_delete_dialog = e=>{
        e.stopPropagation();
        ws.post_event('Toolbar Action Remove Click',
            {ports: to_delete.map(p=>p.port)});
        open_delete_dialog(to_delete);
    };
    return <div className="cp_panel_header bulk_actions">
        <Link
            icon="Refresh"
            onClick={bulk_refresh_session}
            text={t('Refresh')}
            size="lg"
        />
        {to_delete.length && <Link
            icon="Delete"
            onClick={bulk_open_delete_dialog}
            text={t('Delete')}
            size="lg"
        />}
    </div>;
};

const Header_panel = props=>{
    const {selected, open_delete_dialog} = props;
    const any_selected = useMemo(()=>values(selected).length,
        [selected]);
    return any_selected ? <Actions_bulk selected={selected}
        open_delete_dialog={open_delete_dialog} />
        : <div className="cp_panel_header">
            <h2>
            <Icon_text
                color="gray_11"
                name="MenuExpand"
                verticalAlign="middle"
                text="All ports"
            />
            </h2>
            <Toolbar {...props}/>
        </div>;
};

class Delete_dialog extends Pure_component {
    delete_proxies = e=>{
        e.stopPropagation();
        const _this = this;
        const ports = _this.props.proxies.map(p=>p.port);
        this.etask(function*(){
            yield Api.json.post('proxies/delete', {ports});
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
        return <Popup
            show={open}
            onOk={this.delete_proxies}
            onCancel={close_dialog}
            title={title}
            content={null}
            shadow="sm"
            size="lg"
        />;
    }
}

class Actions extends Pure_component {
    componentDidMount(){
        if (!this.props.proxy.status)
            this.get_status();
        this.add_refresh_listener();
    }
    componentWillUnmount(){
        if (this.status_req)
            ajax.abort(this.status_req);
    }
    componentDidUpdate(prev_props){
        this.remove_refresh_listener(prev_props.proxy.port);
        this.add_refresh_listener();
    }
    add_refresh_listener = (port=this.props.proxy.port)=>
        this.setdb_on('actions.refresh_sessions.'+port, this.refresh_sessions,
            {init: false});
    remove_refresh_listener = (port=this.props.proxy.port)=>
        this.setdb_off('actions.refresh_sessions.'+port);
    get items(){
        const persist = this.props.proxy.proxy_type=='persist';
        return [
            ...persist ? [
                {
                    key: '1',
                    icon: 'Refresh',
                    text: 'Refresh',
                    onClick: this.refresh_sessions,
                },
                {
                    key: '2',
                    icon: 'Copy',
                    text: 'Duplicate',
                    onClick: this.duplicate,
                },
                {
                    key: '1-divider',
                    type: 'divider'
                },
            ] : [],
            {
                key: '3',
                icon: 'Trash',
                text: 'Delete',
                onClick: this.open_delete_dialog_with_port,
                variant: 'negative'
            }
        ];
    }
    // XXX krzysztof: this logic is a mess, rewrite it
    get_status = (opt={})=>{
        const proxy = this.props.proxy;
        if (!opt.force && proxy.status=='ok')
            return;
        const _this = this;
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
            _this.status_req = yield Api.json.get('proxy_status/'+proxy.port,
                {qs: params});
            const res = yield _this.status_req;
            delete _this.status_req;
            if (res===undefined)
            {
                delete proxy.status;
                setdb.emit_path('head.proxies_running');
                return;
            }
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
    post_action(action){
        ws.post_event(`Port Action ${action} Click`,
            {port: this.props.proxy.port});
    }
    refresh_sessions = e=>{
        if (e)
            e.stopPropagation();
        const _this = this;
        this.etask(function*(){
            yield Api.json.post('refresh_sessions/'+_this.props.proxy.port);
            yield _this.get_status({force: true});
            if (e)
                _this.post_action('Refresh');
        });
    };
    duplicate = event=>{
        event.stopPropagation();
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>_this.etask(function*(){
                yield report_exception(e, 'proxies.Actions.duplicate');
            }));
            const resp = yield Api.json.post('proxy_dup',
                {port: _this.props.proxy.port});
            if (resp.errors)
                _this.props.show_error_ntf(resp.errors);
            _this.post_action('Duplicate');
            yield _this.props.update_proxies();
        });
    };
    open_delete_dialog_with_port = e=>{
        e.stopPropagation();
        this.post_action('Remove');
        this.props.open_delete_dialog([this.props.proxy]);
    };
    render(){
        return <Context_menu
            tooltip={this.props.tooltip}
            items={this.items}
        />;
    }
}

export default Proxies;
