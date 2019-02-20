// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import Tooltip from './tooltip.js';
import {get_static_country} from '../util.js';
import {flag_with_title, any_flag} from '../common.js';

export default class Zone_description extends Pure_component {
    network_types = {
        static: {
            label: 'Data center',
            tooltip: `Static IPs from various data centers located around
                the globe`,
        },
        resident: {
            label: 'Residential',
            tooltip: `P2P residential network. Millions of IPs from real
                devices`,
        },
        custom: {
            label: 'Custom',
            tooltip: `3G and 4G network from real mobile devices`,
        },
    };
    ips_types = {
        shared: 'Shared',
        dedicated: 'Exclusive / Unlimited domains',
        selective: 'Exclusive domains',
    };
    render(){
        const {zone_name, zones} = this.props;
        const zone = zones.zones.find(z=>z.name==(zone_name||zones.def));
        if (!zone)
            return <span>This zone is disabled</span>;
        const plan = zone.plan;
        const static_country = get_static_country({zone: zone_name}, zones);
        let c = any_flag;
        if (static_country && static_country!='any' && static_country!='*')
            c = flag_with_title(static_country, static_country.toUpperCase());
        return <div className="zone_settings">
              <ul className="bullets">
                <Zone_bullet atr="Network type"
                  tip="The network accessible by this zone">
                  <Tooltip title={this.network_types[plan.type].tooltip}>
                    {this.network_types[plan.type].label}
                  </Tooltip>
                </Zone_bullet>
                <Zone_bullet show={plan.ips_type!==undefined}
                  atr="IP exclusivity">
                  {this.ips_types[plan.ips_type]}
                </Zone_bullet>
                <Zone_bullet atr="Country" tip="Allowed country">
                  {c}</Zone_bullet>
                <Zone_bullet show={plan.ips!==undefined} atr="Number of IPs">
                  {plan.ips}</Zone_bullet>
                <Zone_bullet atr="Permissions" tip="Set of permissions">
                  <Perm_icons perm_list={zone.perm.split(' ')}/></Zone_bullet>
              </ul>
            </div>;
    }
}

class Perm_icons extends Pure_component {
    prem_tooltips = {
        vip: 'gIP - Group of exclusive residential IPs',
        residential: 'Residential IPs',
        country: 'Country resolution',
        state: 'Residential IPs - State resolution',
        data_center: 'Data center IPs',
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
        else if (perm.vip)
            icons.unshift('residential');
        else if (perm.route_dedicated)
            icons.unshift('data_center');
        return <div>{icons.map(_perm=>
              <Tooltip key={_perm} title={this.prem_tooltips[_perm]}>
                <div className={'perm_icon '+_perm}/>
              </Tooltip>)}
            </div>;
    }
}

const Zone_bullet = ({tip, show, atr, children})=>{
    if (show===undefined)
        show = true;
    if (!show)
        return null;
    return <li className="pair">
          <Tooltip title={tip}><span className="title">{atr}:</span></Tooltip>
          <span className="val">{children}</span>
        </li>;
};
