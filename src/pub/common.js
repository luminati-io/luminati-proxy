// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import React_tooltip from 'react-tooltip';
import classnames from 'classnames';
import codemirror from 'codemirror/lib/codemirror';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/lib/codemirror.css';
import $ from 'jquery';
import {bytes_format, report_exception} from './util.js';
import presets from './common/presets.js';
import {Pins, Select_status, Select_number, Yes_no, Regex, Json, Textarea,
    Typeahead_wrapper, Input, Select, Url_input} from './common/controls.js';
import Tooltip from './common/tooltip.js';
import {T, with_tt, Language} from './common/i18n.js';
import conv from '../../util/conv.js';

export const Tooltip_bytes = props=>{
    let {bytes, bytes_out, bytes_in, cost} = props;
    bytes = bytes||0;
    let n;
    if (bytes < 1e3)
        n = 0;
    else if (bytes < 1e6)
        n = 1;
    else if (bytes < 1e9)
        n = 2;
    else
        n = 3;
    const bw = bytes_format(bytes, n);
    const bw_out = bytes_format(bytes_out, n);
    const bw_in = bytes_format(bytes_in, n);
    const display_cost = cost&&conv.fmt_currency(cost||0);
    const details = bytes_out&&bytes_in&&`(${bw_out} up | ${bw_in} down)` ||
        cost&&`(Estimated savings ${display_cost})` || '';
    const tooltip = `<div><strong>${bw}</strong> ${details}</div>`;
    return <Tooltip title={bytes ? tooltip : ''}>
      <div className="disp_value">
        {display_cost||bytes_format(bytes)||'—'}
      </div>
    </Tooltip>;
};

export const Warnings = props=>
    <div>
      {(props.warnings||[]).map((w, i)=>
          <Warning key={i} text={w.msg} id={w.id}/>
      )}
    </div>;

export class Warning extends Pure_component {
    constructor(props){
        super(props);
        const dismissed_warnings = JSON.parse(window.localStorage.getItem(
            'dismissed-warnings'))||{};
        this.state = {dismissed: props.id && dismissed_warnings[props.id]};
    }
    dismiss = ()=>{
        this.setState({dismissed: true}, this.store);
    };
    store = ()=>{
        const dismissed_warnings = JSON.parse(window.localStorage.getItem(
            'dismissed-warnings'))||{};
        dismissed_warnings[this.props.id] = true;
        window.localStorage.setItem('dismissed-warnings', JSON.stringify(
            dismissed_warnings));
    };
    render(){
        if (this.state.dismissed)
            return null;
        const content = this.props.text||this.props.children;
        return <Tooltip className="wide"
          title={this.props.tooltip}
          placement="bottom">
          <div className="warning">
            <div className="warning_icon"/>
            <div className="hbox">{content}</div>
            {this.props.id &&
              <Toolbar_button tooltip="Dismiss" id="close_btn"
                placement="left" on_click={this.dismiss}/>
            }
          </div>
        </Tooltip>;
    }
}

export const Loader = ({show})=>{
    if (!show)
        return null;
    return <div className="loader_wrapper">
      <div className="mask"/>
      <div className="loader">
        <div className="spinner"/>
      </div>
    </div>;
};

export const Loader_small = props=>{
    let {show, saving, loading_msg, std_msg='', std_tooltip} = props;
    saving = show||saving;
    loading_msg = loading_msg||'Saving...';
    const msg = saving ? loading_msg : std_msg;
    const tooltip = saving ? '' : std_tooltip;
    return <div className="loader_small">
      <div className={classnames('spinner', {show: saving})}/>
      <div className={classnames('saving_label', {saving})}>
        <Tooltip title={tooltip}>{msg}</Tooltip>
      </div>
    </div>;
};

