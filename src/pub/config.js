// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import ajax from 'hutil/util/ajax';
import etask from 'hutil/util/etask';
import classnames from 'classnames';
import Pure_component from '../../www/util/pub/pure_component.js';
import {Nav, Modal} from './common.js';
import codemirror from 'codemirror/lib/codemirror';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/lib/codemirror.css';
import filesaver from 'file-saver';
import $ from 'jquery';
import util from './util.js';

const ga_event = util.ga_event;

class Config extends Pure_component {
    constructor(props){
        super(props);
        this.state = {editable: false, changed: false, persisted_config: ''};
        this.title = 'Manual Configuration';
        this.subtitle = 'Edit or export your ports configuration as JSON file';
    }
    componentDidMount(){
        this.cm = codemirror.fromTextArea(this.textarea,
            {mode: 'javascript', readOnly: 'nocursor'});
        this.cm.setSize('auto', 420);
        this.cm.on('change', this.on_cm_change.bind(this));
        const _this = this;
        this.etask(function*(){
            const config = yield ajax.json({url: '/api/config'});
            _this.setState({persisted_config: config.config});
            _this.cm.doc.setValue(config.config);
        });
        this.setdb_on('head.settings', settings=>this.setState({settings}));
    }
    on_cm_change(e){
        this.setState({changed:
            this.state.persisted_config!=e.doc.getValue()});
    }
    set_textarea(el){ this.textarea = el; }
    set_editable(editable){
        this.setState({editable});
        this.cm.setOption('readOnly', editable ?  false : 'nocursor');
    }
    check(){
        if (!this.state.changed)
            return;
        ga_event('configuration', 'click save');
        const _this = this;
        this.etask(function*(){
            const check_url = '/api/config_check';
            const raw_check = yield window.fetch(check_url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({config: _this.cm.doc.getValue()}),
            });
            const check = yield raw_check.json();
            if (check.length)
            {
                ga_event('configuration', 'wrong format');
                _this.setState({warning: check[0]});
            }
            else
                $('#conf_confirmation_modal').modal();
        });
    }
    check_reload(){
        const _this = this;
        const retry = ()=>{ setTimeout(_this.check_reload.bind(_this), 500); };
        return etask(function*(){
            this.on('uncaught', retry);
            yield ajax.json({url: 'api/proxies_running'});
            window.location.reload();
        });
    }
    save(){
        ga_event('configuration', 'click save in modal');
        this.set_editable(false);
        const _this = this;
        this.etask(function*(){
            const save_url = '/api/config';
            yield window.fetch(save_url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({config: _this.cm.doc.getValue()}),
            });
            $('#restarting').modal({backdrop: 'static', keyboard: false});
            yield etask.sleep(3000);
            yield _this.check_reload();
        });
    }
    download(){
        ga_event('configuration', 'click download');
        const blob = new Blob([this.cm.doc.getValue()],
            {type: "text/plain;charset=utf-8"});
        filesaver.saveAs(blob, `${this.state.settings.customer}_config.json`);
    }
    click_edit(){
        this.set_editable(true);
        ga_event('configuration', 'click edit');
    }
    click_cancel(){
        this.cm.doc.setValue(this.state.persisted_config);
        this.setState({warning: undefined});
        this.set_editable(false);
        ga_event('configuration', 'click cancel');
    }
    render(){
        const panel_class = classnames('panel code_panel', {
            editable: this.state.editable});
        return (
            <div className="lpm config">
              <Nav title={this.title} subtitle={this.subtitle}
                warning={this.state.warning}/>
              <div className="panel wrapper_panel">
                <div className="panel_body">
                  <div className={panel_class}>
                    <div className="panel_body">
                      <Nav_buttons editable={this.state.editable}
                        changed={this.state.changed}
                        click_edit={this.click_edit.bind(this)}
                        click_save={this.check.bind(this)}
                        click_download={this.download.bind(this)}
                        click_cancel={this.click_cancel.bind(this)}/>
                      <textarea ref={this.set_textarea.bind(this)}/>
                    </div>
                  </div>
                </div>
              </div>
              <Conf_modal click_ok={this.save.bind(this)}/>
            </div>
        );
    }
}

const Nav_buttons = props=>{
    const save_class = classnames('btn btn_lpm save_btn',
        {disabled: !props.changed});
    const cancel_class = classnames('btn btn_lpm btn_lpm_default cancel_btn');
    if (props.editable)
    {
        return (
            <div className="nav_buttons">
              <button onClick={props.click_cancel} className={cancel_class}>
                Cancel</button>
              <button onClick={props.click_save} className={save_class}>
                Save</button>
            </div>
        );
    }
    else
    {
        return (
            <div className="nav_buttons">
              <Action_btn on_click={props.click_edit} id="edit"
                content="Edit"/>
              <Action_btn on_click={props.click_download} id="download"
                content="Download"/>
            </div>
        );
    }
};

const Action_btn = ({class_names, id, content, on_click})=>{
    const btn_class = classnames('btn btn_lpm btn_lpm_default c_btn', id,
        class_names);
    return (
        <button className={btn_class} onClick={on_click}>
          <div className={classnames('img', id)}/>
          <div className="content">{content}</div>
        </button>
    );
};

const Conf_modal = props=>{
    const content = `Editing the configuration manually may result in your
        proxies working incorrectly. Do you still want to modify the
        configuration file?`;
    return (
        <Modal title="Are you sure?" id="conf_confirmation_modal"
          click_ok={props.click_ok}>
          <p>{content}</p>
        </Modal>
    );
};

export default Config;
