// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import {perr} from '../util.js';

export default class Error_boundry extends Pure_component {
    state = {error: false, msg: null};
    static getDerivedStateFromError(error){
        let msg = null;
        switch (error)
        {
        case 'duplicate_port_number':
            msg = 'Multiple port configuration detected - please check port '
                +'set up and delete duplicated port.';
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
                {this.state.msg && <h4>{this.state.msg}</h4>}
            </React.Fragment>;
        }
        return this.props.children;
    }
}
