// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import Pure_component from '/www/util/pub/pure_component.js';
import React from 'react';
import classnames from 'classnames';
import {get_static_country} from './util.js';
import Tooltip from './common/tooltip.js';
import {T} from './common/i18n.js';

const tooltips = {
    crawler: `Your crawler or bot that systematically browses the web. Connect
        any type of crawler to the Luminati Proxy Manager:
        <ul>
          <li>
            <div>Browser and extension based crawlers</div>
            <div class="browser_icon firefox"></div>
            <div class="browser_icon chrome"></div>
            <div class="browser_icon safari"></div>
            <div class="browser_icon explorer"></div>
          </li>
          <li>
            <div>Dedicated crawling solutions</div>
            <div class="logo_icon crawlera"></div>
            <div class="logo_icon legs"></div>
            <div class="logo_icon import"></div>
          </li>
        </ul>`,
    port_numbers: `Defined proxy ports in Luminati Proxy Manager`,
    lpm: `Luminati Proxy Manager - open-source proxy service that holds
        valuable features, such as:
        <ul>
          <li>IP rotation control</li>
          <li>auto retry</li>
          <li>speed optimization</li>
          <li>auto blacklist of bad IPs</li>
          <li>powerful debugging options</li>
        </ul>
        and more. View full list of features by clicking any proxy port in
        the <strong>Proxies</strong> table`,
    super_proxy: `Load balancing servers, that manage the traffic between the
        Luminati Proxy Manager and the peer`,
    peer: `Exit node (IP) - This might be:
        <ul>
          <li>Residential IP - provided through cable modem, DSL or wireless
            router</li>
          <li>Datacenter IP (static)</li>
          <li>Mobile IP - based on a 3G or 4G cellular network</li>
        </ul>`,
    destination: `The target website that the crawler is collecting data from`,
};

class Schema extends Pure_component {
    state = {form: {}, proxies: []};
    componentDidMount(){
        this.setdb_on('head.proxy_edit.form', (form={})=>{
            this.setState({form: {...form}});
        });
        this.setdb_on('head.proxy_edit.form.zone', zone=>{
            if (zone===undefined)
                return;
            this.setState(prev=>({form: {...prev.form, zone}}));
        });
        this.setdb_on('head.proxy_edit.form.port', port=>{
            this.setState(prev=>({form: {...prev.form, port}}));
        });
        this.setdb_on('head.proxy_edit.form.country', country=>{
            this.setState(prev=>({form: {...prev.form, country}}));
        });
        this.setdb_on('head.proxies_running', proxies=>{
            if (proxies)
                this.setState({proxies});
        });
        this.setdb_on('head.zones', zones=>{
            if (zones)
                this.setState({zones});
        });
    }
    render(){
        if (!this.state.zones)
            return null;
        return <span className="schema_component">
              <div className="line"/>
              <Layer id="crawler" no_arr>
                <T>Crawler</T>
              </Layer>
              <Proxy_port_layer proxies={this.state.proxies}
                form={this.state.form}/>
              <Layer id="lpm" class_names="port active">
                <div className="icon"/>
                <T>LPM</T>
              </Layer>
              <Layer no_btn id="port_numbers"><T>Port</T> 22225</Layer>
              <Layer id="super_proxy">
                <span className="flag-icon flag-icon-us"/>
                <T>Super Proxy</T>
              </Layer>
              <Layer no_btn id="port_numbers"><T>Port</T> 80, 443</Layer>
              <Layer id="peer">
                <Peer proxies={this.state.proxies} form={this.state.form}
                  zones={this.state.zones}/>
                <T>Peer</T>
              </Layer>
              <Layer id="destination"><T>Destination</T></Layer>
            </span>;
    }
}

const Proxy_port_layer = ({proxies, form})=>{
    let label;
    if (form.port)
        label = ' '+form.port;
    else if (!proxies.length)
        label = '';
    else if (proxies.length==1)
        label = ' '+proxies[0].port;
    else
        label = ' '+proxies[0].port+' - '+proxies[proxies.length-1].port;
    return <Layer no_btn id="port_numbers"><T>Proxy port</T>{label}</Layer>;
};

const Layer = ({id, no_btn, no_arr, class_names, children})=>{
    return <div className={classnames('layer', id, class_names)}>
          <Tooltip placement="bottom" title={tooltips[id]}>
            <span>
              {!no_btn && !no_arr && <div className="arr"/>}
              {!no_btn && <div className="layer_btn">{children}</div>}
              {no_btn && children}
            </span>
          </Tooltip>
        </div>;
};

const Peer = ({proxies, form, zones})=>{
    if (form.port)
        return <Flag zones={zones} proxy={form}/>;
    else if (!proxies.length)
        return <Flag zones={zones}/>;
    let countries = proxies.map(proxy=>{
        let country = get_static_country(proxy, zones);
        if (!country||country=='any'||country=='*')
            country = proxy.country;
        if (!country||country=='any'||country=='*')
            country = false;
        return country;
    });
    countries = [...new Set(countries)];
    if (countries.length>1)
        return <Flag zones={zones}/>;
    return <Flag proxy={proxies[0]} zones={zones}/>;
};

const Flag = ({proxy={}, zones})=>{
    let country = get_static_country(proxy, zones);
    if (!country||country=='any'||country=='*')
        country = proxy.country;
    if (country&&country!='any'&&country!='*')
        return <span className={'flag-icon flag-icon-'+country}/>;
    return <img className="globe" src="/img/flag_any_country.svg"/>;
};

export default Schema;
