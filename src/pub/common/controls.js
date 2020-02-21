// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import React_select from 'react-select/creatable';
import React_tooltip from 'react-tooltip';
import {withRouter} from 'react-router-dom';
import classnames from 'classnames';
import {Netmask} from 'netmask';
import {Typeahead} from 'react-bootstrap-typeahead';
import codemirror from 'codemirror/lib/codemirror';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/lib/codemirror.css';
import setdb from '../../../util/setdb.js';
import ajax from '../../../util/ajax.js';
import zurl from '../../../util/url.js';
import Tooltip from './tooltip.js';
import {T} from './i18n.js';
import {Ext_tooltip, Loader} from '../common.js';
import Zone_description from './zone_desc.js';
import {Modal_dialog} from './modals.js';
const ANY_IP = '0.0.0.0/0';

export class Pins extends Pure_component {
    state = {
        pins: [],
        max_id: 0,
        modal_open: false,
        pending: this.props.pending||[],
        disabled: false,
    };
    static getDerivedStateFromProps(props, state){
        if (state.disabled==props.disabled &&
            (props.val==state.raw_val||!props.val))
        {
            return null;
        }
        const ips = props.val||[];
        const disabled_ips = props.disabled_ips||[];
        const pins = ips.map((p, id)=>({
            id,
            val: p,
            edit: false,
            disabled: props.disabled || !!disabled_ips.find(i=>i==p),
        }));
        if (!props.disabled)
        {
            const edited_pin = state.pins.find(p=>p.edit);
            if (edited_pin)
                pins.push(edited_pin);
        }
        return {
            raw_val: props.val,
            pins,
            max_id: ips.length,
            disabled: props.disabled,
        };
    }
    add_pin = (pin='')=>{
        this.setState(prev=>({
            pins: [...prev.pins, {id: prev.max_id+1, val: pin, edit: true}],
            max_id: prev.max_id+1,
        }));
        if (pin && this.state.pending.includes(pin))
            this.setState({pending: this.state.pending.filter(p=>p!=pin)});
    };
    add_empty_pin = ()=>{
        this.add_pin();
    };
    remove = id=>{
        this.setState(prev=>({
            pins: prev.pins.filter(p=>p.id!=id),
        }), this.fire_on_change);
    };
    set_edit = (id, edit)=>{
        this.setState(prev=>({
            pins: prev.pins.map(p=>{
                if (p.id!=id)
                    return p;
                return {...p, edit};
            }),
        }));
    };
    update_pin = (id, val)=>{
        this.setState(prev=>({
            pins: prev.pins.map(p=>{
                if (p.id!=id)
                    return p;
                return {...p, val};
            }),
        }));
    };
    fire_on_change = ()=>{
        const val = this.state.pins.map(p=>p.val);
        this.props.on_change_wrapper(val);
    };
    save_pin = (id, val)=>{
        if (this.state.pins.find(p=>p.id!=id && p.val==val))
            return this.remove(id);
        this.setState(prev=>({
            pins: prev.pins.map(p=>{
                if (p.id!=id)
                    return p;
                return {...p, val, edit: false};
            }),
        }), this.fire_on_change);
    };
    dismiss_modal = ()=>this.setState({modal_open: false});
    open_modal = ()=>this.setState({modal_open: true});
    render(){
        const {pending, disabled, pins} = this.state;
        const pending_btn_title = `Add recent IPs (${pending.length})`;
        const has_any = pins.find(p=>p.val==ANY_IP);
        return <div className="pins_field">
              <div className="pins">
                {pins.map(p=>
                  <Pin key={p.id} update_pin={this.update_pin} id={p.id}
                    set_edit={this.set_edit} edit={p.edit}
                    exact={this.props.exact} save_pin={this.save_pin}
                    show_any={!this.props.no_any && !has_any}
                    remove={this.remove} disabled={p.disabled}>
                    {p.val}
                  </Pin>
                )}
              </div>
              <T>{t=><Pin_btn title={t('Add IP')}
                tooltip={t('Add new IP to the list')}
                on_click={this.add_empty_pin} disabled={disabled}/>}</T>
              {!!pending.length && !disabled &&
                <Pin_btn on_click={this.open_modal} title={pending_btn_title}/>
              }
              <Modal_dialog title="Add recent IPs"
                open={this.state.modal_open}
                ok_clicked={this.dismiss_modal} no_cancel_btn>
                {pending.map(ip=>
                  <Add_pending_btn key={ip} ip={ip}
                    add_pin={this.add_pin}/>
                )}
                {!pending.length &&
                  <span>No more pending IPs to whitelist</span>
                }
              </Modal_dialog>
            </div>;
    }
}

