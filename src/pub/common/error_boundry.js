// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import {perr} from '../util.js';
import {www_api} from '../common.js';

export default class Error_boundry extends Pure_component {
    state = {error: false, msg: null};
    static getDerivedStateFromError(error){
        const cp_href = www_api+'/cp/lpm';
        let msg = null;
        switch (error)
        {
        case 'duplicate_port_number':
            msg = <h4>Multiple port configuration detected -
                please check port set up and delete duplicated port</h4>;
            break;
        case 'cp_required':
            msg = <h4>Cloud Proxy Manager can be opened only
                in <a href={cp_href}>Bright Data control panel</a></h4>;
            break;
        }
        return {error: true, msg};
    }
    componentDidCatch(error, info){
        this.log_error(error, info);
    }
    log_error = (error, info)=>{
        const {message, stack} = error;
        perr('react', message, info.componentStack+'\n\n'+stack);
    };
    render(){
        if (this.state.error)
        {
            return <React.Fragment>
                <h1>Error</h1>
                {this.state.msg && this.state.msg}
            </React.Fragment>;
        }
        return this.props.children;
    }
}
