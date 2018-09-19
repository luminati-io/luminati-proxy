// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '../../www/util/pub/pure_component.js';
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
import Proxy_add from './proxy_add.js';
import Proxy_blank from './proxy_blank.js';
import {Modal, Checkbox, Pagination_panel, Link_icon,
    Tooltip, Modal_dialog, Tooltip_bytes} from './common.js';
import {withRouter} from 'react-router-dom';

let country_names = {};

const Targeting_cell = ({proxy, zones})=>{
    const flag_with_title = (country, title)=>{
        let country_name = country_names[country];
        return <Tooltip title={country_name}>
              <span>
                <span className={'flag-icon flag-icon-'+country}/>
                {title}
              </span>
            </Tooltip>;
    };
    const static_country = get_static_country(proxy, zones);
    if (static_country&&static_country!='any'&&static_country!='*')
        return flag_with_title(static_country, static_country.toUpperCase());
    let val = proxy.country;
    if (!val||val=='any'||val=='*')
    {
        return <Tooltip title="Any">
              <img src="/img/flag_any_country.svg"/>
            </Tooltip>;
    }
    val = val.toUpperCase();
    const state = proxy.state&&proxy.state.toUpperCase();
    if (!state)
        return flag_with_title(proxy.country, val);
    if (!proxy.city)
        return flag_with_title(proxy.country, `${val} (${state})`);
    return flag_with_title(proxy.country,
        `${val} (${state}), ${proxy.city}`);
};

