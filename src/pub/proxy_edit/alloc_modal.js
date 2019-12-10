// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import $ from 'jquery';
import setdb from '../../../util/setdb.js';
import ajax from '../../../util/ajax.js';
import zurl from '../../../util/url.js';
import {Modal} from '../common/modals.js';
import {report_exception} from '../util.js';
import {Infinite_chrome_table} from '../chrome_widgets.js';

export default class Alloc_modal extends Pure_component {
    set_field = setdb.get('head.proxy_edit.set_field');
    state = {
        available_list: [],
        selected_all: false,
    };
    componentDidMount(){
        this.setdb_on('head.proxy_edit.zone_name', ()=>
            this.setState({available_list: []}));
        this.setdb_on('head.proxies_running', proxies=>
            proxies && this.setState({proxies}));
        $('#allocated_ips').on('show.bs.modal', this.load);
    }
    static getDerivedStateFromProps(props, state){
        if (!state.available_list.length)
            return null;
        return {
            selected_all: (props.form[props.type]||[]).length==
                state.available_list.length,
        };
    }
    close = ()=>$('#allocated_ips').modal('hide');
    load = ()=>{
        const type = this.props.type;
        const form = this.props.form;
        if (this.state.available_list.length)
            return;
        this.loading(true);
        let endpoint;
        if (type=='ips')
            endpoint = '/api/allocated_ips';
        else
            endpoint = '/api/allocated_vips';
        const url = `${endpoint}?zone=${this.props.zone}`;
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>_this.etask(function*(){
                yield report_exception(e, 'alloc_modal.Alloc_modal.load');
                _this.loading(false);
            }));
            const res = yield ajax.json({url});
            let _available_list;
            if (type=='ips')
                _available_list = res.ips;
            else
                _available_list = res;
            const available_set = new Set();
            _available_list.forEach(v=>available_set.add(v));
            const chosen_set = new Set();
            form[type].forEach(v=>{
                if (available_set.has(v))
                    chosen_set.add(v);
            });
            const not_chosen_set = new Set();
            _available_list.forEach(v=>{
                if (!chosen_set.has(v))
                    not_chosen_set.add(v);
            });
            const available_list = [...chosen_set, ...not_chosen_set];
            _this.setState({available_list}, _this.sync_selected_vals);
            _this.loading(false);
        });
    };
    sync_selected_vals = ()=>{
        const curr_vals = this.props.form[this.props.type];
        const new_vals = curr_vals.filter(v=>
            this.state.available_list.includes(v));
        this.set_field(this.props.type, new_vals);
    };
    loading = loading=>{
        setdb.set('head.proxy_edit.loading', loading);
        this.setState({loading});
    };
    checked = row=>(this.props.form[this.props.type]||[]).includes(row);
    toggle = e=>{
        const value = e.rowData;
        const checked = !this.checked(value);
        const {type, form} = this.props;
        let new_alloc;
        if (checked)
        {
            const selected = new Set();
            form[type].forEach(v=>selected.add(v));
            selected.add(value);
            new_alloc = this.state.available_list.filter(v=>selected.has(v));
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
        this.set_field(this.props.type, this.state.available_list);
        this.update_multiply_and_pool_size(this.state.available_list.length);
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
            let url;
            if (_this.props.type=='ips')
            {
                data.ips = vals.map(zurl.ip2num).join(' ');
                url = '/api/refresh_ips';
            }
            else
            {
                data.vips = vals;
                url = '/api/refresh_vips';
            }
            const res = yield ajax.json({method: 'POST', url, data});
            if (res.error || !res.ips && !res.vips)
            {
                return void (yield report_exception(res.error,
                    'alloc_modal.Alloc_modal.refresh'));
            }
            const new_vals = _this.props.type=='ips' ?
                res.ips.map(i=>i.ip) : res.vips.map(v=>v.vip);
            const norm_vals = _this.normalize_vals(new_vals);
            const map = _this.map_vals(norm_vals);
            const new_ips = _this.props.form.ips.map(val=>map[val]);
            const new_vips = _this.props.form.vips.map(val=>map[val]);
            _this.setState({available_list: norm_vals});
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
                yield ajax({method: 'POST', url: '/api/update_ips', data});
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
        const old_set = new Set();
        old_vals.forEach(v=>old_set.add(v));
        const refreshed = [];
        const stable = new Set();
        for (let new_val of new_vals)
        {
            if (old_set.has(new_val))
                stable.add(new_val);
            else
                refreshed.push(new_val);
        }
        const normalized = [];
        for (let old_val of old_vals)
        {
            if (stable.has(old_val))
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
            map[old_vals[i]] = normalized[i];
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
    render(){
        const type_label = this.props.type=='ips' ? 'IPs' : 'gIPs';
        const title = 'Select the '+type_label+' ('+this.props.zone+')';
        const refresh_enabled = this.is_refresh_enabled();
        const Footer = <div className="default_footer">
              {refresh_enabled &&
                <button onClick={this.refresh_chosen}
                  className="btn btn_lpm">Refresh</button>
              }
              <button onClick={this.close}
                className="btn btn_lpm btn_lpm_primary">OK</button>
            </div>;
        const selected_list = this.props.form[this.props.type]||[];
        const sub_title = `IPs: ${selected_list.length}/`
        +`${this.props.form.pool_size} out of`
        +` ${this.state.available_list.length} available`;
        return <Modal id="allocated_ips" className="allocated_ips_modal"
              title={title} footer={Footer}>
              <Infinite_chrome_table cols={this.cols}
                title={sub_title}
                class_name="in_modal_table"
                selectable
                toggle={this.toggle}
                select_all={this.select_all}
                unselect_all={this.unselect_all}
                selected_list={selected_list}
                selected_all={this.state.selected_all}
                rows={this.state.available_list}>
              </Infinite_chrome_table>
            </Modal>;
    }
}