const Add_pending_btn = ({ip, add_pin})=>
    <div>
      <span style={{marginRight: 10}}>{ip}</span>
      <Pin_btn title="Add IP" on_click={()=>add_pin(ip)}/>
    </div>;

class Pin extends Pure_component {
    input = React.createRef();
    componentDidMount(){
        this.input.current.focus();
    }
    componentDidUpdate(){
        if (this.props.edit)
            this.input.current.focus();
    }
    edit = ()=>{
        if (!this.props.disabled)
            this.props.set_edit(this.props.id, true);
    };
    key_up = e=>{
        if (e.keyCode==13)
            this.validate_and_save();
    };
    validate_and_save = ()=>{
        let val = (this.props.children||'').trim();
        if (this.props.exact && val)
            return this.props.save_pin(this.props.id, val);
        try {
            const netmask = new Netmask(val);
            val = netmask.base;
            if (netmask.bitmask!=32)
                val += '/'+netmask.bitmask;
        } catch(e){ val = ''; }
        if (!val)
            return this.props.remove(this.props.id);
        this.props.save_pin(this.props.id, val);
    };
    on_change = e=>this.props.update_pin(this.props.id, e.target.value);
    on_any_click = ()=>{
        this.props.update_pin(this.props.id, ANY_IP);
        this.setState({children: ANY_IP}, this.validate_and_save);
    };
    remove = ()=>this.props.remove(this.props.id);
    on_blur = e=>{
        const target = e.relatedTarget;
        const any_click = target && target.classList.contains('any');
        if (!any_click)
            this.validate_and_save();
    };
    get_label = ip=>ip==ANY_IP ? 'any' : ip;
    render(){
        const {children, edit, disabled, show_any} = this.props;
        const input_classes = classnames({hidden: !edit});
        return <div className={classnames('pin', {active: edit, disabled})}
            onBlur={this.on_blur}>
              {!disabled &&
                <div className="x" onClick={this.remove}>
                <div className="glyphicon glyphicon-remove"/>
              </div>}
              <div className="content" onClick={this.edit}>
                {!edit && this.get_label(children)}
                <input ref={this.input} type="text" value={children}
                  onChange={this.on_change} className={input_classes}
                  onKeyUp={this.key_up}/>
              </div>
              {edit && show_any &&
                <button className="any" onClick={this.on_any_click}>
                    <T>any</T>
                </button>
              }
              {edit &&
                <div className="v">
                  <div className="glyphicon glyphicon-ok"/>
                </div>
              }
            </div>;
    }
}

export const Pin_btn = ({on_click, title, tooltip, disabled})=>
    <Tooltip title={tooltip}>
      <button className="btn btn_lpm btn_lpm_small add_pin"
        onClick={on_click} disabled={disabled}>
        {title}
        <i className="glyphicon glyphicon-plus"/>
      </button>
    </Tooltip>;

