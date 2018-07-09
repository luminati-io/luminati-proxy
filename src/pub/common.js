// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import $ from 'jquery';
import classnames from 'classnames';
import React from 'react';
import {Pagination} from 'react-bootstrap';
import etask from '../../util/etask.js';
import ajax from '../../util/ajax.js';
import Pure_component from '../../www/util/pub/pure_component.js';
import {Typeahead} from 'react-bootstrap-typeahead';
import {bytes_format} from './util.js';
import * as Chrome from './chrome_widgets.js';

export class Modal_dialog extends React.Component {
    componentDidMount(){
        const _this = this;
        $(this.ref).on('hide.bs.modal', function(){
            _this.props.cancel_clicked && _this.props.cancel_clicked();
        });
    }
    componentWillReceiveProps(new_props){
        if (this.props.open==new_props.open)
            return;
        if (new_props.open)
            $(this.ref).modal();
        else
            $(this.ref).modal('hide');
    }
    set_ref(e){ this.ref = e; }
    render(){
        return <div tabIndex="-1"
              ref={this.set_ref.bind(this)}
              className={classnames('modal', 'fade', this.props.className)}>
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <button className="close close_icon" data-dismiss="modal"
                        aria-label="Close"/>
                    <h4 className="modal-title">{this.props.title}</h4>
                  </div>
                  {this.props.children &&
                    <div className="modal-body">{this.props.children}</div>
                  }
                  <div className="modal-footer">
                    <Footer_default ok_clicked={this.props.ok_clicked}
                      cancel_clicked={this.props.cancel_clicked}
                      no_cancel_btn={this.props.no_cancel_btn}/>
                  </div>
                </div>
              </div>
            </div>;
    }
}

export class Modal extends React.Component {
    click_cancel(){
        if (this.props.cancel_clicked)
            this.props.cancel_clicked();
        $('#'+this.props.id).modal('hide');
    }
    click_ok(){
        $('#'+this.props.id).modal('hide');
        const _this = this;
        etask(function*(){
            if (_this.props.click_ok)
                yield _this.props.click_ok();
        });
    }
    on_dismiss(){
        if (this.props.on_dismiss)
            this.props.on_dismiss();
    }
    render(){
        let footer = null;
        if (!this.props.no_footer)
        {
            footer = this.props.footer ||
                <Footer_default cancel_clicked={this.click_cancel.bind(this)}
                  ok_clicked={this.click_ok.bind(this)}
                  ok_btn_title={this.props.ok_btn_title}
                  ok_btn_classes={this.props.ok_btn_classes}
                  no_cancel_btn={this.props.no_cancel_btn}/>;
        }
        const header_classes = classnames('modal-header',
            {no_header: this.props.no_header});
        return <div id={this.props.id} tabIndex="-1"
              className={classnames('modal', 'fade', this.props.className)}>
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className={header_classes}>
                    {!this.props.no_close &&
                      <button className="close close_icon" data-dismiss="modal"
                          aria-label="Close"
                          onClick={this.on_dismiss.bind(this)}>
                      </button>
                    }
                    {!this.props.no_header && !this.props.custom_header &&
                      <h4 className="modal-title">{this.props.title}</h4>
                    }
                    {this.props.custom_header && this.props.custom_header}
                  </div>
                  {this.props.children &&
                    <div className="modal-body">{this.props.children}</div>
                  }
                  <div className="modal-footer">{footer}</div>
                </div>
              </div>
            </div>;
    }
}

export class Enable_ssl_modal extends Pure_component {
    state = {loading: false};
    faq_cert_url = 'https://luminati.io/faq#proxy-certificate';
    enable_ssl = ()=>{
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>console.log(e));
            _this.setState({loading: true});
            yield ajax({url: '/api/enable_ssl', method: 'POST'});
            _this.setState({loading: false});
        });
    };
    render(){
        return [
            <Loader key="1" show={this.state.loading}/>,
            <Modal key="2" id={this.props.id||'enable_ssl_modal'}
              title="Enable SSL analyzing for all proxies"
              click_ok={this.enable_ssl} className="enable_ssl_modal">
              <p className="cert_info">
                You will also need to add a certificate file to browsers.
                Gathering stats for HTTPS requests requires setting a
                certificate key.
              </p>
              <div className="instructions">
                <ol>
                  <Circle_li>Download our free certificate key
                    <a href="/ssl" target="_blank" download> here</a>
                  </Circle_li>
                  <Circle_li>
                    Add the certificate to your browser.
                    You can find more detailed
                    instructions <a className="link" href={this.faq_cert_url}
                      rel="noopener noreferrer" target="_blank">here</a>
                  </Circle_li>
                  <Circle_li>Refresh the page</Circle_li>
                </ol>
              </div>
            </Modal>,
        ];
    }
}

