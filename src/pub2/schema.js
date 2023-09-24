// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import styled from 'styled-components';
import {Layout, theme, Icon} from 'uikit';
import Pure_component from '/www/util/pub/pure_component.js';
import {get_static_country} from './util.js';

const Schema_container = styled(Layout.Box).attrs({})`
    position: relative;
    top: 5px;
    width: 100%;
    max-width: 900px;
    white-space: nowrap;
    font-size: 12px;
    position: relative;
    display: flex;
    align-items: center;
    padding: 0;
    margin-bottom: 10px;
`;
Schema_container.displayName = 'Schema_container';
Schema_container.defaultProps = {
    padding: `${theme.spacing['07']} ${theme.spacing['06']}`,
};

const Line = styled.div`
    position: absolute;
    width: 100%;
    border-bottom: 1px solid ${theme.color.gray_4};
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    margin-top: auto;
    margin-bottom: auto;
    height: 0;
`;
Line.displayName = 'Line';
Line.defaultProps = {};

const Dot = styled.span`
    height: 5px;
    width: 5px;
    border-radius: 50%;
    position: absolute;
    top: 22px;
    left: -3px;
    background-color: ${theme.color.gray_11};
`;
Dot.displayName = 'Dot';
Dot.defaultProps = {};

const Step_wrapper = styled(Layout.Box).attrs({})`
    border: 1px solid ${theme.color.gray_4};
    border-radius: 4px;
    background-color: ${theme.color.white};
    margin-right: 50px;
    cursor: default;
    position: relative;
    z-index: 10;
    flex: 1;
    min-width: 160px;
    height: 50px;
    padding: 2px 20px 16px 12px;
    gap: 12px;
    column-gap: 1em;
    display: flex;
`;
Step_wrapper.displayName = 'Step_wrapper';
Step_wrapper.defaultProps = {
    padding: `${theme.spacing['07']} ${theme.spacing['06']}`,
};

const Step_icon_wrapper = styled(Layout.Box).attrs({})`
    border-radius: 4px;
    width: 30px;
    height: 30px;
    background-color: ${theme.color.gray_4};
    margin-top: 8px;
    display: flex;
    justify-content: center;
    align-items: center;
`;
Step_icon_wrapper.displayName = 'Step_icon_wrapper';
Step_icon_wrapper.defaultProps = {};

const Step_content = styled(Layout.Box).attrs({})`
    display: flex;
    flex-direction: column;
`;
Step_content.displayName = 'Step_content';
Step_content.defaultProps = {};

const Step_title = styled.span`
    color: ${theme.color.black_1};
    font-weight: 500;
    font-size: 14px;
    position: fixed;
    margin-top: 5px;
`;
Step_title.displayName = 'Step_title';
Step_title.defaultProps = {};

const Step_subtitle = styled.span`
    color: ${theme.color.grey_11};
    position: fixed;
    margin-top: 20px;
`;
Step_subtitle.displayName = 'Step_subtitle';
Step_subtitle.defaultProps = {};

const Step_icon = ({icon, country})=>
    <Step_icon_wrapper>
        {country ? <span className={'fi fi-'+country}/>
            : <Icon name={icon} size="xs" verticalAlign="middle"
            color="gray_10"/>
        }
    </Step_icon_wrapper>;

const Step = ({icon, title, subtitle, first, country})=>
    <Step_wrapper>
    {!first && <Dot />}
    <Step_icon icon={icon} country={country}/>
        <Step_content>
            <Step_title>{title}</Step_title>
            <Step_subtitle>{subtitle}</Step_subtitle>
        </Step_content>
    </Step_wrapper>;

class Schema extends Pure_component {
    state = {form: {}, proxies: [], spcountry: 'us'};
    componentDidMount(){
        this.setdb_on('head.locations', locations=>{
            if (!locations)
                return;
            this.setState({locations});
        });
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
        this.setdb_on('ws.zones', zones=>{
            if (zones)
                this.setState({zones});
        });
        this.setdb_on('head.settings', settings=>{
            this.setState({proxy_port: settings.proxy_port});
        });
        this.setdb_on('head.proxy_edit.form.proxy', proxy=>{
            const country_prefix = 'servercountry-';
            if (proxy && proxy.includes(country_prefix))
            {
                const start_index = proxy.indexOf(country_prefix)+
                    country_prefix.length;
                const spcountry = proxy.substring(start_index, start_index+2);
                this.setState({spcountry});
            }
        });
    }
    get_country_name = cid=>{
        const countries = this.state?.locations?.countries;
        const cname = countries?.find(c=>c.country_id==cid)?.country_name;
        return !cname || cname.length>13 ? cid.toUpperCase() : cname;
    };
    get_country = (zones, proxy={})=>{
        let country = get_static_country(proxy, zones);
        if (!country||country=='any'||country=='*')
            country = proxy.country;
        if (country&&country!='any'&&country!='*')
            return country;
        return null;
    };
    get_peer_country = ()=>{
        const {zones, proxies, form} = this.state;
        if (form.port)
        return this.get_country(zones, form);
        else if (!proxies.length)
            return this.get_country(zones);
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
            return this.get_country(zones);
        return this.get_country(zones, proxies[0]);
    };
    render(){
        if (!this.state.zones)
            return null;
        let peer_country = this.get_peer_country();
        if (peer_country=='any' || peer_country=='*')
            peer_country=null;
        let peer_title = peer_country ? this.get_country_name(peer_country)
            : 'Peer';
        let peer_subtitle = peer_country ? 'Peer' : 'Description line';
        return <Schema_container>
            <Line />
            <Step
                first
                icon="Code"
                title="Crawler"
                subtitle="Description line"
            />
            <Step
                icon="Dashboard"
                title="Proxy Manager"
                subtitle="Description line"
            />
            <Step
                icon="Subset"
                country={this.state.spcountry}
                title={this.get_country_name(this.state.spcountry)}
                subtitle="Super proxy"
            />
            <Step
                icon="Globe"
                country={peer_country}
                title={peer_title}
                subtitle={peer_subtitle}
            />
            <Step
                icon="Flag"
                title="Target website"
                subtitle="Destination"
            />
        </Schema_container>;
    }
}

export default Schema;