export class Select_status extends Pure_component {
    status_types = ['200', '2..', '403', '404', '500', '503', '(4|5)..'];
    value_to_option = (t, value)=>{
        if (!value)
            return {value: '', label: t('--Select--')};
        return {value, label: value};
    };
    on_change = e=>this.props.on_change_wrapper(e && e.value || '');
    render(){
        return <T>{t=><Select_multiple {...this.props}
              class_name="status"
              options={this.status_types.map(v=>this.value_to_option(t, v))}
              on_change={this.on_change}
              validation={v=>!!v}
              value_to_option={this.value_to_option.bind(this, t)}/>}</T>;
    }
}

export class Select_number extends Pure_component {
    _fmt_num = n=>n && n.toLocaleString({useGrouping: true}) || n;
    _get_data = ()=>this.props.data ? this.props.data : this.opt_from_range();
    value_to_option = value=>{
        if (value==null)
            return false;
        const label = value==0 ? <T>Disabled</T> : this._fmt_num(+value);
        return {value, label};
    };
    opt_from_range = ()=>{
        let res;
        if (this.props.range=='medium')
            res = [0, 1, 10, 100, 1000];
        else if (this.props.range=='ms')
            res = [0, 500, 2000, 5000, 10000];
        else
            res = [0, 1, 3, 5, 10, 20];
        return res;
    };
    on_change = e=>{
        let value = e && +e.value || '';
        const allow_zero = this._get_data().includes(0);
        if (!value && !allow_zero)
            value = this.props.default||1;
        this.props.on_change_wrapper(value);
    };
    validation = s=>!!s && Number(s)==s;
    render(){
        const data = this._get_data();
        const options = data.map(this.value_to_option);
        return <Select_multiple {...this.props}
              options={options}
              on_change={this.on_change}
              validation={this.validation}
              value_to_option={this.value_to_option}
              no_options_message={()=>'You can use only numbers here'}/>;
    }
}

class Select_multiple extends Pure_component {
    styles = {
        clearIndicator: base=>({
            ...base,
            padding: '1px',
        }),
        dropdownIndicator: base=>({
            ...base,
            padding: '1px',
        }),
        option: (base, state)=>({
            ...base,
            padding: '2px 12px',
            backgroundColor: state.isFocused ? '#f5f5f5' : 'white',
            color: '#004d74',
        }),
        control: (_, state)=>({
            alignItems: 'center',
            display: 'flex',
            height: 32,
            borderRadius: 3,
            border: 'solid 1px',
            borderColor: state.isFocused ? '#004d74' :
                state.isDisabled ? '#e0e9ee' : '#ccdbe3',
            backgroundColor: state.isDisabled ? '#f5f5f5;' : 'white',
        }),
        singleValue: (base, state)=>({
            ...base,
            color: state.isDisabled ? '#8e8e8e' : '#004d74',
        }),
    };
    render(){
        return <React_select styles={this.styles}
            className={classnames('select_multiple', this.props.class_name)}
            isClearable
            noOptionsMessage={this.props.no_options_message}
            classNamePrefix="react_select"
            value={this.props.value_to_option(this.props.val)}
            onChange={this.props.on_change}
            options={this.props.options}
            isValidNewOption={this.props.validation}
            pageSize={9}
            placeholder={this.props.placeholder}
            blurInputOnSelect={true}
            isDisabled={this.props.disabled}/>;
    }
}

export class Yes_no extends Pure_component {
    options = t=>{
        const default_label = this.props.default ? 'Yes' : 'No';
        return [
            {key: 'No', value: false},
            {key: t('Default')+' ('+t(default_label)+')', value: ''},
            {key: 'Yes', value: true},
        ];
    };
    render(){
        return <T>{t=><Select {...this.props} data={this.options(t)}/>}</T>;
    }
}