const Status_cell = ({proxy, status, status_details})=>{
    const details = status_details && status_details.map(d=>d.msg).join(',');
    if (!status)
    {
        return <Tooltip title="Status of this proxy is being tested">
            Testing</Tooltip>;
    }
    else if (status=='error')
        return <Tooltip title={details}>Error</Tooltip>;
    else if (status=='ok'&&details)
    {
        return <Tooltip title={details}>
              <span>
                OK
                <div className="ic_warning"/>
              </span>
            </Tooltip>;
    }
    else if (status=='ok'&&!details)
        return <Tooltip title="This proxy works correctly">OK</Tooltip>;
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

const Type_cell = ({proxy})=>{
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
    return <Tooltip title={tip}>{val}</Tooltip>;
};

const Last_req_cell = ({proxy})=>{
    const val = (proxy.last_req||{}).url||'—';
    return <Tooltip title={val}>{val}</Tooltip>;
};

const Port_cell = ({proxy, master_port})=>{
    let val;
    if (!master_port&&proxy.multiply&&proxy.multiply>1)
        val = proxy.port+':1..'+proxy.multiply;
    else
        val = proxy.port;
    const title = `${proxy.port} is a proxy port that refers to a specific
        virtual location on a computer. You can use it as a virtual proxy to
        sends requests`;
    return <Tooltip title={title}>{val}</Tooltip>;
};

const Success_rate_cell = ({proxy})=>{
    const val = !proxy.reqs ? '—' :
        (proxy.success/proxy.reqs*100).toFixed(2)+'%';
    const title = `total: ${proxy.reqs}, success: ${proxy.success}`;
    return <Tooltip title={title}>{val}</Tooltip>;
};

const Reqs_cell = ({proxy})=>{
    const reqs = proxy.reqs||0;
    return <Tooltip title={`${reqs} requests sent through this proxy port`}>
        {reqs}</Tooltip>;
};

const columns = [
    {
        key: 'internal_name',
        title: 'Internal name',
        tooltip: `An internal name is used for proxy ports to be easily \
            distinguished. Those don't change any proxy behavior and it's only
            cosmetic`,
        ext: true,
        calc_show: proxies=>proxies.some(p=>p.config.internal_name),
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
    },
    {
        key: 'proxy_type',
        title: 'Type',
        render: Type_cell,
        tooltip: 'Type of connected proxy - Luminati proxy or external proxy '
            +'(non-Luminati)',
        sticky: true,
        ext: true,
    },
    {
        key: '_status',
        title: 'Status',
        type: 'status',
        render: Status_cell,
        sticky: true,
        tooltip: 'Real time proxy status',
        ext: true,
        dynamic: true,
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
        title: 'Multiple',
        type: 'number',
        tooltip: 'Number of multiplied proxy ports. A proxy port can be '
            +'multiplied in the proxy configuration page',
        ext: true,
    },
    {
        key: 'history',
        title: 'Logs',
        render: Boolean_cell,
        tooltip: 'Last 1K requests are automatically logged for easy '
            +'debugging. To save all requests, Enable Logs in proxy '
            +'configuration page',
        ext: true,
    },
    {
        key: 'ssl',
        title: 'SSL Log',
        render: Boolean_cell,
        tooltip: 'In order to log HTTPS requests, enable SSL Logs in proxy '
            +'configuration',
        ext: true,
    },
    {
        key: 'zone',
        title: 'Zone',
        type: 'options',
        default: true,
        tooltip: 'Specific Luminati zone configured for this proxy. Switch '
            +'zones in proxy configuration page.',
    },
    {
        key: 'secure_proxy',
        title: 'SSL for super proxy',
        render: Boolean_cell,
        ext: true,
    },
    {
        key: 'country',
        title: 'Targeting',
        type: 'options',
        default: true,
        render: Targeting_cell,
        tooltip: 'Exit node (IP) GEO location',
    },
    {
        key: 'asn',
        title: 'ASN',
        type: 'number',
        tooltip: 'ASN uniquely identifies each network on the internet. You '
            +'can target exit nodes (IPs) on specific ASNs',
    },
    {
        key: 'ip',
        title: 'Datacenter IP',
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
        key: 'keep_alive',
        title: 'Keep-alive',
        type: 'number',
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
        title: 'Mininum super proxies',
        type: 'number',
    },
    {
        key: 'race_reqs',
        title: 'Race request',
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
        key: 'success_rate',
        title: 'Success',
        tooltip: 'The ratio of successful requests out of total requests. A '
            +'request considered as successful if the server of the '
            +'destination website responded',
        render: Success_rate_cell,
        default: true,
        ext: true,
        dynamic: true,
    },
    {
        key: 'in_bw',
        title: 'BW up',
        render: ({proxy})=>Tooltip_bytes({bytes: proxy.out_bw}),
        sticky: true,
        ext: true,
        tooltip: 'Data transmitted to destination website. This includes'
            +'request headers, request data, response headers, response data',
        dynamic: true,
    },
    {
        key: 'out_bw',
        title: 'BW down',
        render: ({proxy})=>Tooltip_bytes({bytes: proxy.in_bw}),
        sticky: true,
        ext: true,
        tooltip: 'Data transmitted to destination website. This includes'
            +'request headers, request data, response headers, response data',
        dynamic: true,
    },
    {
        key: 'reqs',
        title: 'Requests',
        sticky: true,
        render: Reqs_cell,
        ext: true,
        tooltip: 'Number of all requests sent from this proxy port',
        dynamic: true,
    },
    {
        key: 'last_req.url',
        title: 'Last request',
        sticky: true,
        render: Last_req_cell,
        ext: true,
        tooltip: 'Last request that was sent on this proxy port',
        dynamic: true,
    },
];

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
                Check all</button>
              <button onClick={this.select_none} className="btn btn_lpm">
                Uncheck all</button>
              <button onClick={this.select_default} className="btn btn_lpm">
                Default</button>
            </div>;
        return <Modal id="edit_columns" custom_header={header}
              click_ok={this.click_ok} cancel_clicked={this.click_cancel}>
              <div className="row columns">
                {columns.filter(col=>!col.sticky).map(col=>
                  <div key={col.key} className="col-md-6">
                    <Checkbox text={col.title} value={col.key}
                      on_change={this.on_change}
                      checked={!!this.state.selected_cols[col.key]}/>
                  </div>
                )}
              </div>
            </Modal>;
    }
}