// XXX krzysztof: refactoring: reuse Copy_btn component
export const Code = with_tt(['Copy to clipboard', 'Copy', 'Copied!'],
class Code extends Pure_component {
    componentDidMount(){
        const {t} = this.props;
        $(this.ref).find('.btn_copy').tooltip('show')
        .attr('title', t['Copy to clipboard']).tooltip('fixTitle');
    }
    set_ref(e){ this.ref = e; }
    copy(){
        const {t} = this.props;
        if (this.props.on_click)
            this.props.on_click();
        const area = $(this.ref).children('textarea')[0];
        const source = $(this.ref).children('.source')[0];
        area.value = source.innerText;
        area.select();
        try {
            document.execCommand('copy');
            $(this.ref).find('.btn_copy').attr('title', t['Copied!'])
            .tooltip('fixTitle')
            .tooltip('show').attr('title', t['Copy to clipboard'])
            .tooltip('fixTitle');
        } catch(e){
            this.etask(function*(){
                yield report_exception(e, 'common.Code.copy');
            });
        }
    }
    render(){
        const {t} = this.props;
        return <code ref={this.set_ref.bind(this)}>
          <span className="source">{this.props.children}</span>
          <textarea style={{position: 'fixed', top: '-1000px'}}/>
          <button onClick={this.copy.bind(this)} data-container="body"
            className="btn btn_lpm btn_lpm_small btn_copy">
            {t['Copy']}
          </button>
        </code>;
    }
});

export const with_proxy_ports = Component=>{
    const port_select = data=>function port_select_inner(props){
        return <Select val={props.val}
              data={data} on_change_wrapper={props.on_change}
              disabled={props.disabled}/>;
    };
    class With_proxy_ports extends Pure_component {
        state = {};
        port_select = port_select([]);
        componentDidMount(){
            this.setdb_on('head.proxies_running', proxies=>{
                if (!proxies)
                    return;
                const ports = proxies.map(p=>p.port);
                const ports_opt = proxies.map(p=>{
                    const name = p.internal_name ?
                        ` (${p.internal_name})` : '';
                    const key = p.port+name;
                    return {key, value: p.port};
                });
                const def_port = ports[0];
                this.port_select = port_select(ports_opt);
                this.setState({ports, ports_opt, def_port,
                    ports_loaded: true});
            });
        }
        render(){
            if (!this.state.ports_loaded)
                return <Loader show/>;
            return <Component {...this.props}
              port_select={this.port_select}
              def_port={this.state.def_port}
              ports={this.state.ports}
              ports_opt={this.state.ports_opt}
            />;
        }
    }
    return With_proxy_ports;
};

export const with_www_api = Component=>{
    class With_www_api extends Pure_component {
        state = {};
        componentDidMount(){
            this.setdb_on('head.defaults', defaults=>{
                if (defaults)
                    this.setState({www_api: defaults.www_api});
            });
        }
        render(){
            let www_api = 'https://luminati.io';
            if (this.state.www_api)
                www_api = this.state.www_api;
            return React.createElement(Component,
                {...this.props, www_api});
        }
    }
    return With_www_api;
};

export const Form_controller = props=>{
    const type = props.type;
    if (type=='select')
        return <Select {...props}/>;
    else if (type=='typeahead')
        return <Typeahead_wrapper {...props}/>;
    else if (type=='textarea')
        return <Textarea {...props}/>;
    else if (type=='json')
        return <Json {...props}/>;
    else if (type=='url')
        return <Url_input {...props}/>;
    else if (type=='regex')
        return <Regex {...props}/>;
    else if (type=='regex_text')
        return <Regex {...props} no_tip_box={true}/>;
    else if (type=='yes_no')
        return <Yes_no {...props}/>;
    else if (type=='select_number')
        return <Select_number {...props}/>;
    else if (type=='select_status')
        return <Select_status {...props}/>;
    else if (type=='pins')
        return <Pins {...props}/>;
    return <Input {...props}/>;
};

