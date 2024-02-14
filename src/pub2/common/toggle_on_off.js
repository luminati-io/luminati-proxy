// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import React from 'react';
import classnames from 'classnames';
import Pure_component from '/www/util/pub/pure_component.js';

export default class Toggle_on_off extends Pure_component {
    render(){
        const {disabled, val} = this.props;
        const style = disabled ? {pointerEvents: 'none'} : {};
        const cls = classnames('btn', 'toggle_on_off', this.props.class_name,
            {toggle_on_off_active: !!val});
        return <button type="button" className={cls} style={style}
              disabled={disabled} onClick={this.props.on_click}>
              <span className={'toggle_on_off_label toggle_on_off_label_off '
                +(val ? '': 'toggle_on_off_label_active')}>Off</span>
              <span className={'toggle_on_off_label toggle_on_off_label_on '
                +(val ? 'toggle_on_off_label_active' : '')}>On</span>
              <span className={'toggle_on_off_handle '
                +(val ? 'toggle_on_off_handle_active' : '')}/>
            </button>;
    }
}
