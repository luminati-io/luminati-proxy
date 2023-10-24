// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
/* eslint-disable react/display-name */
import React, {useState, useEffect, useMemo} from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import React_tooltip from 'react-tooltip';
import {Alert as RB_Alert} from 'react-bootstrap';
import classnames from 'classnames';
import codemirror from 'codemirror/lib/codemirror';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/lib/codemirror.css';
import $ from 'jquery';
import styled from 'styled-components';
import {
    Tooltip as UIKitTooltip,
    withPopover,
    IconButton,
    Menu,
    Icon,
    theme,
} from 'uikit';
import conv from '../../util/conv.js';
import date from '../../util/date.js';
import presets from './common/presets.js';
import {Pins, Select_status, Select_number, Yes_no, Regex, Json, Textarea,
    Typeahead_wrapper, Input, Select, Url_input, Select_number_new, Select_new,
    Url_input_new,
} from './common/controls.js';
import Tooltip from './common/tooltip.js';
import {T, t, Language} from './common/i18n.js';
import {bytes_format, report_exception} from './util.js';
import CP_ipc from './cp_ipc.js';

export const www_api = 'https://brightdata.com';
export const www_help = 'https://help.brightdata.com';
export const lpm_faq_article = '12632549957649';

export const Inline_wrapper = styled.div`
    display: flex;
    align-items: center;
    column-gap: 5px;
`;
Inline_wrapper.displayName = 'Inline_wrapper';

export const Column_wrapper = styled.div`
    display: flex;
    flex-direction: column;
    flex-wrap: wrap;
`;
Column_wrapper.displayName = 'Column_wrapper';

const uikit_from_theme = (pname, default_value)=>props=>{
        let value = props[pname]||default_value;
        if (value!=null)
        {
            if (pname.indexOf('padding')==0||pname.indexOf('margin')==0)
                return theme.spacing[value]||value;
            if (['font_weight', 'font_size', 'line_height', 'letter_spacing',
                'color', 'box_shadow'].includes(pname))
            {
                return theme[pname][value];
            }
        }
        return value;
};

