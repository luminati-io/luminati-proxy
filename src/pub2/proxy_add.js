// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React, {useMemo} from 'react';
import styled from 'styled-components';
import {withRouter} from 'react-router-dom';
import {
  Modal,
  Button,
  Layout,
  Typography,
  CodeBlock,
} from 'uikit';
import Pure_component from '/www/util/pub/pure_component.js';
import etask from '../../util/etask.js';
import presets from './common/presets.js';
import {Textarea, Select_zone_new} from './common/controls.js';
import Zone_description from './common/zone_desc.js';
import {T, t} from './common/i18n.js';
import Box_radio from './common/box_radio.js';
import {main as Api} from './api.js';
import {networks} from './util.js';
import instructions from './instructions.js';
import {Labeled_section, Labeled_controller_new, Copy_icon} from './common.js';
import {report_exception} from './util.js';
import './css/proxy_add.less';

const {Popup} = Modal;

const Proxy_add = withRouter(class Proxy_add extends Pure_component {
    constructor(props){
        super(props);
        this.state = {
            zones: null,
            zone: '',
            preset: 'session_long',
            saving: false,
            error_list: [],
            network: 'brd',
            parse_error: null,
            ips_list: '',
        };
    }
    static getDerivedStateFromProps(props, state){
        const is_unblocker = ()=>{
            if (!state.zones)
                return false;
            const zone_name = state.zone || state.zones.def;
            const zone = state.zones.zones.find(p=>p.name==zone_name) || {};
            const plan = zone.plan || {};
            return plan.type=='unblocker';
        };
        return {preset: is_unblocker() ? 'unblocker' :
            state.preset=='unblocker' ? 'session_long' : state.preset};
    }
    componentDidMount(){
        this.setdb_on('head.proxies_running', proxies_running=>{
            if (!proxies_running)
                return;
            this.setState({proxies_running});
        });
        this.setdb_on('ws.zones', zones=>{
            if (!zones)
                return;
            this.setState({zones});
        });
    }
    persist = ()=>{
        const form = {};
        if (this.state.network=='brd')
        {
            form.preset = this.state.preset;
            form.zone = this.state.zone;
        }
        else
        {
            form.preset = 'rotating';
            form.ext_proxies = this.state.parsed_ips_list;
        }
        form.proxy_type = 'persist';
        presets.get(form.preset).set(form);
        const _this = this;
        return etask(function*(){
            this.on('uncaught', e=>_this.etask(function*(){
                yield report_exception(e, 'proxy_add.Proxy_add.persist');
                _this.setState({saving: false});
            }));
            const resp = yield Api.json.post('proxies', {proxy: form});
            if (resp.errors)
                return resp;
            return {port: resp.data.port};
        });
    };
    save = ()=>{
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>_this.etask(function*(){
                yield report_exception(e, 'proxy_add.Proxy_add.save');
            }));
            this.finally(()=>{
                _this.setState({saving: false});
                if (resp && resp.port && !resp.errors)
                    _this.next_step();
            });
            _this.setState({saving: true});
            const resp = yield _this.persist();
            if (resp.errors)
                _this.setState({error_list: resp.errors});
            if (resp.port)
                _this.setState({created_port: resp.port});
        });
    };
    change_field = field=>value=>this.setState({[field]: value});
    render(){
        if (!this.state.proxies_running || !this.state.zones)
            return null;
        const disabled = this.state.network=='ext'&&
            !this.state.valid_json;
        const {settings: {lpm_token='', zagent, cloud_url_address}}
            = this.props;
        const hostname = zagent ? cloud_url_address : undefined;
        const {network, preset, zone, ips_list, parse_error, error_list,
            created_port} = this.state;
        const error_list_body = error_list.length &&
            <ul>{error_list.map((e, i)=><li key={`e_${i}`}>{e}</li>)}</ul>;
        return <div className="proxy_add vbox">
          <div className="cp_panel vbox force_cp_panel">
            {!zagent &&
              <div className="cp_panel_header">
                <h2 className="section_title"><T>New proxy port</T></h2>
              </div>
            }
            <div className="proxy_add_form">
              <Network
                network={network}
                zone={zone}
                ips_list={ips_list}
                change_fn={this.change_field}
                parse_error={parse_error}
                zagent={this.props.zagent}
              />
              {network=='brd' && <Configuration
                preset={preset}
                on_change={this.change_field('preset')}
              />}
              <div className='proxy_add_btn_container'>
                <Button
                  text="Create proxy"
                  loadingText="Creating"
                  onClick={this.save}
                  disabled={disabled}
                  loading={this.state.saving}
                />
              </div>
            </div>
          </div>
          <Popup
            show={!!error_list.length}
            onOk={()=>this.setState({error_list: []})}
            onCancel={null}
            title="Saving error"
            content={error_list_body}
            shadow="sm"
            size="md"
          />
          <Created_port_popup
            port={created_port}
            hostname={hostname}
            lpm_token={lpm_token.split('|')[0]}
            back={this.back_func}
          />
        </div>;
    }
});