export class Regex extends Pure_component {
    state = {recognized: false, checked: {}, invalid_regexp: undefined};
    formats = ['png', 'jpg', 'jpeg', 'svg', 'gif', 'mp3', 'mp4', 'avi'];
    componentDidMount(){
        this.recognize_regexp();
    }
    componentDidUpdate(prev_props){
        if (prev_props.val!=this.props.val)
            this.recognize_regexp();
    }
    classes = f=>{
        const active = this.state.recognized && this.state.checked[f];
        return classnames('check', {active});
    };
    toggle = f=>{
        this.setState(
            prev=>({checked: {...prev.checked, [f]: !prev.checked[f]}}),
            this.gen_regexp);
    };
    recognize_regexp = ()=>{
        const m = this.props.val && this.props.val.match(/\\\.\((.+)\)\$/);
        if (m&&m[1])
        {
            const checked = m[1].split('|').reduce(
                (acc, e)=>({...acc, [e]: true}), {});
            this.setState({recognized: true, checked});
        }
        else
            this.setState({recognized: false, checked: {}});
    };
    gen_regexp = ()=>{
        const formats = Object.keys(this.state.checked)
        .filter(f=>this.state.checked[f]).join('|');
        let regexp = '';
        if (formats)
            regexp = `\\.(${formats})$`;
        this.props.on_change_wrapper(regexp, this.props.id);
    };
    tip = f=>{
        if (this.state.checked[f])
            return `Remove file format ${f} from regexp`;
        return `Add file format ${f} to regexp`;
    };
    check_regexp = regexp=>{
        try {
            new RegExp(regexp);
            return true;
        } catch(e){ return false; }
    };
    on_input_change = regexp=>{
        const is_regexp_valid = this.check_regexp(regexp);
        this.setState({invalid_regexp: !is_regexp_valid ? regexp : undefined});
        if (is_regexp_valid)
            this.props.on_change_wrapper(regexp, this.props.id);
    };
    render(){
        const val = this.props.val||'';
        return <div className="regex_field">
              <div className="regex_input">
                {!this.props.no_tip_box && <div className="tip_box active">
                  <div className="checks">
                    {this.formats.map(f=>
                      <Tooltip key={f+!!this.state.checked[f]}
                        title={this.tip(f)}>
                        <button onClick={this.toggle.bind(null, f)}
                          className={this.classes(f)}
                          disabled={this.props.disabled||
                              !!this.state.invalid_regexp}>.{f}</button>
                      </Tooltip>
                    )}
                  </div>
                </div>}
                <Input className="regex" {...this.props}
                  val={this.state.invalid_regexp||val} type="text"
                  on_change_wrapper={this.on_input_change}/>
                <span className={classnames('regex_error',
                    {active: this.state.invalid_regexp})}>Invalid regex</span>
              </div>
            </div>;
    }
}

export class Json extends Pure_component {
    state = {};
    componentDidMount(){
        this.cm = codemirror.fromTextArea(this.textarea, {mode: 'javascript'});
        this.cm.on('change', this.on_cm_change);
        this.cm.setSize('auto', '100%');
        this.cm.doc.setValue(this.props.val);
    }
    on_cm_change = cm=>{
        const new_val = cm.doc.getValue();
        let correct = true;
        try { JSON.parse(new_val); }
        catch(e){ correct = false; }
        if (correct)
            this.props.on_change_wrapper(new_val);
        this.setState({correct});
    };
    set_ref = ref=>{ this.textarea = ref; };
    render(){
        const classes = classnames('code_mirror_wrapper', 'json',
            {error: !this.state.correct});
        return <Tooltip title={this.props.tooltip}>
          <div className={classes}>
            <textarea ref={this.set_ref}/>
          </div>
        </Tooltip>;
    }
}

export class Url_input extends Pure_component {
    constructor(props){
        super(props);
        this.state = {url: props.val, valid: true};
    }
    on_url_change = (url, id)=>{
        const valid = zurl.is_valid_url(url);
        if (valid)
            this.props.on_change_wrapper(url, id);
        this.setState({url, valid});
    };
    render(){
        const input_props = Object.assign({}, this.props, {
            val: this.state.url,
            on_change_wrapper: this.on_url_change,
            className: classnames({error: !this.state.valid}),
        });
        return <Input {...input_props}/>;
    }
}