export const Copy_btn = with_tt(['Copy to clipboard', 'Copy', 'Copied!'],
class Copy_btn extends Pure_component {
    textarea = React.createRef();
    btn = React.createRef();
    refreshTooltip(){
        $(this.btn.current)
        .attr('title', this.props.t['Copy to clipboard']).tooltip('fixTitle');
    }
    componentDidMount(){ this.refreshTooltip(); }
    componentDidUpdate(){ this.refreshTooltip(); }
    copy = ()=>{
        const {t} = this.props;
        const txt = this.textarea.current;
        const area = $(txt)[0];
        area.value = this.props.val;
        area.select();
        try {
            document.execCommand('copy');
            $(this.btn.current).attr('title', t['Copied!'])
            .tooltip('fixTitle')
            .tooltip('show').attr('title', t['Copy to clipboard'])
            .tooltip('fixTitle');
        } catch(e){
            this.etask(function*(){
                yield report_exception(e, 'common.Copy_btn.copy');
            });
        }
    };
    render(){
        return <div className="copy_btn" style={this.props.style}>
          <button onClick={this.copy}
            data-container="body"
            style={this.props.inner_style}
            ref={this.btn}
            className="btn btn_lpm btn_lpm_small btn_copy">
            <T>{this.props.title||'Copy'}</T>
          </button>
          <textarea ref={this.textarea}
            style={{position: 'fixed', top: '-1000px'}}/>
        </div>;
    }
});

export class Cm_wrapper extends Pure_component {
    componentDidMount(){
        const opt = {mode: 'javascript'};
        if (this.props.readonly)
            opt.readOnly = 'nocursor';
        this.cm = codemirror.fromTextArea(this.textarea, opt);
        this.cm.on('change', this.on_cm_change);
        this.cm.setSize('100%', '100%');
        this.cm.doc.setValue(this.props.val||'');
    }
    componentDidUpdate(prev_props){
        if (prev_props.val!=this.props.val &&
            this.cm.doc.getValue()!=this.props.val)
        {
            this.cm.doc.setValue(this.props.val||'');
        }
    }
    on_cm_change = cm=>{
        const new_val = cm.doc.getValue();
        if (new_val==this.props.val)
            return;
        this.props.on_change(new_val);
    };
    set_ref = ref=>{ this.textarea = ref; };
    render(){
        return <div className="code_mirror_wrapper">
          <Copy_btn val={this.props.val}/>
          <textarea ref={this.set_ref}/>
        </div>;
    }
}

export const Note = props=>
    <div className="note">
      <span>{props.children}</span>
    </div>;

export const Field_row_raw = ({disabled, note, animated, ...props})=>{
    const classes = classnames('field_row', {disabled, note});
    const inner_classes = classnames('field_row_inner', props.inner_class_name,
        {animated});
    return <div className="field_row_wrapper">
      <div className={classes}>
        <div className={inner_classes} style={props.inner_style}>
          {props.children}
        </div>
      </div>
    </div>;
};

export const Labeled_controller = props=>
    <Field_row_raw disabled={props.disabled} note={props.note}
      animated={props.animated} inner_style={props.field_row_inner_style}>
      <T>{t=><React.Fragment>
        <div className="desc" style={props.desc_style}>
          <Tooltip title={t(props.tooltip)}>{t(props.label)}</Tooltip>
        </div>
        <div>
          <div className="field" data-tip data-for={props.id+'tip'}>
            {props.children ||
              <Form_controller disabled={props.disabled} {...props}/>
            }
            {props.sufix && <span className="sufix">{t(props.sufix)}</span>}
            {props.field_tooltip &&
              <React_tooltip id={props.id+'tip'} type="light" effect="solid"
                delayHide={30} delayUpdate={300} place="right">
                {t(props.field_tooltip)}
              </React_tooltip>
            }
          </div>
          {props.note && <Note>{t(props.note)}</Note>}
        </div>
      </React.Fragment>}</T>
    </Field_row_raw>;

export const Checkbox = props=>
  <div className="form-check">
    <label className="form-check-label">
      <input className="form-check-input"
        type="checkbox"
        value={props.value}
        onChange={props.on_change}
        onClick={props.on_click}
        checked={props.checked}
        readOnly={props.readonly}
      />
        {props.text}
    </label>
  </div>;

export const Nav = ({title, subtitle, warning})=>
    <div className="nav_header">
      <h3><T>{title}</T></h3>
      <div className="subtitle"><T>{subtitle}</T></div>
      <Warning_msg warning={warning}/>
    </div>;

