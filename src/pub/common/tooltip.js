// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import $ from 'jquery';

export default class Tooltip extends Pure_component {
    componentDidMount(){
        if (!this.ref)
            return;
        $(this.ref).tooltip();
    }
    componentWillUnmount(){
        $(this.ref).tooltip('destroy');
    }
    componentDidUpdate(){
        $(this.ref).attr('title', this.props.title).tooltip('fixTitle');
    }
    on_mouse_leave(){
        if (!this.ref)
            return;
        $(this.ref).tooltip('hide');
    }
    set_ref(e){ this.ref = e; }
    render(){
        if (this.props.children==undefined)
            return null;
        if (!this.props.title)
            return this.props.children;
        const classes = `tooltip har_tooltip ${this.props.className||''}`;
        const props = {
            'data-toggle': 'tooltip',
            'data-placement': this.props.placement||'top',
            'data-container': 'body',
            'data-html': true,
            'data-template': `<div class="${classes}"
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
            if (typeof c=='string' || typeof c=='object' && c.type.name=='T')
                return React.createElement('span', props, c);
            return React.cloneElement(c, props);
        });
    }
}
