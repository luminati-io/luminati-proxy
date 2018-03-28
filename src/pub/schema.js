// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import Pure_component from '../../www/util/pub/pure_component.js';
import React from 'react';
import zurl from 'hutil/util/url';
import classnames from 'classnames';
import {If} from '/www/util/pub/react.js';
import {Tooltip, get_static_country} from './common.js';

class Schema extends Pure_component {
    constructor(props){
        super(props);
        this.state = {form: {}, proxies: []};
    }
    componentDidMount(){
        this.setdb_on('head.edit_proxy.form', (form={})=>{
            this.setState({form: {...form}});
        });
        this.setdb_on('head.edit_proxy.form.port', port=>{
            this.setState({form: {port}});
        });
        this.setdb_on('head.edit_proxy.form.country', country=>{
            this.setState({form: {country}});
        });
        this.setdb_on('head.proxies_running', proxies=>{
            if (proxies)
                this.setState({proxies});
        });
    }
    render(){
        const port = this.state.form&&this.state.form.port;
        return null;
        return (
            <span className="schema_component">
              <div className="layer crawler">
                <div className="layer_btn">Crawler</div>
              </div>
              <Lpm_layer proxies={this.state.proxies} form={this.state.form}/>
              <div className="layer super_proxy">
                <div className="arr"/>
                <div className="layer_btn">
                  <span className="flag-icon flag-icon-us"/>
                  Super Proxy
                </div>
              </div>
              <Peer_layer proxies={this.state.proxies} form={this.state.form}/>
              <div className="line"/>
              <div className="layer destination">
                <div className="arr"/>
                <div className="layer_btn">Destination</div>
              </div>
            </span>
        );
    }
}

const Lpm_layer = ({proxies, form})=>{
    let ports;
    if (form.port||!proxies.length)
        ports = ['Port '+form.port];
    else
        ports = proxies.slice(0, 3).map(p=>'Port '+p.port);
    return (
        <div className="layer lpm port">
          <div className="arr"/>
          <div className="layer_btn">
            <div className="icon"/>
            <div className="port_numbers">
              {ports.map(p=><div key={p}>{p}</div>)}
            </div>
            LPM
          </div>
        </div>
    );
};

const Peer_layer = ({proxies, form={}})=>{
    if (form.port||!proxies.length)
        return <div className="layer peer"><Peer proxy={form}/></div>;
    return (
        <div className="layer peer">
            <Peer proxy={proxies[0]}/>
            <Peer proxy={proxies[1]}/>
            <Peer proxy={proxies[2]}/>
        </div>
    );
};

const Peer = ({proxy})=>{
    let country = get_static_country(proxy);
    if (!country||country=='any'||country=='*')
        country = proxy.country;
    return (
        <div className="layer_btn">
          <div className="arr"/>
          <Flag country={country}/>
          Peer
        </div>
    );
};

const Flag = ({country})=>{
    if (country&&country!='any'&&country!='*')
        return <span className={'flag-icon flag-icon-'+country}/>;
    else
        return <img className="globe" src="/img/flag_any_country.svg"/>;
};

export default Schema;
