// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';

export default class Error_boundry extends Pure_component {
    state = {error: false};
    static getDerivedStateFromError(error){
        return {error: true};
    }
    componentDidCatch(error, info){
        this.log_error(error, info);
    }
    log_error = (error, info)=>{
        const {message, stack} = error;
        this.etask(function*(){
            yield window.fetch('/api/react_error', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({backtrace: stack, message,
                    stack: info.componentStack}),
            });
        });
    };
    render(){
        if (this.state.error)
            return <h1>Error</h1>;
        return this.props.children;
    }
}