const Warning_msg = ({warning})=>{
    if (!warning)
        return null;
    return <Warning text={warning}/>;
};

export const Link_icon = props=>{
    let {tooltip, on_click, id, classes, disabled, invisible, small, img} =
        props;
    if (invisible)
        tooltip = '';
    if (disabled||invisible)
        on_click = ()=>null;
    classes = classnames(classes, {small});
    const icon = img
        ? <div className="img_icon"
            style={{backgroundImage: `url(${img})`}}></div>
        : <i className={classnames('glyphicon', 'glyphicon-'+id)}/>;
    return <T>{t=><Tooltip title={t(tooltip)} key={id}>
      <span className={classnames('link', 'icon_link', classes)}
        onClick={on_click}>
        {icon}
      </span>
    </Tooltip>}</T>;
};

export const Add_icon = ({click, tooltip})=>
    <Tooltip title={tooltip}>
      <span className="link icon_link top right add_header" onClick={click}>
        <i className="glyphicon glyphicon-plus"/>
      </span>
    </Tooltip>;

export const Remove_icon = ({click, tooltip})=>
    <Tooltip title={tooltip}>
      <span className="link icon_link top" onClick={click}>
        <i className="glyphicon glyphicon-trash"/>
      </span>
    </Tooltip>;

export const Logo = with_www_api(class Logo extends Pure_component {
    state = {};
    componentDidMount(){
        this.setdb_on('head.version', ver=>this.setState({ver}));
    }
    render(){
        return <div className="nav_top">
          <a href={`${this.props.www_api}/cp`} rel="noopener noreferrer"
            target="_blank" className="logo_big"/>
          <div className="version">V{this.state.ver}</div>
          <div className="nav_top_right">
            <Language/>
          </div>
        </div>;
    }
});

export const any_flag = <T>{t=>
      <Tooltip title={t('Any')}>
        <span>
          <img src="/img/flag_any_country.svg" style={{height: 18}}/>
          <span className="lit" style={{marginLeft: 2}}>{t('Any')}</span>
        </span>
      </Tooltip>
    }</T>;

export const flag_with_title = (country, title)=>{
    return <Tooltip title={country.toUpperCase()}>
      <span>
        <span className={'flag-icon flag-icon-'+country}/>
        <span className="lit">{title}</span>
      </span>
    </Tooltip>;
};

export const Preset_description = ({preset, rule_clicked})=>{
    if (!preset)
        return null;
    const desc = presets.get(preset).subtitle.replace(/ +(?= )/g, '')
        .replace(/\n /g, '\n');
    return <div><div className="desc">{desc}</div></div>;
};

export const Ext_tooltip = with_www_api(props=>
    <div>
      This feature is only available when using{' '}
        <a className="link"
          target="_blank"
          rel="noopener noreferrer"
          href={`${props.www_api}/cp/zones`}>
            proxies by Luminati network
        </a>
    </div>);

export const debug = str=>{
    const d = new Date();
    console.debug('%d:%d:%d.%d: %s', d.getHours(), d.getMinutes(),
        d.getSeconds(), d.getMilliseconds(), str);
};

export const No_zones = with_www_api(class No_zones extends Pure_component {
    state = {};
    componentDidMount(){
        this.setdb_on('head.settings', settings=>{
            settings && this.setState({settings});
        });
    }
    render(){
        if (!this.state.settings)
            return null;
        const link_props = this.state.settings.zagent && window.parent ?
            {onClick: ()=>window.parent.postMessage('no_zones',
                this.props.www_api)} :
            {target: '_blank', rel: 'noopener noreferrer',
                href: `${this.props.www_api}/cp/zones`};
        return <div>
          <div className="no_zones">
            <T>No active zones found. You can activate them</T>{' '}
            <a className="link" {...link_props}><T>here</T></a>.
          </div>
        </div>;
    }
});

export const Toolbar_button = props=>
  <Tooltip title={props.tooltip}>
    <div className={classnames('cp_icon', props.id)}
      onClick={props.on_click}/>
  </Tooltip>;