const save_pagination = (table, opt={})=>{
    const curr = JSON.parse(window.localStorage.getItem('pagination'))||{};
    curr[table] = curr[table]||{};
    if (opt.page)
        curr[table].page = opt.page;
    if (opt.items)
        curr[table].items = opt.items;
    window.localStorage.setItem('pagination', JSON.stringify(curr));
};

const get_pagination = table=>{
    const curr = JSON.parse(window.localStorage.getItem('pagination'))||{};
    return {items: 10, page: 0, ...curr[table]||{}};
};

class Proxies extends Pure_component {
    constructor(props){
        super(props);
        let from_storage = JSON.parse(window.localStorage.getItem(
            'columns'))||{};
        from_storage = Object.keys(from_storage).filter(c=>from_storage[c]);
        const default_cols = columns.filter(c=>c.default).map(col=>col.key);
        const pagination = get_pagination('proxies');
        this.state = {
            selected_cols: from_storage.length&&from_storage||default_cols,
            items_per_page: pagination.items,
            cur_page: 0,
            proxies: [],
            filtered_proxies: [],
            displayed_proxies: [],
            loaded: false,
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
            this.setState({proxies, filtered_proxies, loaded: true},
                this.paginate);
        });
        this.setdb_on('head.locations', locations=>{
            if (!locations)
                return;
            const countries = locations.countries_by_code;
            country_names = countries;
            this.setState({countries});
        });
        this.setdb_on('head.zones', zones=>{
            if (!zones)
                return;
            this.setState({zones});
        });
        window.setTimeout(this.req_status);
    }
    componentWillReceiveProps(props){
        if (props.master_port!=this.props.master_port)
        {
            const filtered_proxies = this.filter_proxies(this.state.proxies,
                props.master_port);
            this.setState({filtered_proxies}, this.paginate);
        }
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
            cur._status_details = cur._status_details||[];
        }
        return proxies;
    };
    update_items_per_page = items_per_page=>{
        this.setState({items_per_page}, ()=>this.paginate(0));
        save_pagination('proxies', {items: items_per_page});
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
                    let stat = {reqs: 0, success: 0, in_bw: 0, out_bw: 0};
                    if (''+p.port in stats.ports)
                        stat = stats.ports[p.port];
                    p.in_bw = stat.in_bw;
                    p.out_bw = stat.out_bw;
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
            }, ()=>_this.paginate(_this.state.cur_page));
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
        const data = this.state.proxies.map(p=>['127.0.0.1:'+p.port]);
        filesaver.saveAs(csv.to_blob(data), 'proxies.csv');
    };
    edit_columns = ()=>$('#edit_columns').modal('show');
    update_selected_columns = new_columns=>
        this.setState({selected_cols: new_columns});
    proxy_add = ()=>{ $('#add_new_proxy_modal').modal('show'); };
    paginate = (page=-1)=>{
        page = page>-1 ? page : this.state.cur_page;
        const pages = Math.ceil(
            this.state.filtered_proxies.length/this.state.items_per_page);
        const cur_page = Math.min(pages, page);
        const displayed_proxies = this.state.filtered_proxies.slice(
            cur_page*this.state.items_per_page,
            (cur_page+1)*this.state.items_per_page);
        this.setState({displayed_proxies, cur_page});
    };
    page_change = page=>{
        this.paginate(page-1);
        save_pagination('proxies', {page});
    };
    render(){
        const cols = columns.filter(col=>
            this.state.selected_cols.includes(col.key)||col.sticky||
            col.calc_show&&col.calc_show(this.state.filtered_proxies));
        const displayed_proxies = this.state.displayed_proxies;
        if (!this.state.zones)
            return null;
        if (!this.state.countries)
            return null;
        if (this.state.loaded&&!this.state.filtered_proxies.length)
            return <Proxy_blank/>;
        return <div className="panel proxies_panel">
              <div className="panel_heading">
                <h2>
                  Proxies
                  <Tooltip title="Add new proxy">
                    <button className="btn btn_lpm btn_lpm_small add_proxy_btn"
                      onClick={this.proxy_add}>
                      New proxy
                      <i className="glyphicon glyphicon-plus"/>
                    </button>
                  </Tooltip>
                </h2>
              </div>
              {this.state.loaded && displayed_proxies.length &&
                <div className="panel_body with_table">
                  <Proxies_pagination entries={this.state.filtered_proxies}
                    cur_page={this.state.cur_page}
                    items_per_page={this.state.items_per_page}
                    page_change={this.page_change}
                    edit_columns={this.edit_columns}
                    update_items_per_page={this.update_items_per_page}
                    download_csv={this.download_csv}
                    top/>
                  <div className="proxies_table_wrapper">
                    <table className="table table-hover">
                      <thead>
                        <tr>
                          <th className="head_actions">
                            <Tooltip title="Delete/duplicate/refresh sessions">
                              Actions
                            </Tooltip>
                          </th>
                          {cols.map(col=>
                            <th key={col.key} className={'col_'+col.key}>
                              <Tooltip title={col.tooltip}>
                                {col.title}</Tooltip>
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {displayed_proxies.map(proxy=>
                          <Proxy_row key={proxy.port} go={this.state.go}
                            update_proxies={this.update} proxy={proxy}
                            cols={cols} master_port={this.props.master_port}
                            zones={this.state.zones}/>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <Proxies_pagination entries={this.state.filtered_proxies}
                    cur_page={this.state.cur_page}
                    items_per_page={this.state.items_per_page}
                    page_change={this.page_change}
                    edit_columns={this.edit_columns}
                    update_items_per_page={this.update_items_per_page}
                    download_csv={this.download_csv}
                    bottom/>
                </div>
              }
              <Proxy_add/>
              <Columns_modal selected_cols={this.state.selected_cols}
                update_selected_cols={this.update_selected_columns}/>
            </div>;
    }
}

const Proxies_pagination = ({entries, items_per_page, cur_page, bottom,
    page_change, edit_columns, download_csv, top, update_items_per_page})=>
    <Pagination_panel entries={entries} items_per_page={items_per_page}
      cur_page={cur_page} page_change={page_change} top={top} bottom={bottom}
      update_items_per_page={update_items_per_page}>
        <Link_icon tooltip="Edit columns" on_click={edit_columns} id="filter"/>
        <Link_icon tooltip="Download all proxy ports as CSV"
          on_click={download_csv} id="download"/>
    </Pagination_panel>;

const Proxy_row = withRouter(class Proxy_row extends Pure_component {
    state = {status: this.props.proxy._status,
        status_details: this.props.proxy._status_details};
    componentDidMount(){ this.get_status(); }
    get_status = (opt={})=>{
        const {proxy} = this.props;
        if (!opt.force&&proxy._status=='ok')
            return;
        const _this = this;
        return this.etask(function*(){
            this.on('uncaught', e=>{
                _this.setState({status: 'error', status_details:
                    [{msg: 'Failed to get proxy status'}]});
            });
            const params = {};
            if (proxy.proxy_type!='duplicate')
                params.with_details = true;
            if (opt.force)
            {
                _this.setState({status: undefined});
                params.force = true;
            }
            const uri = '/api/proxy_status/'+proxy.port;
            const url = zescape.uri(uri, params);
            const res = yield ajax.json({url});
            if (res.status=='ok')
            {
                _this.setState({status: res.status,
                    status_details: res.status_details});
            }
            else
            {
                let errors = res.status_details.filter(s=>s.lvl=='err');
                res.status_details = errors.length ? errors : [{msg: res.status}];
                res.status = 'error';
                _this.setState({status: res.status,
                    status_details: res.status_details});
            }
            proxy._status = res.status;
            proxy._status_details = res.status_details;
        });
    };
    edit = ()=>{
        if (this.props.proxy.proxy_type!='persist')
            return;
        if (!this.props.master_port && this.props.proxy.multiply &&
            this.props.proxy.multiply>1)
        {
            this.props.history.push(`/overview/${this.props.proxy.port}`);
        }
        else
            this.props.history.push(`/proxy/${this.props.proxy.port}`);
    };
    render(){
        const proxy = this.props.proxy;
        const cell_class = col=>classnames(col.key.replace(/\./g, '_'),
            {default_cursor: this.props.proxy.proxy_type!='persist'});
        const row_class = classnames('proxy_row',
            {default: proxy.port==22225});
        return <tr className={row_class}>
              <Actions proxy={proxy} get_status={this.get_status}
                update_proxies={this.props.update_proxies}/>
              {this.props.cols.map(col=>
                <Cell key={col.key} proxy={proxy} col={col}
                  status={this.state.status} zones={this.props.zones}
                  status_details={this.state.status_details}
                  master_port={this.props.master_port} on_click={this.edit}
                  className={cell_class(col)}/>
              )}
            </tr>;
    }
});

class Cell extends React.Component {
    shouldComponentUpdate(){ return !!this.props.col.dynamic; }
    render(){
        const {proxy, col, master_port, status, status_details, on_click,
            zones, className} = this.props;
        let val;
        if (!col.ext&&proxy.ext_proxies)
            val = '—';
        else if (col.render)
        {
            val = col.render({proxy, col: col.key, master_port, status,
                status_details, zones})||null;
        }
        else
            val = _.get(proxy, col.key)||null;
        return <td onClick={on_click} className={className}>{val}</td>;
    }
}

class Actions extends Pure_component {
    state = {open_delete_dialog: false};
    open_delete_dialog = ()=>this.setState({open_delete_dialog: true});
    close_delete_dialog = ()=>this.setState({open_delete_dialog: false});
    delete_proxy = ()=>{
        const _this = this;
        this.etask(function*(){
            yield ajax.json({url: '/api/proxies/'+_this.props.proxy.port,
                method: 'DELETE'});
            yield _this.props.update_proxies();
            _this.close_delete_dialog();
        });
    };
    refresh_sessions = ()=>{
        const _this = this;
        this.etask(function*(){
            const url = '/api/refresh_sessions/'+_this.props.proxy.port;
            yield ajax.json({url, method: 'POST'});
            yield _this.props.get_status({force: true});
        });
    };
    duplicate = ()=>{
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>console.log(e));
            // XXX krzysztof: switch fetch->ajax
            yield window.fetch('/api/proxy_dup', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({port: _this.props.proxy.port}),
            });
            yield _this.props.update_proxies();
        });
    };
    render(){
        const persist = this.props.proxy.proxy_type=='persist';
        const delete_title = `Are you sure you want to delete proxy port
            ${this.props.proxy.port}?`;
        return <td className="proxies_actions">
              <Action_icon id="trash"
                on_click={this.open_delete_dialog}
                tooltip="Delete" invisible={!persist}/>
              <Action_icon id="duplicate" on_click={this.duplicate}
                tooltip="Duplicate proxy port" invisible={!persist}/>
              <Action_icon id="refresh"
                on_click={this.refresh_sessions}
                tooltip="Refresh Sessions"/>
              <Modal_dialog title={delete_title}
                open={this.state.open_delete_dialog}
                ok_clicked={this.delete_proxy}
                cancel_clicked={this.close_delete_dialog}/>
            </td>;
    }
}

const Action_icon = ({on_click, disabled, invisible, id, tooltip,
    tooltip_disabled})=>
{
    const classes = classnames('action_icon', {disabled, invisible});
    if (disabled)
        tooltip = tooltip_disabled;
    return <Link_icon tooltip={tooltip} on_click={on_click} id={id}
          classes={classes} invisible={invisible} disabled={disabled}/>;
};

export default Proxies;
