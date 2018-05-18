// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import Pure_component from '../../www/util/pub/pure_component.js';
import React from 'react';
import classnames from 'classnames';
import {Input} from './common.js';

export default class Settings extends Pure_component {
    state = {};
    zone_change = e=>console.log(e);
    render(){
        return (
            <div className="settings">
              <Input val={this.state.zone} type="text"
                on_change_wrapper={this.zone_change}/>
            </div>
        );
    }
}
