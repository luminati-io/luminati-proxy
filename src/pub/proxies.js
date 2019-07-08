// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import ReactDOM from 'react-dom';
import {Link} from 'react-router-dom';
import ajax from '../../util/ajax.js';
import setdb from '../../util/setdb.js';
import zescape from '../../util/escape.js';
import csv from '../../util/csv.js';
import etask from '../../util/etask.js';
import classnames from 'classnames';
import filesaver from 'file-saver';
import {get_static_country} from './util.js';
import _ from 'lodash';
import $ from 'jquery';
import Proxy_blank from './proxy_blank.js';
import {Checkbox, any_flag, flag_with_title,
    Tooltip_bytes} from './common.js';
import {withRouter} from 'react-router-dom';
import Zone_description from './common/zone_desc.js';
import {Modal_dialog, Modal} from './common/modals.js';
import {T, with_tt} from './common/i18n.js';
import {Toolbar_container, Toolbar_row, Toolbar_button,
    Devider} from './chrome_widgets.js';
import {AutoSizer, Table, Column} from 'react-virtualized';
import 'react-virtualized/styles.css';
import Tooltip from './common/tooltip.js';
import {OverlayTrigger, Tooltip as B_tooltip} from 'react-bootstrap';

const is_local = ()=>{
    const href = window.location.href;
    return href.includes('localhost') || href.includes('127.0.0.1');
};

