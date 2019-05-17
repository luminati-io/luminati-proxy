// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import React_select from 'react-select/lib/Creatable';
import classnames from 'classnames';
import {Netmask} from 'netmask';
import {Typeahead} from 'react-bootstrap-typeahead';
import codemirror from 'codemirror/lib/codemirror';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/lib/codemirror.css';
import Tooltip from './tooltip.js';
import {T} from './i18n.js';

export class Pins extends Pure_component {
    state = {pins: [], max_id: 0};
    static getDerivedStateFromProps(props, state){
        if (props.val==state.raw_val||!props.val)
            return null;
        const ips = props.val.split(',');
        return {
            raw_val: props.val,
            pins: ips.map((p, id)=>({id, val: p, edit: false})),
            max_id: ips.length,
        };
    }
    add_pin = ()=>{
        this.setState(prev=>({
            pins: [...prev.pins, {id: prev.max_id+1, val: '', edit: true}],
            max_id: prev.max_id+1,
        }));
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
        const val = this.state.pins.map(p=>p.val).join(',');
        this.props.on_change_wrapper(val);
    };
    save_pin = (id, val)=>{
        this.setState(prev=>({
            pins: prev.pins.map(p=>{
                if (p.id!=id)
                    return p;
                return {...p, val, edit: false};
            }),
        }), this.fire_on_change);
    };
    render(){
        return <div className="pins_field">
              <div className="pins">
                {this.state.pins.map(p=>
                  <Pin key={p.id} update_pin={this.update_pin} id={p.id}
                    set_edit={this.set_edit} edit={p.edit}
                    exact={this.props.exact} save_pin={this.save_pin}
                    remove={this.remove}>
                    {p.val}
                  </Pin>
                )}
              </div>
              <Add_pin add_pin={this.add_pin}/>
            </div>;
    }
}

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
        this.props.set_edit(this.props.id, true);
    };
    key_up = e=>{
        if (e.keyCode==13)
            this.validate_and_save();
    };
    validate_and_save = ()=>{
        let val = (this.props.children||'').trim();
        if (this.props.exact)
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
    remove = ()=>this.props.remove(this.props.id);
    on_blur = ()=>this.validate_and_save();
    render(){
        const {children} = this.props;
        const input_classes = classnames({hidden: !this.props.edit});
        return <div className={classnames('pin', {active: this.props.edit})}>
              <div className="x" onClick={this.remove}>
                <div className="glyphicon glyphicon-remove"/>
              </div>
              <div className="content" onClick={this.edit}>
                {!this.props.edit && children}
                <input ref={this.input} type="text" value={children}
                  onChange={this.on_change} onBlur={this.on_blur}
                  className={input_classes} onKeyUp={this.key_up}/>
              </div>
              {this.props.edit &&
                <div className="v">
                  <div className="glyphicon glyphicon-ok"/>
                </div>
              }
            </div>;
    }
}

const Add_pin = ({add_pin})=>
    <Tooltip title="Add new IP to the list">
      <button className="btn btn_lpm btn_lpm_small add_pin"
        onClick={add_pin}>
        <T>Add IP</T>
        <i className="glyphicon glyphicon-plus"/>
      </button>
    </Tooltip>;

export class Select_status extends Pure_component {
    status_types = ['200', '2..', '403', '404', '500', '503', '(4|5)..'];
    value_to_option = value=>{
        if (!value)
            return {value: '', label: '--Select--'};
        return {value, label: value};
    };
    on_change = e=>this.props.on_change_wrapper(e && e.value || '');
    render(){
        const options = this.status_types.map(this.value_to_option);
        return <Select_multiple {...this.props}
              class_name="status"
              options={options}
              on_change={this.on_change}
              validation={v=>!!v}
              value_to_option={this.value_to_option}/>;
    }
}

export class Select_number extends Pure_component {
    _fmt_num = n=>n && n.toLocaleString({useGrouping: true}) || n;
    _get_data = ()=>this.props.data ? this.props.data : this.opt_from_range();
    value_to_option = value=>{
        if (value==null)
            return false;
        const label = value==0 ? 'Disabled' : this._fmt_num(+value);
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
        option: (base, state)=>{
            return {
                ...base,
                padding: '2px 12px',
                'background-color': state.isFocused ? '#f5f5f5' : 'white',
                color: '#004d74',
            };
        },
        control: (base, state)=>{
            return {
                display: 'flex',
                height: 32,
                'border-radius': 3,
                border: 'solid 1px',
                'border-color': state.isFocused ? '#004d74' :
                    state.isDisabled ? '#e0e9ee' : '#ccdbe3',
                'background-color': state.isDisabled ? '#f5f5f5;' : 'white',
            };
        },
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
            simpleValue
            autoBlur
            options={this.props.options}
            isValidNewOption={this.props.validation}
            promptTextCreator={l=>l}
            pageSize={9}
            shouldKeyDownEventCreateNewOption={()=>true}
            placeholder={this.props.placeholder}
            isDisabled={this.props.disabled}
            onSelectResetsInput={!this.props.update_on_input}/>;
    }
}

export class Yes_no extends Pure_component {
    options = ()=>{
        const default_label = this.props.default ? 'Yes' : 'No';
        return [
            {key: 'No', value: false},
            {key: 'Default ('+default_label+')', value: ''},
            {key: 'Yes', value: true},
        ];
    };
    render(){
        return <Select {...this.props} data={this.options()}/>;
    }
}

export class Regex extends Pure_component {
    state = {recognized: false, checked: {}};
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
    on_input_change = regexp=>{
        this.props.on_change_wrapper(regexp, this.props.id);
    };
    render(){
        const val = this.props.val||'';
        return <div className="regex_field">
              <div className="regex_input">
                <div className="tip_box active">
                  <div className="checks">
                    {this.formats.map(f=>
                      <Tooltip key={f+!!this.state.checked[f]}
                        title={this.tip(f)}>
                        <div onClick={this.toggle.bind(null, f)}
                          className={this.classes(f)}>.{f}</div>
                      </Tooltip>
                    )}
                  </div>
                </div>
                <Input className="regex" {...this.props} val={val} type="text"
                  on_change_wrapper={this.on_input_change}/>
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
        return <div className={classes}>
              <textarea ref={this.set_ref}/>
            </div>;
    }
}

export const Textarea = props=>{
    return <textarea value={props.val} rows={props.rows||3}
          placeholder={props.placeholder}
          onChange={e=>props.on_change_wrapper(e.target.value)}/>;
};

export const Typeahead_wrapper = props=>
    <Typeahead options={props.data} maxResults={10}
      minLength={1} disabled={props.disabled} selectHintOnEnter
      onChange={props.on_change_wrapper} selected={props.val}
      onInputChange={props.on_input_change}/>;

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
          <select value={''+props.val}
            onChange={e=>update(e.target.value)} disabled={props.disabled}>
            {(props.data||[]).map((c, i)=>
              <option key={i} value={c.value}>{c.key}</option>
            )}
          </select>
        </Tooltip>;
};

export const Input = props=>{
    const update = val=>{
        if (props.type=='number' && val)
            val = Number(val);
        if (props.on_change_wrapper)
            props.on_change_wrapper(val, props.id);
    };
    return <input style={props.style}
          type={props.type}
          value={props.val}
          disabled={props.disabled}
          onChange={e=>update(e.target.value)}
          className={props.className}
          placeholder={props.placeholder}
          onBlur={props.on_blur}
          onKeyUp={props.on_key_up}/>;
};
