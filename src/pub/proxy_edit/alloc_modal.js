// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import $ from 'jquery';
import setdb from '../../../util/setdb.js';
import ajax from '../../../util/ajax.js';
import zurl from '../../../util/url.js';
import {Modal} from '../common/modals.js';
import {Pagination_panel, Link_icon, Checkbox} from '../common.js';

export default class Alloc_modal extends Pure_component {
    set_field = setdb.get('head.proxy_edit.set_field');
    state = {
        available_list: [],
        displayed_list: [],
        cur_page: 0,
        items_per_page: 20,
    };
    componentDidMount(){
        this.setdb_on('head.proxy_edit.zone_name', ()=>
            this.setState({available_list: []}));
        this.setdb_on('head.proxies_running', proxies=>
            proxies && this.setState({proxies}));
        $('#allocated_ips').on('show.bs.modal', this.load);
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
            this.on('uncaught', e=>{
                // XXX krzysztof: use perr
                console.log(e);
                _this.loading(false);
            });
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
            _this.setState({available_list, cur_page: 0},
                _this.sync_selected_vals);
            _this.loading(false);
        });
    };
    sync_selected_vals = ()=>{
        const curr_vals = this.props.form[this.props.type];
        const new_vals = curr_vals.filter(v=>
            this.state.available_list.includes(v));
        this.set_field(this.props.type, new_vals);
        this.update_multiply_and_pool_size(new_vals.length);
        this.paginate();
    };
    paginate = (page=-1)=>{
        page = page>-1 ? page : this.state.cur_page;
        const pages = Math.ceil(
            this.state.available_list.length/this.state.items_per_page);
        const cur_page = Math.min(pages, page);
        const displayed_list = this.state.available_list.slice(
            cur_page*this.state.items_per_page,
            (cur_page+1)*this.state.items_per_page);
        this.setState({displayed_list, cur_page});
    };
    loading = loading=>{
        setdb.set('head.proxy_edit.loading', loading);
        this.setState({loading});
    };
    checked = row=>(this.props.form[this.props.type]||[]).includes(row);
    reset = ()=>{
        this.set_field(this.props.type, []);
        this.set_field('pool_size', '');
        this.set_field('multiply', 1);
    };
    toggle = e=>{
        const {value, checked} = e.target;
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
            this.on('uncaught', e=>{
                // XXX krzysztof: use perr
                console.log(e);
            });
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
                // XXX krzysztof: use perr
                console.log(`error: ${res.error}`);
                return;
            }
            const new_vals = _this.props.type=='ips' ?
                res.ips.map(i=>i.ip) : res.vips.map(v=>v.vip);
            const norm_vals = _this.normalize_vals(new_vals);
            const map = _this.map_vals(norm_vals);
            const new_ips = _this.props.form.ips.map(val=>map[val]);
            const new_vips = _this.props.form.vips.map(val=>map[val]);
            _this.setState({available_list: norm_vals}, _this.paginate);
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
            // XXX krzysztof: use perr
            console.log('error ips/vips length mismatch');
            return;
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
    update_items_per_page = items_per_page=>
        this.setState({items_per_page}, ()=>this.paginate(0));
    page_change = page=>this.paginate(page-1);
    render(){
        const type_label = this.props.type=='ips' ? 'IPs' : 'gIPs';
        const title = 'Select the '+type_label+' ('+this.props.zone+')';
        const Footer = <div className="default_footer">
              <button onClick={this.refresh_chosen} className="btn btn_lpm">
                Refresh</button>
              <button onClick={this.close}
                className="btn btn_lpm btn_lpm_primary">OK</button>
            </div>;
        return <Modal id="allocated_ips" className="allocated_ips_modal"
              title={title} footer={Footer}>
              <Pagination_panel
                entries={this.state.available_list}
                items_per_page={this.state.items_per_page}
                cur_page={this.state.cur_page}
                page_change={this.page_change} top
                update_items_per_page={this.update_items_per_page}>
                <Link_icon tooltip="Unselect all" on_click={this.reset}
                  id="unchecked"/>
                <Link_icon tooltip="Select all" on_click={this.select_all}
                  id="check"/>
              </Pagination_panel>
              {this.state.displayed_list.map(row=>
                <Entry toggle={this.toggle} key={row} val={row}
                  checked={this.checked(row)} refresh={this.refresh_one}/>
              )}
              <Pagination_panel
                entries={this.state.available_list}
                items_per_page={this.state.items_per_page}
                cur_page={this.state.cur_page}
                page_change={this.page_change} bottom
                update_items_per_page={this.update_items_per_page}>
                <Link_icon tooltip="Unselect all"
                  on_click={this.reset} id="unchecked"/>
                <Link_icon tooltip="Select all"
                  on_click={this.select_all.bind(this)} id="check"/>
              </Pagination_panel>
            </Modal>;
    }
}

const Entry = props=>
    <div style={{display: 'flex'}}>
      <Checkbox on_change={props.toggle} text={props.val} value={props.val}
        checked={props.checked}/>
      <div className="chrome_icon refresh"
        onClick={()=>props.refresh(props.val)}
        style={{top: 1, position: 'relative', left: 3}}/>
    </div>;

