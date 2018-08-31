// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import Pure_component from '../../www/util/pub/pure_component.js';
import React from 'react';
import JSON_viewer from './json_viewer.js';
import codemirror from 'codemirror/lib/codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/htmlmixed/htmlmixed';
import classnames from 'classnames';
import moment from 'moment';
import $ from 'jquery';

class Preview extends Pure_component {
    panes = [
        {id: 'headers', width: 65, comp: Pane_headers},
        {id: 'preview', width: 63, comp: Pane_preview},
        {id: 'response', width: 72, comp: Pane_response},
        {id: 'timing', width: 57, comp: Pane_timing},
    ];
    state = {cur_pane: 0};
    select_pane = id=>{ this.setState({cur_pane: id}); };
    componentDidMount(){
        this.setdb_on('har_viewer.set_pane', pane=>{
            if (pane===undefined)
                return;
            this.setState({cur_pane: pane});
        });
    }
    render(){
        if (!this.props.cur_preview)
            return null;
        const Pane_content = this.panes[this.state.cur_pane].comp;
        const req = this.props.cur_preview;
        return <div style={this.props.style} className="har_preview chrome">
              <div className="tabbed_pane_header">
                <div className="left_pane">
                  <div onClick={this.props.close_preview}
                    className="close_btn_wrapper">
                    <div className="small_icon close_btn"/>
                    <div className="medium_icon close_btn_h"/>
                  </div>
                </div>
                <div className="right_panes">
                  {this.panes.map((p, idx)=>
                    <Pane key={p.id} width={p.width} id={p.id} idx={idx}
                      on_click={this.select_pane}
                      active={this.state.cur_pane==idx}/>
                  )}
                  <Pane_slider panes={this.panes}
                    cur_pane={this.state.cur_pane}/>
                </div>
              </div>
              <div className="tabbed_pane_content">
                <Pane_content key={req.uuid} req={req}/>
              </div>
            </div>;
    }
}

const Pane = ({id, idx, width, on_click, active})=>
    <div onClick={()=>on_click(idx)} style={{width}}
      className={classnames('pane', id, {active})}>
      <span>{id}</span>
    </div>;

const Pane_slider = ({panes, cur_pane})=>{
    const slider_class = classnames('pane_slider');
    const offset = panes.slice(0, cur_pane).reduce((acc, e)=>acc+e.width, 0);
    const slider_style = {
        width: panes[cur_pane].width,
        transform: `translateX(${offset+24}px)`,
    };
    return <div className={slider_class} style={slider_style}/>;
};

class Pane_headers extends Pure_component {
    render(){
        const {req} = this.props;
        const general_entries = [
            {name: 'Request URL', value: req.request.url},
            {name: 'Status Code', value: req.response.status},
            {name: 'Super Proxy', value: req.details.super_proxy},
            {name: 'Username', value: req.details.username},
            {name: 'Password', value: req.details.password},
            {name: 'Sent from', value: req.details.remote_address},
        ];
        return <ol className="tree_outline">
              <Preview_section title="General" pairs={general_entries}/>
              <Preview_section title="Response headers"
                pairs={req.response.headers}/>
              <Preview_section title="Request headers"
                pairs={req.request.headers}/>
             </ol>;
    }
}

class Pane_response extends Pure_component {
    render(){
        const content_type = this.props.req.details.content_type;
        if (!content_type||['xhr', 'css', 'js', 'font', 'html'].includes(
            content_type))
        {
            return <Codemirror_wrapper req={this.props.req}/>;
        }
        return <No_response_data/>;
    }
}

const No_response_data = ()=>
    <div className="empty_view">
      <div>This request has no response data available.</div>
    </div>;

class Codemirror_wrapper extends Pure_component {
    componentDidMount(){
        this.cm = codemirror.fromTextArea(this.textarea, {
            readOnly: 'nocursor',
            lineNumbers: true,
        });
        this.cm.setSize('100%', '100%');
        let text = this.props.req.response.content.text;
        try { text = JSON.stringify(JSON.parse(text), null, '\t'); }
        catch(e){}
        this.cm.doc.setValue(text);
        this.set_ct();
    }
    componentDidUpdate(){
        this.cm.doc.setValue(this.props.req.response.content.text||'');
        this.set_ct();
    }
    set_ct(){
        const content_type = this.props.req.details.content_type;
        let mode;
        if (!content_type||content_type=='xhr')
            mode = 'javascript';
        if (content_type=='html')
            mode = 'htmlmixed';
        this.cm.setOption('mode', mode);
    }
    set_textarea = ref=>{ this.textarea = ref; };
    render(){
        return <div className="codemirror_wrapper">
              <textarea ref={this.set_textarea}/>
            </div>;
    }
}

class Preview_section extends Pure_component {
    state = {open: true};
    toggle = ()=>this.setState(prev=>({open: !prev.open}));
    render(){
        return [
            <li key="li" onClick={this.toggle}
              className={classnames('parent', {open: this.state.open})}>
              {this.props.title}
              {!this.state.open ? ` (${this.props.pairs.length})` : ''}
            </li>,
            <ol key="ol"
              className={classnames('children', {open: this.state.open})}>
              {this.props.pairs.map(p=>
                <Header_pair key={p.name} name={p.name} value={p.value}/>
              )}
            </ol>
        ];
    }
}

