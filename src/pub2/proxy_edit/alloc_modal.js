// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import $ from 'jquery';
import _ from 'lodash4';
import setdb from '../../../util/setdb.js';
import {Modal} from '../common/modals.js';
import {report_exception} from '../util.js';
import {Infinite_chrome_table} from '../chrome_widgets.js';
import conv from '../../../util/conv.js';
import zcountry from '../../../util/country.js';
import {flag_with_title} from '../common.js';
import {main as Api} from '../api.js';
import {Filter} from '/www/util/pub/har.js';

export default class Alloc_modal extends Pure_component {
    set_field = setdb.get('head.proxy_edit.set_field');
    state = {
        available_list: [],
        rendered_list: [],
        selected_all: false,
        ip_filter: '',
        cn_filter: '',
        countries: []
    };
    constructor(props){
        super(props);
        let sync_rendered_list = ()=>this.setState(
            {rendered_list: this.filter_ips(this.state.available_list)});
        this.sync_rendered_list = _.debounce(sync_rendered_list, 300);
    }
    componentDidMount(){
        this.setdb_on('head.proxy_edit.zone_name', ()=>{
            this.setState({available_list: [], rendered_list: []});
        });
        this.setdb_on('head.proxies_running', proxies=>
            proxies && this.setState({proxies}));
        $('#allocated_ips').on('show.bs.modal', this.load);
    }
    static getDerivedStateFromProps(props, state){
        if (!state.available_list.length)
            return null;
        return {
            selected_all: (props.form[props.type]||[]).length==
                state.rendered_list.length,
        };
    }
    close = ()=>$('#allocated_ips').modal('hide');
    load = ()=>{
        const {type, form} = this.props;
        if (this.state.available_list.length)
            return;
        this.loading(true);
        let endpoint;
        if (type=='ips')
            endpoint = 'allocated_ips';
        else
            endpoint = 'allocated_vips';
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>_this.etask(function*(){
                yield report_exception(e, 'alloc_modal.Alloc_modal.load');
                _this.loading(false);
            }));
            const res = yield Api.json.get(endpoint,
                {qs: {zone: _this.props.zone}});
            const _available_list = type=='ips' ? res.ips_cn : res.vips_cn;
            const available_hash = _available_list.reduce((acc, value)=>{
                acc[value.ip] = value;
                return acc;
            }, {});
            const chosen_ips = [];
            const chosen_ips_hash = {};
            form[type].forEach(v=>{
                const found_ip = available_hash[v];
                if (found_ip!==undefined)
                {
                    chosen_ips.push(found_ip);
                    chosen_ips_hash[v] = found_ip;
                }
            });
            const not_chosen_ips = [];
            const countries = new Set();
            _available_list.forEach(v=>{
                if (chosen_ips_hash[v.ip]===undefined)
                    not_chosen_ips.push(v);
                const country = v.country || v.maxmind;
                countries.add(country);
            });
            const available_list = [...chosen_ips, ...not_chosen_ips];
            _this.setState({
                available_list,
                countries: [...countries],
                rendered_list: _this.filter_ips(available_list),
            }, _this.sync_selected_vals);
            _this.loading(false);
        });
    };
    sync_selected_vals = ()=>{
        const curr_vals = this.props.form[this.props.type];
        const new_vals = curr_vals.filter(v=>
            this.state.available_list.find(r=>r.ip==v));
        this.set_field(this.props.type, new_vals);
    };
    loading = loading=>{
        setdb.set('head.proxy_edit.loading', loading);
        this.setState({loading});
    };
    checked = ip=>(this.props.form[this.props.type]||[]).includes(ip);
    toggle = e=>{
        const value = e.rowData.ip;
        const checked = !this.checked(value);
        const {type, form} = this.props;
        let new_alloc;
        if (checked)
        {
            const selected = new Set();
            form[type].forEach(v=>selected.add(v));
            selected.add(value);
            new_alloc = this.state.rendered_list
                .filter(v=>selected.has(v.ip))
                .map(v=>v.ip);
        }
        else
            new_alloc = form[type].filter(r=>r!=value);
        this.set_field(type, new_alloc);
        this.update_multiply_and_pool_size(new_alloc.length);
    };
    unselect_all = ()=>{
        this.set_field(this.props.type, []);
        this.set_field('pool_size', '');
        this.set_field('multiply', 1);
    };
    select_all = ()=>{
        const {rendered_list} = this.state;
        this.set_field(this.props.type, rendered_list.map(r=>r.ip));
        this.update_multiply_and_pool_size(rendered_list.length);
    };
    refresh_chosen = ()=>{
        if (this.props.type=='ips')
            this.refresh(this.props.form.ips);
        else
            this.refresh(this.props.form.vips);
    };
    refresh_one = val=>{
        this.refresh([val]);
    };
    refresh = vals=>{
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>_this.etask(function*(){
                yield report_exception(e,
                    'alloc_modal.Alloc_modal.refresh.uncaught');
            }));
            this.on('finally', ()=>{
                _this.loading(false);
            });
            _this.loading(true);
            const data = {zone: _this.props.zone};
            if (_this.props.type=='ips')
                data.ips = vals;
            else
                data.vips = vals;
            const res = yield Api.json.post('refresh_ips', data);
            if (res.error || !res.ips && !res.vips)
            {
                return void (yield report_exception(res.error,
                    'alloc_modal.Alloc_modal.refresh'));
            }
            const new_vals = _this.props.type=='ips' ? res.ips :
                res.vips.map(v=>({...v, ip: v.vip}));
            const norm_vals = _this.normalize_vals(new_vals);
            const map = _this.map_vals(norm_vals);
            const new_ips = _this.props.form.ips.map(val=>map[val]);
            const new_vips = _this.props.form.vips.map(val=>map[val]);
            const countries = new Set();
            for (let i=0, l=norm_vals.length; i<l; i++)
            {
                const val = norm_vals[i];
                const country = val.country||val.maxmind;
                countries.add(country);
            }
            _this.setState({
                available_list: norm_vals,
                countries: [...countries],
                rendered_list: _this.filter_ips(norm_vals),
            });
            _this.set_field('ips', new_ips);
            _this.set_field('vips', new_vips);
            yield _this.update_other_proxies(map);
        });
    };
    update_other_proxies = map=>{
        const _this = this;
        return this.etask(function*(){
            const proxies_to_update = _this.state.proxies.filter(p=>
                p.zone==_this.props.zone && p.port!=_this.props.form.port &&
                p.proxy_type=='persist');
            for (let i=0; i<proxies_to_update.length; i++)
            {
                const proxy = proxies_to_update[i];
                const new_vals = proxy[_this.props.type].map(v=>map[v]);
                const data = {port: proxy.port, [_this.props.type]: new_vals};
                yield Api.post('update_ips', data);
            }
        });
    };
    normalize_vals = new_vals=>{
        const old_vals = this.state.available_list;
        if (old_vals.length!=new_vals.length)
        {
            this.etask(function*(){
                yield report_exception('error ips/vips length mismatch',
                   'alloc_modal.Alloc_modal.normalize_vals');
                return;
            });
        }
        const old_vals_hash = {};
        old_vals.forEach(v=>old_vals_hash[v.ip] = v);
        const refreshed = [];
        const stable = {};
        for (let i=0, l=new_vals.length; i<l; i++)
        {
            const new_val = new_vals[i];
            if (old_vals_hash[new_val.ip]!==undefined)
                stable[new_val.ip] = new_val;
            else
                refreshed.push(new_val);
        }
        const normalized = [];
        for (let i=0, l=old_vals.length; i<l; i++)
        {
            const old_val = old_vals[i];
            if (stable[old_val.ip]!==undefined)
                normalized.push(old_val);
            else
                normalized.push(refreshed.shift());
        }
        return normalized;
    };
    map_vals = normalized=>{
        const old_vals = this.state.available_list;
        const map = {};
        for (let i = 0; i < old_vals.length; i++)
            map[old_vals[i].ip] = normalized[i].ip;
        return map;
    };
    update_multiply_and_pool_size = size=>{
        if (!this.props.form.multiply_ips && !this.props.form.multiply_vips)
            this.set_field('pool_size', size);
        else
        {
            this.set_field('pool_size', 1);
            this.set_field('multiply', size);
        }
    };
    is_refresh_enabled = ()=>{
        const {plan, type} = this.props;
        return type!='ips' || !!plan.ips;
    };
    cols = [
        {id: 'ip', title: 'IP'},
    ];
    on_filter_change(e, field_name){
        this.setState({[field_name]: e.target.value}, this.sync_rendered_list);
    }
    filter_ips(available_list){
        let rows = available_list;
        const {ip_filter, cn_filter} = this.state;
        if (ip_filter)
            rows = rows.filter(r=>r.ip.indexOf(ip_filter)>=0);
        if (cn_filter)
            rows = rows.filter(r=>r.country==cn_filter||r.maxmind==cn_filter);
        return rows;
    }
    flag_by_code = code=>code ? flag_with_title(code, code.toUpperCase(),
        zcountry.code2label(code)) : null;
    get_extra_cols = ()=>this.props.type=='ips' ? [{id: 'maxmind', title:
        'Maxmind'}] : [{id: 'country', title: 'Country'}];
    render(){
        const type_label = this.props.type=='ips' ? 'IPs' : 'gIPs';
        const title = 'Select the '+type_label+' ('+this.props.zone+')';
        const refresh_enabled = this.is_refresh_enabled();
        const selected_list = this.props.form[this.props.type]||[];
        const zones = this.props.zones && this.props.zones.zones || [];
        const zone = zones.find(z=>z.name==this.props.zone);
        const refresh_cost = zone && zone.refresh_cost;
        const total_cost = selected_list.length*refresh_cost;
        const Footer = <div className="default_footer">
          {refresh_enabled &&
            <button onClick={this.refresh_chosen} className="btn btn_lpm"
              disabled={!selected_list.length}>
              Refresh
              {total_cost>0 && ` (${conv.fmt_currency(total_cost)})`}
            </button>
          }
          <button onClick={this.close}
            className="btn btn_lpm btn_lpm_primary">OK</button>
        </div>;
        const sub_title = `IPs: ${selected_list.length}/`
        +`${this.props.form.pool_size} out of`
        +` ${this.state.rendered_list.length} available`;
        return <Modal id="allocated_ips" className="allocated_ips_modal"
          title={title} footer={Footer}>
          <Infinite_chrome_table
            cols={[...this.cols, ...this.get_extra_cols()]}
            title={sub_title}
            toolbar={<React.Fragment>
              <div className="search_box">
                <input
                  value={this.state.ip_filter}
                  placeholder="IP filter"
                  onChange={e=>this.on_filter_change(e, 'ip_filter')}
                />
              </div>
              <Filter
                vals={this.state.countries}
                val={this.state.cn_filter}
                format_text={zcountry.code2label}
                tooltip="Countries"
                default_value="All countries"
                set={e=>this.on_filter_change(e, 'cn_filter')}
              />
            </React.Fragment>}
            class_name="in_modal_table"
            selectable
            toggle={this.toggle}
            select_all={this.select_all}
            unselect_all={this.unselect_all}
            selected_list={selected_list}
            selected_all={this.state.selected_all}
            rows={this.state.rendered_list.map(v=>({
                ...v,
                maxmind: this.flag_by_code(v.maxmind),
                country: this.flag_by_code(v.country)
            }))}
          />
        </Modal>;
    }
}