const Actions_cell = ({proxy, mgr, scrolling})=>{
    return <Actions proxy={proxy} get_status={mgr.get_status}
          update_proxies={mgr.update} scrolling={scrolling}/>;
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

const Status_cell = ({proxy, scrolling})=>{
    const status = proxy.status;
    const status_details = proxy.status_details;
    let details = (status_details||[]).map(d=>d.msg).join(',');
    if (!details.length && status!='ok')
        details = status;
    if (status=='testing')
    {
        return <T>
            {t=>
              <Tooltip title={t('Status is being tested')}>
                {t('Testing')}
              </Tooltip>
            }</T>;
    }
    else if (status && status!='ok')
        return <T>{t=><Tooltip title={t(details)}>{t('Error')}</Tooltip>}</T>;
    else if (status=='ok' && details)
    {
        return <T>{t=><Tooltip title={t(details)}>
              <span>
                {t('OK')}
                <div className="ic_warning"/>
              </span>
              </Tooltip>
            }</T>;
    }
    else if (status=='ok' && !details)
    {
        return <T>{t=>
              <Tooltip title={t('This proxy works correctly')}>
                {t('OK')}
              </Tooltip>
            }</T>;
    }
    return <T>{t=>
        <Tooltip title={t('Status of this proxy is unknown')}>?</Tooltip>}</T>;
};

const Boolean_cell = ({proxy, col})=>{
    if (proxy[col]===true)
        return <img src="/img/ic_checkmark.svg"/>;
    return <img src="/img/ic_off.svg"/>;
};

const Session_cell = ({proxy})=>{
    if (proxy.session===true)
        return <i className="fa fa-random"/>;
    else if (proxy.session)
        return proxy.session;
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

const Port_cell = ({proxy, mgr, scrolling})=>{
    if (scrolling)
        return proxy.port;
    let val;
    if (!mgr.props.master_port && proxy.multiply && proxy.multiply>1)
        val = proxy.port+':1..'+proxy.multiply;
    else
        val = proxy.port;
    const title = `${proxy.port} is a proxy port that refers to a specific
        virtual location on a computer. You can use it as a virtual proxy to
        send requests`;
    return <Tooltip title={title}>{val}</Tooltip>;
};

const Success_rate_cell = with_tt(['Total', 'Success'], ({proxy, t})=>{
    const val = !proxy.reqs ? '—' :
        (proxy.success/proxy.reqs*100).toFixed(2)+'%';
    const title = `${t['Total']}: ${proxy.reqs},
        ${t['Success']}: ${proxy.success}`;
    return <Tooltip title={title}>{val}</Tooltip>;
});

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

const columns = [
    {
        key: 'actions',
        title: 'Actions',
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
        default: true,
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
        key: 'secure_proxy',
        title: 'SSL to Super Proxy',
        render: Boolean_cell,
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
        key: 'max_requests',
        title: 'Max requests',
        type: 'text',
        ext: true,
    },
    {
        key: 'session_duration',
        title: 'Session duration (sec)',
        type: 'text',
        ext: true,
    },
    {
        key: 'pool_size',
        title: 'Pool size',
        type: 'number',
        ext: true,
    },
    {
        key: 'pool_type',
        title: 'Pool type',
        type: 'options',
        ext: true,
    },
    {
        key: 'sticky_ip',
        title: 'Sticky IP',
        render: Boolean_cell,
        ext: true,
    },
    {
        key: 'seed',
        title: 'Seed',
        type: 'text',
    },
    {
        key: 'session',
        title: 'Session',
        render: Session_cell,
    },
    {
        key: 'proxy_count',
        title: 'Minimum super proxies',
        type: 'number',
    },
    {
        key: 'race_reqs',
        title: 'Parallel race requests',
        type: 'number',
    },
    {
        key: 'dns',
        title: 'DNS',
        type: 'options',
    },
    {
        key: 'log',
        title: 'Log Level',
        type: 'options',
        ext: true,
    },
    {
        key: 'ip',
        title: 'Static IPs',
        type: 'text',
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
        key: 'proxy_switch',
        title: 'Autoswitch super proxy on failure',
        type: 'number',
    },
    {
        key: 'throttle',
        title: 'Throttle concurrent connections',
        type: 'number',
        ext: true,
    },
    {
        key: 'debug',
        title: 'Debug info',
        type: 'options',
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
        grow: 0,
        width: 60,
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
            filtered_proxies: [],
            loaded: false,
            height: window.innerHeight,
        };
        setdb.set('head.proxies.update', this.update);
    }
    componentDidMount(){
        this.setdb_on('head.proxies_running', proxies=>{
            if (!proxies)
                return;
            proxies = this.prepare_proxies(proxies||[]);
            const filtered_proxies = this.filter_proxies(proxies,
                this.props.master_port);
            this.setState({proxies, filtered_proxies, loaded: true});
        });
        this.setdb_on('head.locations', locations=>{
            if (!locations)
                return;
            const countries = locations.countries_by_code;
            this.setState({countries});
        });
        this.setdb_on('head.zones', zones=>{
            if (!zones)
                return;
            this.setState({zones});
        });
        this.setdb_on('head.ver_last', ver_last=>this.setState({ver_last}));
        this.setdb_on('head.ver_node', ver_node=>this.setState({ver_node}));
        window.setTimeout(this.req_status);
        this.setdb_on('head.settings', settings=>{
            if (settings)
                this.setState({logs: settings.logs});
        });
        this.update_window_dimensions();
        window.addEventListener('resize', this.update_window_dimensions);
    }
    componentWillReceiveProps(props){
        if (props.master_port!=this.props.master_port)
        {
            const filtered_proxies = this.filter_proxies(this.state.proxies,
                props.master_port);
            this.setState({filtered_proxies});
        }
    }
    willUnmount(){
        window.removeEventListener('resize', this.update_window_dimensions);
    }
    filter_proxies = (proxies, mp)=>{
        return proxies.filter(p=>{
            if (mp)
                return ''+p.port==mp||''+p.master_port==mp;
            return p.proxy_type!='duplicate';
        });
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
            this.on('uncaught', e=>console.log(e));
            const params = {};
            if (_this.props.master_port)
                params.master_port = _this.props.master_port;
            const url = zescape.uri('/api/recent_stats', params);
            const stats = yield ajax.json({url});
            setdb.set('head.recent_stats', stats);
            if (!_this.state.proxies.length ||
                _.isEqual(stats, _this.state.stats))
            {
                yield etask.sleep(1000);
                _this.req_status();
                return;
            }
            _this.setState(prev=>{
                const new_proxies = prev.proxies.map(p=>{
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
                    return p;
                }).reduce((acc, p)=>({...acc, [p.port]: p}), {});
                if (!_this.props.master_port)
                {
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
                }
                const filtered_proxies = _this.filter_proxies(
                    Object.values(new_proxies), _this.props.master_port);
                return {proxies: Object.values(new_proxies), filtered_proxies,
                    stats};
            });
            yield etask.sleep(1000);
            _this.req_status();
        });
    };
    update = ()=>{
        this.etask(function*(){
            const proxies = yield ajax.json({url: '/api/proxies_running'});
            setdb.set('head.proxies_running', proxies);
        });
    };
    download_csv = ()=>{
        const cols = this.get_cols().filter(c=>c.csv==undefined || c.csv);
        const titles = [cols.map(col=>col.title)];
        const data = titles.concat(this.state.proxies.map(p=>{
            return cols.map(col=>{
                const val = _.get(p, col.key);
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
    proxy_add = ()=>$('#add_new_proxy_modal').modal('show');
    cell_renderer = function Cell_renderer(props){
        return <Cell {...props} mgr={this}/>;
    };
    on_row_click = e=>{
        const proxy = e.rowData;
        if (proxy.proxy_type!='persist')
            return;
        if (!this.props.master_port && proxy.multiply && proxy.multiply>1)
            this.props.history.push(`/overview/${proxy.port}`);
        else
            this.props.history.push(`/proxy/${proxy.port}`);
    };
    get_cols = ()=>{
        if (!is_local())
        {
            const actions_idx = columns.findIndex(col=>col.key=='actions');
            columns[actions_idx].width = 60;
        }
        return columns.filter(col=>this.state.selected_cols.includes(col.key)
            || col.sticky || col.calc_show &&
            col.calc_show(this.state.filtered_proxies));
    };
    render(){
        const cols = this.get_cols();
        if (!this.state.zones)
            return null;
        if (!this.state.countries)
            return null;
        if (this.state.loaded && !this.state.filtered_proxies.length)
            return <Proxy_blank/>;
        let table_margin = 174;
        const has_upgrade_panel = this.state.ver_last
            &&this.state.ver_last.newer&&this.state.ver_node;
        if (has_upgrade_panel)
            table_margin = 254;
        let table_height = this.state.height-table_margin;
        if (table_height<328)
            table_height = 328;
        if (this.state.logs)
            table_height = 355;
        const show_logs = this.state.logs>0;
        return <div className="proxies_panel chrome">
              <div className="main_panel vbox">
                <Toolbar proxy_add={this.proxy_add}
                  edit_columns={this.edit_columns}
                  download_csv={this.download_csv}/>
                {this.state.loaded && !!this.state.filtered_proxies.length &&
                  <React.Fragment>
                    <div className="chrome chrome_table vbox">
                      <div className="tables_container header_container hack">
                      <div className="chrome_table">
                      <AutoSizer disableHeight>
                        {({width})=>
                          <Table width={width}
                            height={table_height}
                            onRowClick={this.on_row_click}
                            gridClassName="chrome_grid"
                            headerHeight={27}
                            headerClassName="chrome_th"
                            rowClassName="chrome_tr"
                            rowHeight={22}
                            rowCount={this.state.filtered_proxies.length+1}
                            rowGetter={({index})=>
                              this.state.filtered_proxies[index]||'filler'}>
                            {cols.map(col=>
                              <Column key={col.key}
                                cellRenderer={this.cell_renderer.bind(this)}
                                label={<T>{col.title}</T>}
                                className="chrome_td"
                                dataKey={col.key}
                                flexGrow={col.grow!==undefined ? col.grow : 1}
                                flexShrink={col.shrink!==undefined ?
                                  col.shrink : 1}
                                width={col.width||100}/>
                            )}
                          </Table>
                        }
                      </AutoSizer>
                      </div>
                      </div>
                    </div>
                  </React.Fragment>
                }
                {!show_logs &&
                  <div className="summary_bar">
                    Request logs are disabled. You can enable it back in&nbsp;
                    <Link to="/settings">General settings</Link>
                  </div>
                }
              </div>
              <Columns_modal selected_cols={this.state.selected_cols}
                update_selected_cols={this.update_selected_columns}/>
            </div>;
    }
});

class Toolbar extends Pure_component {
    render(){
        const {proxy_add, edit_columns, download_csv} = this.props;
        return <Toolbar_container>
              <Toolbar_row>
                <Toolbar_button id="add" tooltip="Add new proxy"
                  on_click={proxy_add}>
                  <span style={{marginRight: 5, position: 'relative',
                    top: -3}}><T>Add new proxy</T></span>
                </Toolbar_button>
                <Devider/>
                <Toolbar_button tooltip="Edit columns" on_click={edit_columns}
                  id="filters"/>
                <Toolbar_button tooltip="Download all proxy ports as CSV"
                  on_click={download_csv} id="download"/>
              </Toolbar_row>
            </Toolbar_container>;
    }
}

class Cell extends React.Component {
    shouldComponentUpdate(next_props){
        if (this.props.dataKey=='last_req.url')
            return true;
        return this.props.cellData!=next_props.cellData ||
            this.props.rowData!=next_props.rowData;
    }
    render(){
        const props = this.props;
        const col = columns_obj[props.dataKey];
        const proxy = props.rowData;
        if (props.rowData=='filler')
            return <div className="chrome_td"></div>;
        else if (!col.ext && proxy.ext_proxies)
            return '—';
        else if (col.render)
        {
            const S_cell = col.render;
            return <S_cell proxy={props.rowData} mgr={props.mgr}
              col={props.dataKey}/>;
        }
        return props.cellData||'';
    }
}

class Actions extends Pure_component {
    state = {open_delete_dialog: false};
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
                proxy.status_details = [{msg: 'Failed to get proxy status'}];
                setdb.emit_path('head.proxies_running');
            });
            const params = {};
            if (proxy.proxy_type!='duplicate')
                params.with_details = true;
            if (!proxy.status)
                proxy.status = 'testing';
            if (opt.force)
            {
                proxy.status = 'testing';
                params.force = true;
            }
            if (proxy.status=='testing' || opt.force)
                setdb.emit_path('head.proxies_running');
            const uri = '/api/proxy_status/'+proxy.port;
            const url = zescape.uri(uri, params);
            const res = yield ajax.json({url});
            if (res.status!='ok')
            {
                let errors = res.status_details.filter(s=>s.lvl=='err');
                res.status_details = errors.length ?
                    errors : [{msg: res.status}];
                res.status = 'error';
            }
            proxy.status = res.status;
            proxy.status_details = res.status_details;
            setdb.emit_path('head.proxies_running');
        });
    };
    open_delete_dialog = e=>{
        e.stopPropagation();
        this.setState({open_delete_dialog: true});
    };
    close_delete_dialog = ()=>{
        this.setState({open_delete_dialog: false});
    };
    delete_proxy = e=>{
        e.stopPropagation();
        const _this = this;
        this.etask(function*(){
            yield ajax.json({url: '/api/proxies/'+_this.props.proxy.port,
                method: 'DELETE'});
            yield _this.props.update_proxies();
            _this.close_delete_dialog();
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
            this.on('uncaught', e=>console.log(e));
            yield window.fetch('/api/proxy_dup', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({port: _this.props.proxy.port}),
            });
            yield _this.props.update_proxies();
        });
    };
    open_browser = e=>{
        e.stopPropagation();
        const _this = this;
        this.etask(function*(){
            const url = `/api/browser/${_this.props.proxy.port}`;
            yield ajax.get(url);
        });
    };
    render(){
        const persist = this.props.proxy.proxy_type=='persist';
        const delete_title = `Are you sure you want to delete proxy port
            ${this.props.proxy.port}?`;
        return <div className={is_local() ? 'proxies_actions' :
          'proxies_actions_3'}>
            {!!persist &&
              <React.Fragment>
                <Action_icon id="trash" scrolling={this.props.scrolling}
                  on_click={this.open_delete_dialog}
                  tooltip="Delete" invisible={!persist}/>
                <Action_icon id="duplicate" on_click={this.duplicate}
                  tooltip="Duplicate proxy port" invisible={!persist}
                  scrolling={this.props.scrolling}/>
              </React.Fragment>
            }
            <Action_icon id="refresh" scrolling={this.props.scrolling}
              on_click={this.refresh_sessions}
              tooltip="Refresh Sessions"/>
            {is_local() &&
              <Action_icon id="browser" scrolling={this.props.scrolling}
                on_click={this.open_browser}
                tooltip="Open browser configured with this port"/>
            }
            {!!persist &&
              <Portal>
                <Modal_dialog title={delete_title}
                  open={this.state.open_delete_dialog}
                  ok_clicked={this.delete_proxy}
                  cancel_clicked={this.close_delete_dialog}/>
              </Portal>
            }
          </div>;
    }
}

const Portal = props=>ReactDOM.createPortal(props.children,
    document.getElementById('del_modal'));

const Action_icon = props=>{
    let {on_click, invisible, id, tooltip, scrolling} = props;
    const classes = classnames('action_icon', 'chrome_icon', id,
        {invisible});
    if (scrolling)
        return <div className={classes}/>;
    return <T>{t=><Tooltip title={t(tooltip)}>
          <div onClick={on_click} className={classes}/>
        </Tooltip>}</T>;
};

export default Proxies;