export const Textarea = props=>{
    return <textarea value={props.val} rows={props.rows||3}
          placeholder={props.placeholder}
          onChange={e=>props.on_change_wrapper(e.target.value)}/>;
};

export const Typeahead_wrapper = props=>
    <Typeahead id={props.id} options={props.data} maxResults={10}
      minLength={1} disabled={props.disabled} selectHintOnEnter
      onChange={props.on_change_wrapper} selected={props.val}
      onInputChange={props.on_input_change} filterBy={props.filter_by}/>;

export const Select = props=>{
    const update = val=>{
        if (val=='true')
            val = true;
        else if (val=='false')
            val = false;
        if (props.on_change_wrapper)
            props.on_change_wrapper(val);
    };
    const conf = (props.data||[]).find(c=>c.value==props.val);
    return <Tooltip key={props.val} title={conf&&conf.tooltip||''}>
          <T>{t=><select value={''+props.val}
            onChange={e=>update(e.target.value)} disabled={props.disabled}>
            {(props.data||[]).map((c, i)=>
              <option key={i} value={c.value||c}>{t(c.key||c)}</option>
            )}
          </select>}</T>
        </Tooltip>;
};

export const Input = props=>{
    const update = val=>{
        if (props.type=='number' && val)
            val = Number(val);
        if (props.on_change_wrapper)
            props.on_change_wrapper(val, props.id);
    };
    return <T>{t=><input style={props.style}
          type={props.type}
          value={props.val}
          disabled={props.disabled}
          onChange={e=>update(e.target.value)}
          className={props.className}
          placeholder={t(props.placeholder)}
          onBlur={props.on_blur}
          onKeyUp={props.on_key_up}/>}</T>;
};

export const Select_zone = withRouter(
class Select_zone extends Pure_component {
    state = {refreshing_zones: false, zones: {zones: []}};
    componentDidMount(){
        this.setdb_on('head.zones', zones=>{
            if (zones)
                this.setState({zones});
        });
    }
    refresh_zones = ()=>{
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', ()=>{
                _this.setState({refreshing_zones: false});
            });
            _this.setState({refreshing_zones: true});
            const result = yield window.fetch('/api/refresh_zones',
                {method: 'POST'});
            if (result.status!=200)
                return _this.props.history.push({pathname: '/login'});
            const zones = yield ajax.json({url: '/api/zones'});
            _this.setState({refreshing_zones: false});
            setdb.set('head.zones', zones);
        });
    };
    render(){
        const {val, on_change_wrapper, disabled, preview} = this.props;
        const tooltip = preview ? '' : this.props.tooltip;
        const zone_opt = this.state.zones.zones.map(z=>{
            if (z.name==this.state.zones.def)
                return {key: `Default (${z.name})`, value: z.name};
            return {key: z.name, value: z.name};
        });
        const selected = val || this.state.zones.def;
        return <div className="select_zone">
              <Tooltip title={tooltip}>
                <span data-tip data-for="zone-tip">
                  {preview &&
                    <React_tooltip id="zone-tip" type="light" effect="solid"
                      place="bottom" delayHide={0} delayUpdate={300}>
                      {disabled ? <Ext_tooltip/> :
                        <div className="zone_tooltip">
                          <Zone_description zone_name={selected}/>
                        </div>
                      }
                    </React_tooltip>
                  }
                  <Select val={selected} type="select"
                    on_change_wrapper={on_change_wrapper} label="Default zone"
                    tooltip={tooltip} data={zone_opt} disabled={disabled}/>
                </span>
              </Tooltip>
              <T>{t=><Tooltip title={t('Refresh zones')}>
                <div className="chrome_icon refresh"
                  onClick={this.refresh_zones}/>
              </Tooltip>}</T>
              <Loader show={this.state.refreshing_zones}/>
            </div>;
    }
});
