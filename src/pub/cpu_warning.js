// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import classnames from 'classnames';
import ws from './ws.js';
import {T} from './common/i18n.js';

class Cpu_warning extends React.Component {
    state = {usage: 0, level: null};
    componentDidMount(){
        ws.addEventListener('message', this.on_message);
    }
    componentWillUnmount(){
        ws.removeEventListener('message', this.on_message);
    }
    shouldComponentUpdate(_, next_state){
        return this.state.usage!=next_state.usage;
    }
    on_message = event=>{
        const json = JSON.parse(event.data);
        if (json.type!='cpu_usage')
            return;
        const cpu_usage = json.data;
        this.setState(cpu_usage);
    };
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