export const Vertical_divider = styled.div`
    width: 2px;
    height: ${p=>p.height||'100%'};
    background-color: ${theme.color.gray_5};
    margin-top: ${uikit_from_theme('margin_top', '00')};
    margin-bottom: ${uikit_from_theme('margin_bottom', '00')};
    margin-left: ${uikit_from_theme('margin_left', '04')};
    margin-right: ${uikit_from_theme('margin_right', '04')};
    margin: ${uikit_from_theme('margin')};
`;
Vertical_divider.displayName = 'Vertical_divider';

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
    return <UIKitTooltip tooltip={bytes ? tooltip : ''}>
      <div className="disp_value">
        {display_cost||bytes_format(bytes)||'—'}
      </div>
    </UIKitTooltip>;
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
        return <UIKitTooltip className="wide"
          title={this.props.tooltip}
          placement="bottom">
          <div className="warning">
            <Icon
              size="lg"
              color="gray_10"
              name="AttentionCircle"
              className="padding_right_10"
            />
            <div className="hbox">{content}</div>
            {this.props.id &&
              <IconButton
                aria-label="Warning dismiss"
                icon="ChevronUp"
                onClick={this.dismiss}
                tooltip="Dismiss"
                variant="ghost"
                className="transparent"
              />
            }
          </div>
        </UIKitTooltip>;
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
export class Code extends Pure_component {
    componentDidMount(){
        $(this.ref).find('.btn_copy').tooltip('show')
        .attr('title', t('Copy to clipboard')).tooltip('fixTitle');
    }
    set_ref(e){ this.ref = e; }
    copy(){
        if (this.props.on_click)
            this.props.on_click();
        const area = $(this.ref).children('textarea')[0];
        const source = $(this.ref).children('.source')[0];
        area.value = source.innerText;
        area.select();
        try {
            document.execCommand('copy');
            $(this.ref).find('.btn_copy').attr('title', t('Copied!'))
            .tooltip('fixTitle')
            .tooltip('show').attr('title', t('Copy to clipboard'))
            .tooltip('fixTitle');
        } catch(e){
            this.etask(function*(){
                yield report_exception(e, 'common.Code.copy');
            });
        }
    }
    render(){
        return <code ref={this.set_ref.bind(this)}>
          <span className="source">{this.props.children}</span>
          <textarea style={{position: 'fixed', top: '-1000px'}}/>
          <button onClick={this.copy.bind(this)} data-container="body"
            className="btn btn_lpm btn_lpm_small btn_copy">
            {t('Copy')}
          </button>
        </code>;
    }
}

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
                {
                    this.setState({
                        www_api: defaults.www_api,
                        www_help: defaults.www_help
                    });
                }
            });
        }
        render(){
            let _www_api = this.state.www_api || www_api;
            let _www_help = this.state.www_help || www_help;
            return React.createElement(Component,
                {...this.props, www_api: _www_api, www_help: _www_help});
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

export const Form_controller_new = props=>{
    const type = props.type;
    if (type=='select')
        return <Select_new {...props}/>;
    else if (type=='typeahead')
        return <Typeahead_wrapper {...props}/>;
    else if (type=='textarea')
        return <Textarea {...props}/>;
    else if (type=='json')
        return <Json {...props}/>;
    else if (type=='url')
        return <Url_input_new {...props}/>;
    else if (type=='regex')
        return <Regex {...props}/>;
    else if (type=='regex_text')
        return <Regex {...props} no_tip_box={true}/>;
    else if (type=='yes_no')
        return <Yes_no {...props}/>;
    else if (type=='select_number')
        return <Select_number_new {...props}/>;
    else if (type=='select_status')
        return <Select_status {...props}/>;
    else if (type=='pins')
        return <Pins {...props}/>;
    return <Input {...props}/>;
};

export class Copy_btn extends Pure_component {
    textarea = React.createRef();
    btn = React.createRef();
    refreshTooltip(){
        $(this.btn.current)
        .attr('title', t('Copy to clipboard')).tooltip('fixTitle');
    }
    componentDidMount(){ this.refreshTooltip(); }
    componentDidUpdate(){ this.refreshTooltip(); }
    copy = ()=>{
        const txt = this.textarea.current;
        const area = $(txt)[0];
        area.value = this.props.val;
        area.select();
        try {
            document.execCommand('copy');
            $(this.btn.current).attr('title', t('Copied!'))
            .tooltip('fixTitle')
            .tooltip('show').attr('title', t('Copy to clipboard'))
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
}

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

export const Faq_link = with_www_api(props=>{
    const click = ()=>{
        const article = props.article || lpm_faq_article;
        const anchor = props.anchor ? `#${props.anchor}` : '';
        const url = `${props.www_help}/hc/en-us/articles/${article}${anchor}`;
        window.open(url, '_blank');
    };
    return <Tooltip title={t('Read more')}>
      <span
        onClick={click}
        className="glyphicon glyphicon-question-sign faq_link"/>
    </Tooltip>;
});

export const Faq_button = with_www_api(props=>{
    const art = props.article || lpm_faq_article;
    const anc = props.anchor ? `#${props.anchor}` : '';
    const url = `${props.www_help}/hc/en-us/articles/${art}${anc}`;
    return <IconButton
        aria-label="Icon Button"
        icon="Info"
        as="a"
        href={url}
        size="sm"
        target="_blank"
        tooltip="Read more"
        variant="icon"
    />;
});

export const Note = props=>
    <div className="note">
      <span>{props.children}</span>
    </div>;

export const Field_row_raw = ({disabled, animated, ...props})=>{
    const classes = classnames('field_row', {disabled});
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

export const Field_col_raw = ({disabled, animated, ...props})=>{
    const classes = classnames('field_col', {disabled});
    const inner_classes = classnames('field_col_inner', props.inner_class_name,
        {animated});
    return <div className="field_col_wrapper">
      <div className={classes}>
        <div className={inner_classes} style={props.inner_style}>
          {props.children}
        </div>
      </div>
    </div>;
};

export const Labeled_controller = props=>
    <Field_row_raw
      disabled={props.disabled}
      animated={props.animated}
      inner_style={props.field_row_inner_style}>
        <div className="desc" style={props.desc_style}>
          <Tooltip title={t(props.tooltip)}>{t(props.label)}</Tooltip>
          {props.faq && <Faq_link article={props.faq.article}
                anchor={props.faq.anchor}/>}
        </div>
        <div>
          <div className="field" data-tip data-for={props.id+'tip'}>
            {props.prefix && <span className="prefix">{t(props.prefix)}</span>}
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
    </Field_row_raw>;

export const Labeled_controller_new = props=>
    <Field_col_raw
      disabled={props.disabled}
      animated={props.animated}
      inner_style={props.field_row_inner_style}>
        <div className="desc" style={props.desc_style}>
          <UIKitTooltip tooltip={t(props.tooltip)}>
            {t(props.label)}
          </UIKitTooltip>
          {props.faq && <Faq_link article={props.faq.article}
                anchor={props.faq.anchor}/>}
        </div>
        <div>
          <div className="field" data-tip data-for={props.id+'tip'}>
            {props.prefix && <span className="prefix">{t(props.prefix)}</span>}
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
    </Field_col_raw>;

export const Checkbox = props=>
  <div className="form-check">
    <label className="form-check-label">
      <input
        type="checkbox"
        className={props.className ? 'form-check-input '+props.className :
          'form-check-input'}
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
    return <Tooltip title={t(tooltip)} key={id}>
      <span className={classnames('link', 'icon_link', classes)}
        onClick={on_click}>
        {icon}
      </span>
    </Tooltip>;
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

export const Icon_text = ({
    fi,
    name,
    color,
    size,
    verticalAlign,
    text
})=>
    <Inline_wrapper>
        {fi ? <span className={'fi fi-'+fi}/>
            : <Icon
                color={color}
                name={name}
                size={size}
                verticalAlign={verticalAlign}
            />
        }
        <T>{text}</T>
    </Inline_wrapper>;

export const Icon_check = ()=><Icon name="Check" color="green_11" />;

export const Icon_close = ()=><Icon name="Close" color="gray_9" />;

export const any_flag = ()=>
    <UIKitTooltip tooltip={t('Any')}>
        <Icon_text name="Globe" text="Any" color="gray_10" size="sm"/>
    </UIKitTooltip>;

export const flag_with_title = (country, title, tooltip)=>
    <UIKitTooltip tooltip={tooltip||country.toUpperCase()}>
        <Icon_text fi={country} text={title} />
    </UIKitTooltip>;

export const Preset_description = ({preset, rule_clicked})=>{
    if (!preset)
        return null;
    const desc = presets.get(preset).subtitle.replace(/ +(?= )/g, '')
        .replace(/\n /g, '\n');
    return <div><div className="desc"><T>{desc}</T></div></div>;
};

export const Ext_tooltip = with_www_api(props=>
    <div>
      This feature is only available when using{' '}
        <a className="link"
          target="_blank"
          rel="noopener noreferrer"
          href={`${props.www_api}/cp/zones`}>
            proxies by Bright Data network
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
            {onClick: ()=>CP_ipc.post('no_zones')} :
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
    <UIKitTooltip tooltip={props.tooltip}>
        <div className={classnames('cp_icon', props.id)}
            onClick={props.on_click}/>
    </UIKitTooltip>;

export const Alert = props=>{
    const [close_tm, set_close_tm] = useState(null);
    useEffect(()=>{
        const tm = setTimeout(()=>props.on_close(),
            props.duration||10*date.ms.SEC);
        set_close_tm(tm);
        return ()=>{ clearTimeout(tm); };
    }, []);
    return <div className="alert_wrapper">
      <RB_Alert
        className="alert_wrapper"
        variant={props.variant}
        dismissible={props.dismissible}
        transition={false}
        closeLabel="Close"
        onClose={()=>{ clearTimeout(close_tm); props.on_close(); }}>
        {props.heading && <RB_Alert.Heading>{props.heading}</RB_Alert.Heading>}
        {props.text && <div>{props.text}</div>}
      </RB_Alert>
    </div>;
};

const Context_menu_button = props=>{
    const {popover, tooltip} = props;
    return <IconButton icon="DotsVertical" variant="icon" tooltip={tooltip}
      onClick={e=>{
        popover.toggle(e);
        e.stopPropagation();
    }} />;
};

const Context_menu_pop = props=>{
    const {items, popover} = props;
    const hide_on_click = cb=>(...args)=>{
        cb(...args);
        popover.hide();
    };
    const _items = items.map(i=>{
        if (i.onClick)
        {
            return Object.assign({}, i,
                {onClick: hide_on_click(i.onClick)});
        }
        return i;
    });
    return <Menu items={_items}/>;
};

const Context_menu_comp = withPopover(Context_menu_button, Context_menu_pop,
    {wrapperClassName: 'context-menu-wrapper'});

export const Context_menu = props=>{
    const {items, tooltip} = props;
    const popoverProps = useMemo(()=>({items, tooltip}), [items, tooltip]);
    return <Context_menu_comp popoverProps={popoverProps}/>;
};
