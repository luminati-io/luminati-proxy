// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import React from 'react';
import $ from 'jquery';
import classnames from 'classnames';
import etask from '../../../util/etask.js';
import Pure_component from '/www/util/pub/pure_component.js';

export class Modal_dialog extends Pure_component {
    componentDidMount(){
        $(this.ref).on('hide.bs.modal', ()=>{
            this.props.cancel_clicked && this.props.cancel_clicked();
        });
    }
    componentDidUpdate(prev_props){
        if (this.props.open==prev_props.open)
            return;
        if (this.props.open)
            $(this.ref).modal();
        else
            $(this.ref).modal('hide');
    }
    willUnmount(){
        $(this.ref).modal('hide');
    }
    set_ref = e=>{ this.ref = e; };
    stop = e=>{
        e.stopPropagation();
    };
    render(){
        return <div tabIndex="-1" ref={this.set_ref} onClick={this.stop}
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
                      ok_disabled={this.props.ok_disabled}
                      cancel_clicked={this.props.cancel_clicked}
                      no_cancel_btn={this.props.no_cancel_btn}/>
                  </div>
                </div>
              </div>
            </div>;
    }
}

export class Modal extends React.Component {
    componentDidMount(){
        $(this.ref).on('hidden.bs.modal', ()=>{
            this.props.on_hidden && this.props.on_hidden();
        });
    }
    click_cancel(){
        if (this.props.cancel_clicked)
            this.props.cancel_clicked();
        if (!this.props.cancel_no_close)
            $('#'+this.props.id).modal('hide');
    }
    click_ok(){
        if (!this.props.no_ok_close)
            $('#'+this.props.id).modal('hide');
        const _this = this;
        etask(function*(){
            if (_this.props.click_ok)
                yield _this.props.click_ok();
        });
    }
    on_dismiss = ()=>{
        if (this.props.on_dismiss)
            this.props.on_dismiss();
    };
    set_ref = e=>{ this.ref = e; };
    render(){
        let footer = null;
        if (!this.props.no_footer)
        {
            footer = this.props.footer ||
                <Footer_default cancel_clicked={this.click_cancel.bind(this)}
                  ok_href={this.props.ok_href}
                  ok_clicked={this.click_ok.bind(this)}
                  ok_btn_title={this.props.ok_btn_title}
                  ok_disabled={this.props.ok_disabled}
                  ok_btn_classes={this.props.ok_btn_classes}
                  cancel_btn_title={this.props.cancel_btn_title}
                  no_cancel_btn={this.props.no_cancel_btn}
                  left_item={this.props.left_footer_item}/>;
        }
        const header_classes = classnames('modal-header',
            {no_header: this.props.no_header});
        return <div id={this.props.id} tabIndex="-1" ref={this.set_ref}
              className={classnames('modal', 'fade', this.props.className)}
              style={this.props.style}>
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className={header_classes}>
                    {!this.props.no_close &&
                      <button className="close close_icon" data-dismiss="modal"
                          aria-label="Close" onClick={this.on_dismiss}>
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

const Footer_default = props=>{
    const ok_title = props.ok_btn_title||'OK';
    const cancel_title = props.cancel_btn_title||'Cancel';
    const ok_classes = props.ok_btn_classes||'btn btn_lpm btn_lpm_primary ok';
    return <div className="default_footer">
          {props.left_item &&
            <span className="left_item">{props.left_item}</span>}
          {!props.no_cancel_btn &&
            <button onClick={props.cancel_clicked}
              className="btn btn_lpm cancel">
              {cancel_title}
            </button>
          }
          {props.ok_href &&
            <a href={props.ok_href} onClick={props.ok_clicked}
              className={ok_classes}>{ok_title}</a>
          }
          {!props.ok_href &&
            <button onClick={props.ok_clicked} className={ok_classes}
              disabled={props.ok_disabled}>
              {ok_title}
            </button>
          }
        </div>;
};