const Created_port_popup = props=>{
    const {port, back} = props;
    let content = useMemo(()=><Created_port {...props}/>, [port]);
    return <Popup
      show={!!port}
      onOk={back}
      okLabel="Close and continue"
      onCancel={null}
      title="Proxy summary"
      content={content}
      shadow="sm"
      size="lg"
    />;
};

const Section_label = styled(Typography.Label)`
    font-size: 18px;
    padding-bottom: 10px;
`;

const Section_desc = styled(Typography.Paragraph)`
    padding-bottom: 10px;
`;

const Section = ({label, desc, children})=>
  <Layout.Box width="500px" max_width="500px">
    <Section_label variant="lg">
      {label}
    </Section_label>
    <Section_desc variant="lg_snug">
      {desc}
    </Section_desc>
    {children}
  </Layout.Box>;

const Network = props=>
  <Section label="Network" desc={`Select your prefered network:
    Bright Data or an external vendor?`}>
    <Box_radio
      options={networks}
      value={props.network}
      on_change={props.change_fn('network')}
    />
    {props.network=='brd' ?
      <Zone_select
        zone={props.zone}
        on_change={props.change_fn('zone')}
      /> : <Ext_proxy
        parse_error={props.parse_error}
        ips_list={props.ips_list}
        on_field_change={props.change_fn}
        zagent={props.zagent}
      />}
  </Section>;

const Configuration = ({preset, on_change})=>
  <Section label="Configuration" desc={`Using this proxy with a browser
    or a scraper?`}>
    <Box_radio
      options={presets.proxy_add_options}
      value={preset}
      on_change={on_change}
    />
  </Section>;

const Zone_select = ({zone, on_change})=>{
  return <>
    <Labeled_section
      label="Zone selection"
      tooltip="Zone that will be used by this proxy port"
      class_name="proxy_add_zone_select_section">
      <Labeled_controller_new>
          <Select_zone_new
            val={zone}
            preview
            on_change_wrapper={on_change}
          />
      </Labeled_controller_new>
    </Labeled_section>
    <Zone_description zone_name={zone}/>
  </>;
};

const Note = ({children})=><div className="note">{children}</div>;

const Port_code = styled(CodeBlock)`
    margin-top: 10px;
`;

const Created_port = ({port, hostname, lpm_token})=>{
    const code = instructions.code(port, lpm_token, hostname).shell;
    return <div className="howto">
      <Note>
        <Layout.Flex>
          <div>
          <T>Congrats!!! You've created a new port</T>: {port}
          </div>
          <Copy_icon text={port} />
        </Layout.Flex>
      </Note>
      <Note>
        <T>Start using the port by running the following command</T>:
      </Note>
      <Port_code
        copyButton
        lineNumbers
        header={<Typography.Label>Code overview</Typography.Label>}
        code={code}
        lang="shell"
      />
    </div>;
};

class Ext_proxy extends Pure_component {
    state = {consts: {}};
    json_example = '[\'1.1.1.2\', \'my_username:my_password@1.2.3.4:8888\']';
    placeholder = 'List the IPs for the external proxies that you\'d like to '
        +'connect to.\nUse format: [username:password@]ip[:port]';
    componentDidMount(){
        this.setdb_on('head.consts', ({consts})=>
            consts && this.setState({consts}));
    }
    on_change_list = val=>{
        const {on_field_change, zagent} = this.props;
        const {consts: {MAX_EXT_PROXIES}} = this.state;
        on_field_change('ips_list')(val);
        try {
            const parsed = JSON.parse(val.replace(/'/g, '"'));
            if (!Array.isArray(parsed))
                throw {message: 'Proxies list has to be an array'};
            if (!parsed.length)
                throw {message: 'Proxies list array can not be empty'};
            if (zagent && MAX_EXT_PROXIES!==undefined &&
                parsed.length>MAX_EXT_PROXIES)
            {
                throw {message: `Maximum external proxies size is `
                    +MAX_EXT_PROXIES};
            }
            parsed.forEach(ip=>{
                if (typeof ip!='string')
                    throw {message: 'Wrong format of proxies list'};
                if (!ip)
                    throw {message: 'Proxy IP can not be an empty string'};
            });
            on_field_change('parsed_ips_list')(parsed);
            on_field_change('parse_error')(null);
            on_field_change('valid_json')(true);
        } catch(e){
            on_field_change('parse_error')(e.message);
            on_field_change('valid_json')(false);
        }
    };
    render(){
        return <Labeled_section
          label="What should we collect?"
          class_name="ext_proxy">
          <Textarea rows={6} val={this.props.ips_list}
            placeholder={t(this.placeholder)}
            on_change_wrapper={this.on_change_list}/>
          <div className="json_example">
            <strong><T>Example</T>: </strong>{this.json_example}
          </div>
          <div className="json_error">{this.props.parse_error}</div>
        </Labeled_section>;
    }
}

export default Proxy_add;