export const Tooltip_bytes = ({bytes, chrome_style})=>{
    bytes = bytes||0;
    const tooltip = [0, 1, 2, 3]
        .map(n=>`<div>${bytes_format(bytes, n)}</div>`)
        .join('');
    const T = chrome_style ? Chrome.Tooltip : Tooltip;
    return <T title={bytes ? tooltip : ''}>
          <div className="disp_value">{bytes_format(bytes)||'—'}</div>
        </T>;
};

const Footer_default = props=>
    <div className="default_footer">
      {!props.no_cancel_btn &&
        <button onClick={props.cancel_clicked} className="btn btn_lpm cancel">
          Cancel</button>
      }
      <button onClick={props.ok_clicked}
        className={props.ok_btn_classes||'btn btn_lpm btn_lpm_primary ok'}>
        {props.ok_btn_title||'OK'}</button>
    </div>;

export const Warnings = props=>
    <div>
      {(props.warnings||[]).map((w, i)=><Warning key={i} text={w.msg}/>)}
    </div>;

export const Warning = props=>
    <div className="warning">
      <div className="warning_icon"/>
      <div className="text">{props.text}</div>
    </div>;

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

export const Loader_small = ({show, saving, loading_msg='Saving...',
    std_msg='', std_tooltip})=>
{
    saving = show||saving;
    const msg = saving ? loading_msg : std_msg;
    const tooltip = saving ? '' : std_tooltip;
    return <div className="loader_small">
          <div className={classnames('spinner', {show: saving})}/>
          <div className={classnames('saving_label', {saving})}>
            <Tooltip title={tooltip}>
              {msg}
            </Tooltip>
          </div>
        </div>;
};

export class Code extends Pure_component {
    componentDidMount(){
        $(this.ref).find('.btn_copy').tooltip('show')
        .attr('title', 'Copy to clipboard').tooltip('fixTitle');
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
            $(this.ref).find('.btn_copy').attr('title', 'Copied!')
            .tooltip('fixTitle')
            .tooltip('show').attr('title', 'Copy to clipboard')
            .tooltip('fixTitle');
        } catch(e){ console.log('Oops, unable to copy'); }
    }
    render(){
        return <code ref={this.set_ref.bind(this)}>
              <span className="source">{this.props.children}</span>
              <textarea style={{position: 'fixed', top: '-1000px'}}/>
              <button onClick={this.copy.bind(this)} data-container="body"
                className="btn btn_lpm btn_lpm_small btn_copy">
                Copy</button>
            </code>;
    }
}

export const Textarea = props=>{
    return <textarea value={props.val} rows={props.rows||3}
          placeholder={props.placeholder}
          onChange={e=>props.on_change_wrapper(e.target.value)}/>;
};

export const Select = props=>{
    const update = val=>{
        if (val=='true')
            val = true;
        else if (val=='false')
            val = false;
        if (props.on_change_wrapper)
            props.on_change_wrapper(val);
    };
    return <select value={''+props.val}
          onChange={e=>update(e.target.value)} disabled={props.disabled}>
          {(props.data||[]).map((c, i)=>
            <option key={i} value={c.value}>{c.key}</option>
          )}
        </select>;
};

const Double_number = props=>{
    const vals = (''+props.val).split(':');
    const update = (start, end)=>{
        props.on_change_wrapper([start||0, end].join(':')); };
    return <span className="double_field">
          <Input {...props} val={vals[0]||''} id={props.id+'_start'}
            type="number" disabled={props.disabled}
            on_change_wrapper={val=>update(val, vals[1])}/>
          <span className="devider">:</span>
          <Input {...props} val={vals[1]||''} id={props.id+'_end'}
            type="number" disabled={props.disabled}
            on_change_wrapper={val=>update(vals[0], val)}/>
        </span>;
};

const Typeahead_wrapper = props=>
    <Typeahead options={props.data} maxResults={10}
      minLength={1} disabled={props.disabled} selectHintOnEnter
      onChange={props.on_change_wrapper} selected={props.val}
      onInputChange={props.on_input_change}/>;

export const Form_controller = props=>{
    const type = props.type;
    if (type=='select')
        return <Select {...props}/>;
    else if (type=='double_number')
        return <Double_number {...props}/>;
    else if (type=='typeahead')
        return <Typeahead_wrapper {...props}/>;
    else if (type=='textarea')
        return <Textarea {...props}/>;
    return <Input {...props}/>;
};

export const Note = props=>
    <div className="note">
      <span>{props.children}</span>
    </div>;

export const Labeled_controller = ({label, tooltip, disabled, note, sufix,
    ...props})=>
    <div className={classnames('field_row', {disabled, note})}>
      <div className="desc">
        <Tooltip title={tooltip}>{label}</Tooltip>
      </div>
      <div className="field">
        <div className="inline_field">
          <Form_controller disabled={disabled} {...props}/>
          {sufix && <span className="sufix">{sufix}</span>}
        </div>
        {note && <Note>{note}</Note>}
      </div>
    </div>;

