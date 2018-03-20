// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '../../www/util/pub/pure_component.js';
import ajax from 'hutil/util/ajax';
import setdb from 'hutil/util/setdb';
import zescape from 'hutil/util/escape';
import csv from 'hutil/util/csv';
import classnames from 'classnames';
import filesaver from 'file-saver';
import etask from 'hutil/util/etask';
import util from './util.js';
import _ from 'lodash';
import $ from 'jquery';
import Add_proxy from './add_proxy.js';
import No_proxies from './no_proxies.js';
import {Modal, Checkbox, Pagination_panel} from './common.js';
import {If} from '/www/util/pub/react.js';

let country_names = {};

const Targeting_cell = ({proxy})=>{
    const flag_with_title = (country, title)=>{
        let country_name = country_names[country];
        return (
            <Tooltip title={country_name}>
              <span>
                <span className={'flag-icon flag-icon-'+country}/>
                {title}
              </span>
            </Tooltip>
        );
    };
    const get_static_country = proxy=>{
        const zone = proxy.zones[proxy.zone];
        if (!zone)
            return false;
        const plan = zone.plans[zone.plans.length-1];
        if (plan.type=='static')
            return plan.country||'any';
        if (['domain', 'domain_p'].includes(plan.vips_type))
            return plan.vip_country||'any';
        return false;
    };
    const static_country = get_static_country(proxy);
    if (static_country&&static_country!='any'&&static_country!='*')
        return flag_with_title(static_country, static_country.toUpperCase());
    let val = proxy.country;
    if (!val||val=='any'||val=='*')
    {
        return (
            <Tooltip title="Any">
              <img src="/img/flag_any_country.svg"/>
            </Tooltip>
        );
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

const Status_cell = ({proxy})=>{
    const status = proxy._status;
    const details = proxy._status_details&&
        proxy._status_details.map(d=>d.msg).join(',');
    if (!status)
        return 'Testing';
    else if (status=='error')
        return <Tooltip title={details}>Error</Tooltip>;
    else if (status=='ok'&&details)
        return <Tooltip title={details}>OK!</Tooltip>;
    else if (status=='ok'&&!details)
        return 'OK';
};

const Boolean_cell = ({proxy, col})=>{
    if (proxy[col]===true)
        return <img src="/img/ic_checkmark.svg"/>;
    else
        return <img src="/img/ic_off.svg"/>;
};

const Session_cell = ({proxy})=>{
    if (proxy.session===true)
        return <i className="fa fa-random"/>;
    else if (proxy.session)
        return proxy.session;
};

const columns = [
    {
        key: 'port',
        title: 'Port',
        sticky: true,
        tooltip: 'A port is a number that refers to a specific virtual '
                +'location on a computer. Create and configure ports, then '
                +'connect the crawler to send requests through the port',
    },
    {
        key: '_status',
        title: 'Status',
        type: 'status',
        render: Status_cell,
        sticky: true,
        tooltip: 'Real time proxy status',
    },
    {
        key: 'iface',
        title: 'Interface',
        type: 'options',
    },
    {
        key: 'multiply',
        title: 'Multiple',
        type: 'number',
        tooltip: 'Number of multiplied ports. A port can be multiplied '
            +'through the proxy settings page',
    },
    {
        key: 'history',
        title: 'History',
        render: Boolean_cell,
        tooltip: 'Enable history to save and log all sent requests',
    },
    {
        key: 'ssl',
        title: 'SSL Log',
        render: Boolean_cell,
        tooltip: 'In order to see HTTPS requests and log their history, '
            +'SSL Log should be enabled through the proxy settings '
            +'page',
    },
    {
        key: 'socks',
        title: 'SOCKS port',
        type: 'number',
    },
    {
        key: 'zone',
        title: 'Zone',
        type: 'options',
        default: true,
    },
    {
        key: 'secure_proxy',
        title: 'SSL for super proxy',
        render: Boolean_cell,
    },
    {
        key: 'country',
        title: 'Targeting',
        type: 'options',
        default: true,
        render: Targeting_cell,
    },
    {
        key: 'asn',
        title: 'ASN',
        type: 'number',
    },
    {
        key: 'ip',
        title: 'Datacenter IP',
        type: 'text',
    },
    {
        key: 'vip',
        title: 'VIP',
        type: 'number',
    },
    {
        key: 'max_requests',
        title: 'Max requests',
        type: 'text',
    },
    {
        key: 'session_duration',
        title: 'Session duration (sec)',
        type: 'text',
    },
    {
        key: 'pool_size',
        title: 'Pool size',
        type: 'number',
    },
    {
        key: 'pool_type',
        title: 'Pool type',
        type: 'options',
    },
    {
        key: 'sticky_ip',
        title: 'Sticky IP',
        render: Boolean_cell,
    },
    {
        key: 'keep_alive',
        title: 'Keep-alive',
        type: 'number',
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
        key: 'allow_proxy_auth',
        title: 'Request authentication',
        render: Boolean_cell,
    },
    {
        key: 'session_init_timeout',
        title: 'Session timeout',
        type: 'number',
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
    },
    {
        key: 'request_timeout',
        title: 'Request timeout (sec)',
        type: 'number',
    },
    {
        key: 'debug',
        title: 'Debug info',
        type: 'options',
    },
    {
        key: 'null_response',
        title: 'NULL response',
        type: 'text',
    },
    {
        key: 'bypass_proxy',
        title: 'Bypass proxy',
        type: 'text',
    },
    {
        key: 'direct_include',
        title: 'Direct include',
        type: 'text',
    },
    {
        key: 'direct_exclude',
        title: 'Direct exclude',
        type: 'text',
    },
    {
        key: 'success_rate',
        title: 'Success rate',
        type: 'success_rate',
        tooltip: 'Ratio of successful requests out of total requests, '
            +'where successful requests are calculated as 2xx, 3xx or 404 '
            +'HTTP status codes',
        render: ({proxy})=>proxy.success_rate&&(proxy.success_rate+'%')||'—',
        default: true,
    },
    {
        key: 'bw_up',
        title: 'BW Up',
        render: ({proxy})=>util.bytes_format(proxy.bw_up||0)||'—',
        sticky: true,
    },
    {
        key: 'bw_down',
        title: 'BW Down',
        render: ({proxy})=>util.bytes_format(proxy.bw_down||0)||'—',
        sticky: true,
    },
    {
        key: 'reqs',
        title: 'Requests',
        sticky: true,
        render: ({proxy})=>proxy.reqs||0,
    },
];

class Tooltip extends Pure_component {
    componentDidMount(){
        if (!this.ref)
            return;
        $(this.ref).tooltip();
    }
    componentWillUnmount(){ $(this.ref).tooltip('destroy'); }
    set_ref(e){ this.ref = e; }
    render(){
        if (!this.props.title)
            return this.props.children;
        const props = {
            'data-toggle': 'tooltip',
            'data-placement': 'top',
            'data-container': 'body',
            title: this.props.title,
            ref: this.set_ref.bind(this),
        };
        return React.Children.map(this.props.children, c=>{
            if (typeof c=='string')
                return React.createElement('span', props, c);
            return React.cloneElement(c, props);
        });
    }
}

class Columns_modal extends Pure_component {
    constructor(props){
        super(props);
        this.state = {selected_cols: []};
    }
    componentDidMount(){
        const selected_cols = this.props.selected_cols.reduce((acc, e)=>
            Object.assign(acc, {[e]: true}), {});
        this.setState({selected_cols, saved_cols: selected_cols});
    }
    on_change({target: {value}}){
        this.setState(prev=>({selected_cols: {
            ...prev.selected_cols,
            [value]: !prev.selected_cols[value],
        }}));
    }
    click_ok(){
        const new_columns = Object.keys(this.state.selected_cols).filter(c=>
            this.state.selected_cols[c]);
        this.props.update_selected_cols(new_columns);
        window.localStorage.setItem('columns', JSON.stringify(
            this.state.selected_cols));
    }
    click_cancel(){ this.setState({selected_cols: this.state.saved_cols}); }
    select_all(){
        this.setState({selected_cols: columns.filter(c=>!c.sticky)
            .reduce((acc, e)=>Object.assign(acc, {[e.key]: true}), {})});
    }
    select_none(){ this.setState({selected_cols: {}}); }
    select_default(){
        this.setState({selected_cols: columns.filter(c=>!c.sticky&&c.default)
            .reduce((acc, e)=>Object.assign(acc, {[e.key]: true}), {})});
    }
    render(){
        const header = (
            <div className="header_buttons">
              <button onClick={this.select_all.bind(this)}
                className="btn btn_lpm">Check all</button>
              <button onClick={this.select_none.bind(this)}
                className="btn btn_lpm">Uncheck all</button>
              <button onClick={this.select_default.bind(this)}
                className="btn btn_lpm">Default</button>
            </div>
        );
        return (
            <Modal id="edit_columns" custom_header={header}
              click_ok={this.click_ok.bind(this)}
              cancel_clicked={this.click_cancel.bind(this)}>
              <div className="row columns">
                {columns.filter(col=>!col.sticky).map(col=>(
                  <div key={col.key} className="col-md-6">
                    <Checkbox text={col.title} value={col.key}
                      on_change={this.on_change.bind(this)}
                      checked={!!this.state.selected_cols[col.key]}/>
                  </div>
                ))}
              </div>
            </Modal>
        );
    }
}

class Proxies extends Pure_component {
    constructor(props){
        super(props);
        let from_storage = JSON.parse(window.localStorage.getItem(
            'columns'))||{};
        from_storage = Object.keys(from_storage).filter(c=>from_storage[c]);
        const default_cols = columns.filter(c=>c.default).map(col=>col.key);
        this.state = {
            selected_cols: from_storage.length&&from_storage||default_cols,
            proxies: [],
            displayed_proxies: [],
            items_per_page: 10,
            cur_page: 0,
        };
        setdb.set('head.proxies.update', this.update.bind(this));
    }
    componentDidMount(){
        this.setdb_on('head.proxies_running', proxies=>{
            proxies = this.prepare_proxies(proxies||[]);
            this.setState({proxies}, this.paginate);
        });
        this.setdb_on('head.locations', locations=>{
            if (!locations)
                return;
            const countries = locations.countries_by_code;
            country_names = countries;
            this.setState({countries});
        });
        this.setdb_on('head.callbacks.state.go', go=>this.setState({go}));
        this.req_status();
    }
    prepare_proxies(proxies){
        let within_group = false;
        proxies.sort(function(a, b){ return a.port>b.port ? 1 : -1; });
        for (let i=0; i<proxies.length; i++)
        {
            if (Array.isArray(proxies[i].proxy)&&proxies[i].proxy.length==1)
                proxies[i].proxy = proxies[i].proxy[0];
            proxies[i]._status_details = proxies[i]._status_details||[];
            if (!within_group && proxies[i+1] &&
                proxies[i+1].proxy_type=='duplicate')
            {
                within_group = true;
                proxies[i].group = 'start';
            }
            else if (within_group && (!proxies[i+1] ||
                proxies[i+1] && proxies[i+1].proxy_type!='duplicate'))
            {
                within_group = false;
                proxies[i].group = 'end';
            }
        }
        return proxies.filter(proxy=>proxy.port!=22225||
            (proxy.stats&&proxy.stats.real_bw));
    }
    update_items_per_page(val){
        this.setState({items_per_page: val, cur_page: 0}); }
    req_status(){
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>console.log(e));
            const stats = yield ajax.json({url: '/api/req_status'});
            _this.setState(prev=>{
                const new_proxies = prev.proxies.map(p=>{
                    let stat = {total: 0, success: 0, bw_down: 0, bw_up: 0,
                        real_reqs: 0};
                    if (''+p.port in stats)
                        stat = stats[p.port];
                    p.success_rate = stat.total==0 ? null
                        : (stat.success/stat.total*100).toFixed(0);
                    p.bw_down = stat.bw_down||0;
                    p.bw_up = stat.bw_up||0;
                    p.reqs = stat.real_reqs||0;
                    return p;
                });
                return {proxies: new_proxies};
            }, ()=>_this.paginate(_this.state.cur_page));
            yield etask.sleep(1000);
            _this.req_status();
        });
    }
    update(){
        const _this = this;
        this.etask(function*(){
            const proxies = yield ajax.json({url: '/api/proxies_running'});
            setdb.set('head.proxies_running', proxies);
        });
    }
    download_csv(){
        const data = this.state.proxies.map(p=>['127.0.0.1:'+p.port]);
        filesaver.saveAs(csv.to_blob(data), 'proxies.csv');
    }
    edit_columns(){ $('#edit_columns').modal('show'); }
    update_selected_columns(new_columns){
        this.setState({selected_cols: new_columns});
    }
    add_proxy(){ $('#add_new_proxy_modal').modal('show'); }
    update_state_proxy(proxy, obj){
        const map = p=>{
            if (p.port!=proxy.port)
                return p;
            else
                return {...p, ...obj};
        };
        this.setState(prev=>({proxies: prev.proxies.map(map),
            displayed_proxies: prev.displayed_proxies.map(map)}));
    }
    get_status(proxy, opt={}){
        //if (this.state.proxy.port==22225 &&
        //    !(this.state.proxy.stats && this.state.proxy.stats.real_bw))
        //{
        //    return;
        //}
        const _this = this;
        return this.etask(function*(){
            this.on('uncaught', e=>{
                _this.update_state_proxy(proxy, {_status: 'error',
                    _status_details: [{msg: 'Failed to get proxy status'}]});
            });
            const params = {};
            if (proxy.proxy_type!='duplicate')
                params.with_details = true;
            if (opt.force)
                params.force = true;
            const uri = '/api/proxy_status/'+proxy.port;
            const url = zescape.uri(uri, params);
            _this.update_state_proxy(proxy, {_status: undefined,
                _status_details: undefined});
            const res = yield ajax.json({url});
            if (res.status=='ok')
            {
                _this.update_state_proxy(proxy, {_status: res.status,
                    _status_details: res.status_details});
            }
            else
            {
                let errors = res.status_details.filter(s=>s.lvl=='err');
                errors = errors.length ? errors : [{msg: res.status}];
                _this.update_state_proxy(proxy, {_status: 'error',
                    _status_details: errors});
            }
        });
    }
    paginate(page=-1){
        page = page>-1 ? page : this.state.cur_page;
        const pages = Math.ceil(
            this.state.proxies.length/this.state.items_per_page);
        const cur_page = Math.min(pages, page);
        const displayed_proxies = this.state.proxies.slice(
            cur_page*this.state.items_per_page,
            (cur_page+1)*this.state.items_per_page);
        this.setState({
            displayed_proxies,
            cur_page,
        });
    }
    page_change(page){ this.paginate(page-1); }
    render(){
        const cols = columns.filter(col=>
            this.state.selected_cols.includes(col.key)||col.sticky);
        if (!this.state.countries)
            return null;
        return (
            <div className="panel proxies_panel">
              <div className="panel_heading">
                <h2>
                  Proxies
                  <Tooltip title="Add new proxy">
                    <span className="link icon_link right top"
                      onClick={this.add_proxy.bind(this)}>
                      <i className="glyphicon glyphicon-plus"/>
                    </span>
                  </Tooltip>
                </h2>
              </div>
              <If when={!this.state.proxies.length}>
                <No_proxies/>
              </If>
              <If when={this.state.proxies.length}>
                <div className="panel_body with_table">
                  <Proxies_pagination entries={this.state.proxies}
                    cur_page={this.state.cur_page}
                    items_per_page={this.state.items_per_page}
                    page_change={this.page_change.bind(this)}
                    edit_columns={this.edit_columns.bind(this)}
                    update_items_per_page={this.update_items_per_page.bind(this)}
                    download_csv={this.download_csv.bind(this)}
                    top/>
                  <div className="proxies_table_wrapper">
                    <table className="table table-hover">
                      <thead>
                        <tr>
                          <th className="head_actions">Actions</th>
                          {cols.map(col=>(
                            <th key={col.key} className={'col_'+col.key}>
                              <Tooltip title={col.tooltip}>
                                {col.title}</Tooltip>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {this.state.displayed_proxies.map(proxy=>
                          <Proxy_row key={proxy.port} go={this.state.go}
                            update_proxies={this.update.bind(this)}
                            get_status={this.get_status.bind(this)}
                            proxy={proxy} cols={cols}/>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <Proxies_pagination entries={this.state.proxies}
                    cur_page={this.state.cur_page}
                    items_per_page={this.state.items_per_page}
                    page_change={this.page_change.bind(this)}
                    edit_columns={this.edit_columns.bind(this)}
                    update_items_per_page={this.update_items_per_page.bind(this)}
                    download_csv={this.download_csv.bind(this)}
                    bottom/>
                </div>
              </If>
              <Add_proxy id="add_new_proxy_modal"/>
              <Columns_modal selected_cols={this.state.selected_cols}
                update_selected_cols={this.update_selected_columns.bind(this)}/>
            </div>
        );
    }
}

const Proxies_pagination = ({entries, items_per_page, cur_page, bottom,
    page_change, edit_columns, download_csv, top, update_items_per_page})=>
(
    <Pagination_panel entries={entries} items_per_page={items_per_page}
      cur_page={cur_page} page_change={page_change} top={top} bottom={bottom}
      update_items_per_page={update_items_per_page}>
        <Tooltip title="Edit columns">
          <span onClick={edit_columns}
            className="link icon_link">
            <i className="glyphicon glyphicon-filter"></i>
          </span>
        </Tooltip>
        <Tooltip title="Download all ports as CSV">
          <span onClick={download_csv}
            className="icon_link">
            <i className="glyphicon glyphicon-download"></i>
          </span>
        </Tooltip>
    </Pagination_panel>
);

class Proxy_row extends Pure_component {
    componentDidMount(){
        window.setTimeout(()=>this.props.get_status(this.props.proxy));
    }
    edit(){
        if (this.props.proxy.proxy_type!='persist')
            return;
        this.props.go('edit_proxy', {port: this.props.proxy.port});
    }
    render(){
        const proxy = this.props.proxy;
        const cell_class = col=> classnames(col.key, {
            default_cursor: this.props.proxy.proxy_type!='persist',
        });
        const row_class = classnames('proxy_row', {
            start_group: proxy.group=='start',
            end_group: proxy.group=='end',
            multiplied: proxy.proxy_type=='duplicate',
            default: proxy.port==22225,
        });
        return (
            <tr className={row_class}>
              <Actions proxy={proxy}
                get_status={this.props.get_status}
                update_proxies={this.props.update_proxies}/>
              {this.props.cols.map(col=>(
                <td onClick={this.edit.bind(this)} key={col.key}
                  className={cell_class(col)}>
                  {col.render ?  col.render({proxy, col: col.key}) :
                      _.get(proxy, col.key)
                  }
                </td>
              ))}
            </tr>
        );
    }
}

class Actions extends Pure_component {
    delete_proxy(){
        const _this = this;
        this.etask(function*(){
            yield ajax.json({url: '/api/proxies/'+_this.props.proxy.port,
                method: 'DELETE'});
            yield _this.props.update_proxies();
        });
    }
    refresh_sessions(){
        const _this = this;
        this.etask(function*(){
            const url = '/api/refresh_sessions/'+_this.props.proxy.port;
            yield ajax.json({url, method: 'POST'});
            yield _this.props.get_status(_this.props.proxy, {force: true});
            //yield _this.props.update_proxies();
        });
    }
    duplicate(){
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>{
                console.log(e);
            });
            yield window.fetch('/api/proxy_dup', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({port: _this.props.proxy.port}),
            });
            yield _this.props.update_proxies();
        });
    }
    show_history(){
        const root = setdb.get('head.root_scope');
        root.history_dialog = [{
            port: this.props.proxy.port}];
        root.$digest();
    }
    render(){
        const persist = this.props.proxy.proxy_type=='persist';
        return (
            <td className="proxies_actions">
              <Action_icon id="delete" on_click={this.delete_proxy.bind(this)}
                tooltip="Delete" invisible={!persist}/>
              <Action_icon id="duplicate" on_click={this.duplicate.bind(this)}
                tooltip="Duplicate Proxy"
                invisible={!persist}/>
              <Action_icon id="refresh"
                on_click={this.refresh_sessions.bind(this)}
                tooltip="Refresh Sessions"/>
              <Action_icon id="history" on_click={this.show_history.bind(this)}
                tooltip="History"
                tooltip_disabled="History is not enabled for this proxy"
                disabled={!this.props.proxy._history}/>
            </td>
        );
    }
}

const Action_icon = ({on_click, disabled, invisible, id, tooltip,
    tooltip_disabled})=>
{
    if (invisible)
        return <div className={classnames('action_icon invisible', id)}/>;
    else if (disabled)
    {
        return (
            <Tooltip title={tooltip_disabled}>
              <div className={classnames('action_icon disabled', id)}/>
            </Tooltip>
        );
    }
    else
    {
        return (
            <Tooltip title={tooltip}>
              <div onClick={on_click}
                className={classnames('action_icon', id)}/>
            </Tooltip>
        );
    }
};

export default Proxies;