const Header_pair = ({name, value})=>{
    if (name=='Status Code')
        value = <Status_value value={value}/>;
    return <li className="treeitem">
          <div className="header_name">{name}: </div>
          <div className="header_value">{value}</div>
        </li>;
};

const Status_value = ({value})=>{
    const info = value=='unknown';
    const green = /2../.test(value);
    const yellow = /3../.test(value);
    const red = /(4|5)../.test(value);
    const classes = classnames('small_icon', 'status', {
        info, green, yellow, red});
    return <div className="status_wrapper">
          <div className={classes}/>{value}
        </div>;
};

class Pane_timing extends Pure_component {
    state = {};
    componentDidMount(){
        this.setdb_on('head.recent_stats', stats=>this.setState({stats})); }
    render(){
        const {startedDateTime} = this.props.req;
        const started_at = moment(new Date(startedDateTime)).format(
            'YYYY-MM-DD HH:mm:ss');
        return <div className="timing_view_wrapper">
              <div className="timeline_info">Started at {started_at}</div>
              <ol className="tree_outline">
                {this.props.req.details.timeline.map((timeline, idx)=>
                  <Single_timeline key={idx} timeline={timeline}
                    time={this.props.req.time} req={this.props.req}/>
                )}
              </ol>
              <div className="timeline_info total">
                Total: {this.props.req.time} ms</div>
              {this.props.req.request.url.endsWith('443') &&
                this.state.stats && this.state.stats.ssl_enable &&
                <Enable_https/>
              }
            </div>;
    }
}

class Single_timeline extends Pure_component {
    state = {open: true};
    toggle = ()=>this.setState(prev=>({open: !prev.open}));
    render(){
        const sections = ['Resource Scheduling', 'Request/Response'];
        const perc = [
            {label: 'Queueing', id: 'blocked', section: 0},
            {label: 'Connected', id: 'wait', section: 1},
            {label: 'Response', id: 'receive', section: 1},
        ].reduce((acc, el)=>{
            const cur_time = this.props.timeline[el.id];
            const left = acc.offset;
            const dur = Number((cur_time/this.props.time).toFixed(4));
            const right = 1-acc.offset-dur;
            return {offset: acc.offset+dur, data: [...acc.data,
                {...el, left: `${left*100}%`, right: `${right*100}%`}]};
        }, {offset: 0, data: []}).data
        .reduce((acc, el)=>{
            if (el.section!=acc.last_section)
                return {last_section: el.section, data: [...acc.data, [el]]};
            return {
                last_section: el.section,
                data: [
                    ...acc.data.slice(0, -1),
                    [...acc.data.slice(-1)[0], el],
                ],
            };
        }, {last_section: -1, data: []}).data;
        const children_classes = classnames('children', 'timeline',
            {open: this.state.open});
        return [
            <li key="li" onClick={this.toggle}
              className={classnames('parent', {open: this.state.open})}>
              {this.props.timeline.port}
            </li>,
            <ol key="ol" className={children_classes}>
              <table>
                <colgroup>
                  <col className="labels"/>
                  <col className="bars"/>
                  <col className="duration"/>
                </colgroup>
                <tbody>
                  {perc.map((s, i)=>
                    <Timing_header key={i} title={sections[s[0].section]}>
                    {s.map(p=>
                      <Timing_row title={p.label} id={p.id} left={p.left}
                        key={p.id} right={p.right}
                        time={this.props.timeline[p.id]}/>
                      )}
                    </Timing_header>
                  )}
                </tbody>
              </table>
            </ol>
        ];
    }
}

const Timing_header = ({title, children})=>[
    <tr key="timing_header" className="table_header">
      <td>{title}</td>
      <td></td>
      <td>TIME</td>
    </tr>,
    ...children,
];

const Timing_row = ({title, id, left, right, time})=>
    <tr className="timing_row">
      <td>{title}</td>
      <td>
        <div className="timing_bar_wrapper">
          <span className={classnames('timing_bar', id)} style={{left, right}}>
            &#8203;</span>
        </div>
      </td>
      <td><div className="timing_bar_title">{time} ms</div></td>
    </tr>;

class Enable_https extends Pure_component {
    click = ()=>$('#enable_ssl_modal').modal();
    render(){
        return <div className="footer_link">
              <a className="devtools_link" role="link" tabIndex="0"
                target="_blank" rel="noopener noreferrer"
                onClick={this.click}
                style={{display: 'inline', cursor: 'pointer'}}>
                Enable HTTPS logging
              </a> to view this timeline
            </div>;
    }
}

const is_json_str = str=>{
    let resp;
    try { resp = JSON.parse(str); }
    catch(e){ return false; }
    return resp;
};

class Pane_preview extends Pure_component {
    render(){
        const content_type = this.props.req.details.content_type;
        const text = this.props.req.response.content.text;
        let json;
        if (content_type=='xhr'&&(json = is_json_str(text)))
            return <JSON_viewer json={json}/>;
        if (content_type=='img')
            return <Img_viewer img={this.props.req.request.url}/>;
        if (content_type=='html')
            return <Codemirror_wrapper req={this.props.req}/>;
        return <div className="pane_preview"></div>;
    }
}

const Img_viewer = ({img})=>
    <div className="img_viewer">
      <div className="image">
        <img src={img}/>
      </div>
    </div>;

export default Preview;
