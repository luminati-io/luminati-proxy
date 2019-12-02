// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import ajax from '../../util/ajax.js';
import etask from '../../util/etask.js';
import classnames from 'classnames';
import Pure_component from '/www/util/pub/pure_component.js';
import {Nav, Link_icon} from './common.js';
import codemirror from 'codemirror/lib/codemirror';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/lib/codemirror.css';
import filesaver from 'file-saver';
import $ from 'jquery';
import {Modal} from './common/modals.js';

class Config extends Pure_component {
    state = {editable: false, changed: false, persisted_config: ''};
    title = 'Manual configuration';
    subtitle = 'Edit or export your ports configuration as JSON file';
    componentDidMount(){
        this.cm = codemirror.fromTextArea(this.textarea,
            {mode: 'javascript', readOnly: 'nocursor'});
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
        this.cm.setOption('readOnly', editable ? false : 'nocursor');
    }
    check(){
        if (!this.state.changed)
            return;
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
                _this.setState({warning: check[0]});
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
        this.set_editable(false);
        const _this = this;
        this.etask(function*(){
            const save_url = '/api/config';
            // XXX krzysztof: switch fetch->ajax
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
        const blob = new Blob([this.cm.doc.getValue()],
            {type: 'text/plain;charset=utf-8'});
        filesaver.saveAs(blob, `${this.state.settings.customer}_config.json`);
    }
    click_edit(){
        this.set_editable(true);
    }
    click_cancel(){
        this.cm.doc.setValue(this.state.persisted_config);
        this.setState({warning: undefined});
        this.set_editable(false);
    }
    render(){
        const panel_class = classnames('panel code_panel flex_auto vbox', {
            editable: this.state.editable});
        const read_only = this.state.settings && this.state.settings.read_only;
        return <div className="config vbox">
              <Nav title={this.title} subtitle={this.subtitle}
                warning={this.state.warning}/>
              <div className={panel_class}>
                <div className="panel_body flex_auto vbox">
                  <Nav_buttons editable={this.state.editable}
                    read_only={read_only}
                    changed={this.state.changed}
                    click_edit={this.click_edit.bind(this)}
                    click_save={this.check.bind(this)}
                    click_download={this.download.bind(this)}
                    click_cancel={this.click_cancel.bind(this)}/>
                  <textarea ref={this.set_textarea.bind(this)}/>
                </div>
              </div>
              <Conf_modal click_ok={this.save.bind(this)}/>
            </div>;
    }
}

const Nav_buttons = props=>{
    const save_class = classnames({disabled: !props.changed});
    if (props.editable)
    {
        return <div className="nav_buttons">
              <Link_icon tooltip="Cancel" on_click={props.click_cancel}
                id="remove"/>
              <Link_icon tooltip="Save" on_click={props.click_save}
                classes={save_class} id="ok"/>
            </div>;
    }
    const tooltip = props.read_only ? 'It is not possible to edit the config '
    +'in read only mode' : 'Edit config';
    return <div className="nav_buttons">
          <Link_icon tooltip={tooltip} on_click={props.click_edit}
            id="pencil" disabled={props.read_only}/>
          <Link_icon tooltip="Download as JSON"
            on_click={props.click_download} id="download"/>
        </div>;
};

const Conf_modal = props=>{
    const content = `Editing the configuration manually may result in your
        proxies working incorrectly. Do you still want to modify the
        configuration file?`;
    return <Modal title="Are you sure?" id="conf_confirmation_modal"
          click_ok={props.click_ok}>
          <p>{content}</p>
        </Modal>;
};

export default Config;