export const Input = props=>{
    const update = val=>{
        if (props.type=='number' && val)
            val = Number(val);
        if (props.on_change_wrapper)
            props.on_change_wrapper(val, props.id);
    };
    return <input type={props.type} value={props.val} disabled={props.disabled}
          onChange={e=>update(e.target.value)} className={props.className}
          min={props.min} max={props.max} placeholder={props.placeholder}
          onBlur={props.on_blur}/>;
};

export const Checkbox = props=>
  <div className="form-check">
    <label className="form-check-label">
      <input className="form-check-input" type="checkbox" value={props.value}
        onChange={e=>props.on_change(e)} checked={props.checked}/>
        {props.text}
    </label>
  </div>;

export const Nav = ({title, subtitle, warning})=>
    <div className="nav_header">
      <h3>{title}</h3>
      <div className="subtitle">{subtitle}</div>
      <Warning_msg warning={warning}/>
    </div>;

const Warning_msg = ({warning})=>{
    if (!warning)
        return null;
    return <Warning text={warning}/>;
};

export const Pagination_panel = ({entries, items_per_page, cur_page,
    page_change, children, top, bottom, update_items_per_page, max_buttons,
    total})=>
{
    total = total||entries&&entries.length||0;
    let pagination = null;
    if (total>items_per_page)
    {
        let next = false;
        let pages = Math.ceil(total/items_per_page);
        if (cur_page+1<pages)
            next = 'Next';
        pagination = <Pagination next={next} boundaryLinks
            activePage={cur_page+1}
            bsSize="small" onSelect={page_change}
            items={pages} maxButtons={max_buttons||5}/>;
    }
    let buttons = null;
    if (top)
        buttons = <div className="table_buttons">{children}</div>;
    const display_options = [10, 20, 50, 100, 200, 500, 1000].map(v=>({
        key: v, value: v}));
    const from = Math.min(cur_page*items_per_page+1, total);
    const to = Math.min((cur_page+1)*items_per_page, total);
    return <div className={classnames('pagination_panel', {top, bottom})}>
          {pagination}
          <div className="numbers">
            <strong>{from}-{to}</strong> of <strong>{total}</strong>
          </div>
          <Select val={items_per_page} data={display_options}
            on_change_wrapper={update_items_per_page}/>
          {buttons}
        </div>;
};

export class Tooltip extends Pure_component {
    componentDidMount(){
        if (!this.ref)
            return;
        $(this.ref).tooltip();
    }
    componentWillUnmount(){ $(this.ref).tooltip('destroy'); }
    componentDidUpdate(){
        $(this.ref).attr('title', this.props.title).tooltip('fixTitle'); }
    on_mouse_leave(){
        if (!this.ref)
            return;
        $(this.ref).tooltip('hide');
    }
    set_ref(e){ this.ref = e; }
    render(){
        if (!this.props.children)
            return null;
        if (!this.props.title)
            return this.props.children;
        const props = {
            'data-toggle': 'tooltip',
            'data-placement': this.props.placement||'top',
            'data-container': 'body',
            'data-html': true,
            'data-template': `<div class="tooltip ${this.props.className||''}"
                role="tooltip">
                <div class="tooltip-arrow"></div>
                <div class="tooltip-inner"></div>
            </div>`,
            title: this.props.title,
            ref: this.set_ref.bind(this),
            onMouseLeave: this.on_mouse_leave.bind(this),
        };
        return React.Children.map(this.props.children, c=>{
            if (typeof c=='number')
                c = ''+c;
            if (typeof c=='string')
                return React.createElement('span', props, c);
            return React.cloneElement(c, props);
        });
    }
}

export const Link_icon = ({tooltip, on_click, id, classes, disabled, invisible,
    small})=>
{
    if (invisible)
        tooltip = '';
    if (disabled||invisible)
        on_click = ()=>null;
    classes = classnames(classes, {small});
    return <Tooltip title={tooltip} key={id}>
          <span className={classnames('link', 'icon_link', classes)}
            onClick={on_click}>
            <i className={classnames('glyphicon', 'glyphicon-'+id)}/>
          </span>
        </Tooltip>;
};

export const Circle_li = props=>
    <li>
      <div className="circle_wrapper">
        <div className="circle"/>
      </div>
      <div className="single_instruction">{props.children}</div>
    </li>;

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

export class Logo extends Pure_component {
    state = {};
    componentDidMount(){
        this.setdb_on('head.version', ver=>this.setState({ver})); }
    render(){
        return <div className="nav_top">
              <a href="https://luminati.io/cp" rel="noopener noreferrer"
                target="_blank" className="logo_big"/>
              <div className="version">V{this.state.ver}</div>
            </div>;
    }
}

