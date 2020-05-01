// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import Tooltip from './tooltip.js';
import {get_static_country} from '../util.js';
import {flag_with_title, any_flag} from '../common.js';
import {T} from './i18n.js';
import '../css/zone_desc.less';

export default class Zone_description extends Pure_component {
    state = {};
    componentDidMount(){
        this.setdb_on('head.zones', zones=>{
            if (!zones || this.props.zones)
                return;
            this.setState({zones, zone: zones.def});
        });
    }
    network_types = {
        static: {
            label: 'Data center',
            tooltip: 'Static IPs from various data centers located around '
                +'the globe',
        },
        resident: {
            label: 'Residential',
            tooltip: 'P2P residential network. Millions of IPs from real '
                +'devices',
        },
        custom: {
            label: 'Custom',
            tooltip: '3G and 4G network from real mobile devices',
        },
        static_res: {
            label: 'Static residential',
            tooltip: 'Static residential IPs',
        },
        unblocker: {
            label: 'Unblocker',
            tooltip: 'Smart proxy which automatically manages IPs, headers, '
                +'and network',
        },
    };
    ips_types = {
        shared: 'Shared',
        dedicated: 'Exclusive / Unlimited domains',
        selective: 'Exclusive domains',
    };
    render(){
        // XXX krzysztof: fix this, zones description should be generated once
        // and reused in proxies table
        const zones = this.state.zones || this.props.zones;
        if (!zones)
            return null;
        const zone_name = this.props.zone_name||zones.def;
        const zone = zones.zones.find(z=>z.name==zone_name);
        if (!zone)
            return <span>This zone is disabled</span>;
        const plan = zone.plan;
        if (plan.pool_ip_type)
            plan.type = plan.pool_ip_type;
        const static_country = get_static_country({zone: zone_name}, zones);
        let c = any_flag;
        if (static_country && static_country!='any' && static_country!='*')
            c = flag_with_title(static_country, static_country.toUpperCase());
        return <T>{t=><div className="zone_settings">
              <ul className="bullets">
                <Zone_bullet atr="Network type"
                  tip="The network accessible by this zone">
                  <Tooltip title={t(this.network_types[plan.type].tooltip)}>
                    {t(this.network_types[plan.type].label)}
                  </Tooltip>
                </Zone_bullet>
                <Zone_bullet show={plan.ips_type!==undefined}
                  atr="IP exclusivity">
                  {t(this.ips_types[plan.ips_type])}
                </Zone_bullet>
                <Zone_bullet atr="Country" tip="Allowed country">
                  {t(c)}</Zone_bullet>
                <Zone_bullet show={plan.ips!==undefined} atr="Number of IPs">
                  {plan.ips}</Zone_bullet>
                <Zone_bullet atr="Permissions" tip="Set of permissions">
                  <Perm_icons perm_list={zone.perm.split(' ')} plan={plan}/>
                </Zone_bullet>
              </ul>
            </div>}</T>;
    }
}

class Perm_icons extends Pure_component {
    prem_tooltips = {
        vip: 'gIP - Group of exclusive residential IPs',
        residential: 'Residential IPs',
        country: 'Country resolution',
        state: 'Residential IPs - State resolution',
        data_center: 'Data center IPs',
        static_res: 'Static residential IPs',
        asn: 'Residential IPs - "Autonomous System Number" (ASN) resolution',
        city: 'Residential IPs - City resolution',
        mobile: 'Mobile IPs',
    };
    perm_icons = ['country', 'state', 'asn', 'city', 'vip'];
    render(){
        const {perm_list} = this.props;
        if (!perm_list||!perm_list.length)
            return <div>no perm</div>;
        const perm = {};
        for (let p of perm_list)
            perm[p] = true;
        const icons = perm_list.filter(p=>this.perm_icons.includes(p));
        if (perm.mobile)
            icons.unshift('mobile');
        else if (this.props.plan.pool_ip_type=='static_res')
            icons.unshift('static_res');
        else if (perm.vip)
            icons.unshift('residential');
        else if (perm.route_dedicated)
            icons.unshift('data_center');
        return <T>{t=>
              <div>{icons.map(_perm=>
                <Tooltip key={_perm} title={t(this.prem_tooltips[_perm])}>
                  <div className={'perm_icon '+_perm}/>
                </Tooltip>)}
              </div>
            }</T>;
    }
}

const Zone_bullet = ({tip, show, atr, children})=>{
    if (show===undefined)
        show = true;
    if (!show)
        return null;
    return <T>{t=>
          <li className="pair">
            <Tooltip title={t(tip)}>
              <span className="title">{t(atr)}:</span>
            </Tooltip>
            <span className="val">{children}</span>
          </li>
        }</T>;
};
