// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import classnames from 'classnames';
import ws from './ws.js';
import {T} from './common/i18n.js';

class Cpu_warning extends React.Component {
    constructor(props){
        super(props);
        this.state = {usage: 0, level: null};
    }
    componentDidMount(){
        ws.addEventListener('cpu_usage', this.on_cpu_usage);
    }
    componentWillUnmount(){
        ws.removeEventListener('cpu_usage', this.on_cpu_usage);
    }
    shouldComponentUpdate(_, next_state){
        return this.state.usage!=next_state.usage;
    }
    on_cpu_usage = ({data})=>this.setState({
        usage: data.usage,
        level: data.level
    });
    render(){
        const {usage, level} = this.state;
        if (!level)
            return null;
        return <div className="cpu_warning">
          <i className={classnames('glyphicon', `glyphicon-alert`)}/>
          <span><T>High CPU usage: </T>{usage}%</span>
        </div>;
    }
}

export default Cpu_warning;
