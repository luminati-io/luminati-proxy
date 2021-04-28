// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
define(['react', 'jquery', 'moment', 'classnames', 'react-router-dom',
    'react-waypoint', '/www/util/pub/pure_component.js', '/util/util.js',
    '/util/setdb.js', 'codemirror/lib/codemirror',
    // unnamed imports below
    'codemirror/mode/javascript/javascript', 'codemirror/lib/codemirror.css',
    'codemirror/mode/htmlmixed/htmlmixed', './css/har.less'],
    function(React, $, moment, classnames, {withRouter}, {Waypoint},
    Pure_component, zutil, setdb, codemirror){

const E = {};

// XXX krzysztof: temporarily copied from chrome_widgets
const Toolbar_button = ({id, tooltip, active, href, placement, ...props})=>
    <a className={classnames('toolbar_item toolbar_button', id, {active})}
      onClick={props.on_click||(()=>null)} href={href}
    >
      <span className={classnames(id, 't_button', 'chrome_icon')}/>
      {props.children}
    </a>;

class Preview extends Pure_component {
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
        const Pane_content = this.props.panes[this.state.cur_pane];
        const req = this.props.cur_preview;
        return <div style={this.props.style} className="har_preview chrome">
          <div className="tabbed_pane_header">
            <div className="left_pane">
              <div onClick={this.props.close}
                className="close_btn_wrapper">
                <div className="small_icon close_btn"/>
                <div className="medium_icon close_btn_h"/>
              </div>
            </div>
            <div className="right_panes">
              {this.props.panes.map((p, idx)=>
                <Pane
                  key={p.id}
                  width={p.width}
                  id={p.id}
                  idx={idx}
                  on_click={this.select_pane}
                  active={this.state.cur_pane==idx}
                />
              )}
              <Pane_slider panes={this.props.panes}
                cur_pane={this.state.cur_pane}/>
            </div>
          </div>
          <div className="tabbed_pane_content">
            <Pane_content key={req.uuid} req={req}/>
          </div>
        </div>;
    }
}
E.Preview = Preview;

const Pane = ({id, idx, width, on_click, active})=>{
    return <div onClick={()=>on_click(idx)} style={{width}}
      className={classnames('pane', id, {active})}>
      <span>{id}</span>
    </div>;
};

const Pane_slider = ({panes, cur_pane})=>{
    const slider_class = classnames('pane_slider');
    const offset = panes.slice(0, cur_pane).reduce((acc, e)=>acc+e.width, 0);
    const slider_style = {
        width: panes[cur_pane].width,
        transform: `translateX(${offset+24}px)`,
    };
    return <div className={slider_class} style={slider_style}/>;
};

// XX krzysztof: import from util
const Copy_btn = ()=>null;

E.Pane_headers = class Pane_headers extends Pure_component {
    get_curl = ()=>{
        const req = this.props.req;
        const {username, password, super_proxy} = req.details;
        const headers = req.request.headers.map(h=>`-H "${h.name}: `
            +`${h.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
        const proxy = super_proxy ?
            '-x '+(username||'')+':'+(password||'')+'@'+super_proxy : '';
        const url = '"'+req.request.url+'"';
        return ['curl', proxy, '-X', req.request.method, url, ...headers]
            .filter(Boolean).join(' ');
    };
    render(){
        const req = this.props.req;
        const general_entries = [
            {name: 'Request URL', value: req.request.url},
            {name: 'Request method', value: req.request.method},
            {name: 'Status code', value: req.response.status},
            {name: 'Super proxy IP', value: req.details.super_proxy},
            {name: 'Peer proxy IP', value: req.details.proxy_peer},
            {name: 'Username', value: req.details.username},
            {name: 'Password', value: req.details.password},
            {name: 'Sent from', value: req.details.remote_address},
        ].filter(e=>e.value!==undefined);
        return <React.Fragment>
         <Copy_btn
           val={this.get_curl()}
           title="Copy as cURL"
           style={{position: 'absolute', right: 5, top: 5}}
           inner_style={{width: 'auto'}}
         />
         <ol className="tree_outline">
           <Preview_section title="General"
             pairs={general_entries}/>
           <Preview_section title="Response headers"
             pairs={req.response.headers}/>
           <Preview_section title="Request headers"
             pairs={req.request.headers}/>
           <Body_section title="Request body"
             body={req.request.postData && req.request.postData.text}/>
          </ol>
        </React.Fragment>;
    }
};
E.Pane_headers.width = 65;
E.Pane_headers.id = 'headers';

E.Pane_response = class Pane_response extends Pure_component {
    render(){
        const req = this.props.req;
        const {port, content_type} = req.details;
        if (content_type=='unknown')
            return <Encrypted_response_data port={port}/>;
        if (!content_type||['xhr', 'css', 'js', 'font', 'html', 'other']
            .includes(content_type))
        {
            return <Codemirror_wrapper req={req}/>;
        }
        return <No_response_data/>;
    }
};
E.Pane_response.width = 72;
E.Pane_response.id = 'response';

const Encrypted_response_data = withRouter(
class Encrypted_response_data extends Pure_component {
    goto_ssl = ()=>{
        this.props.history.push({
            pathname: `/proxy/${this.props.port}`,
            state: {field: 'ssl'},
        });
    };
    render(){
        return <Pane_info>
          <div>This request is using SSL encryption.</div>
          <div>
            <span>You need to turn on </span>
            <a className="link" onClick={this.goto_ssl}>
              SSL analyzing</a>
            <span> to read the response here.</span>
          </div>
        </Pane_info>;
    }
});

E.Pane_timing = class Pane_timing extends Pure_component {
    state = {};
    componentDidMount(){
        this.setdb_on('head.recent_stats', stats=>this.setState({stats}));
    }
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
            <Enable_https port={this.props.req.details.port}/>
          }
        </div>;
    }
};
E.Pane_timing.width = 57;
E.Pane_timing.id = 'timing';

const Pane_info = ({children})=>
    <div className="empty_view">
      <div className="block">{children}</div>
    </div>;
E.Pane_info = Pane_info;

const No_response_data = ()=>
    <div className="empty_view">
      <div className="block">This request has no response data available.</div>
    </div>;

class Codemirror_wrapper extends Pure_component {
    componentDidMount(){
        this.cm = codemirror.fromTextArea(this.textarea, {
            readOnly: true,
            lineNumbers: true,
        });
        this.cm.setSize('100%', '100%');
        let text = this.props.req.response.content.text||'';
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

class Body_section extends Pure_component {
    state = {open: true};
    toggle = ()=>this.setState(prev=>({open: !prev.open}));
    render(){
        if (!this.props.body)
            return null;
        let json;
        let raw_body;
        try { json = JSON.parse(this.props.body); }
        catch(e){ raw_body = this.props.body; }
        return [
            <li key="li" onClick={this.toggle}
              className={classnames('parent_title', 'expandable',
              {open: this.state.open})}>
              {this.props.title}
            </li>,
            <ol key="ol"
              className={classnames('children', {open: this.state.open})}>
              {!!json && <JSON_viewer json={json}/>}
              {!!raw_body && <Header_pair name="raw-data" value={raw_body}/>}
            </ol>,
        ];
    }
}

class Preview_section extends Pure_component {
    state = {open: true};
    toggle = ()=>this.setState(prev=>({open: !prev.open}));
    render(){
        if (!this.props.pairs||!this.props.pairs.length)
            return null;
        return [
            <li key="li" onClick={this.toggle}
              className={classnames('parent_title', 'expandable',
              {open: this.state.open})}>
              {this.props.title}
              {!this.state.open ? ` (${this.props.pairs.length})` : ''}
            </li>,
            <ol key="ol"
              className={classnames('children', {open: this.state.open})}>
              {this.props.pairs.map(p=>
                <Header_pair key={p.name} name={p.name} value={p.value}/>
              )}
            </ol>,
        ];
    }
}

const Header_pair = ({name, value})=>{
    if (name=='Status code')
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
    const red = /(canceled)|([45]..)/.test(value);
    const classes = classnames('small_icon', 'status', {
        info, green, yellow, red});
    return <div className="status_wrapper">
      <div className={classes}/>{value}
    </div>;
};

class Single_timeline extends Pure_component {
    state = {open: true};
    toggle = ()=>this.setState(prev=>({open: !prev.open}));
    render(){
        const sections = ['Resource Scheduling', 'Request/Response'];
        const perc = [
            {label: 'Queueing', id: 'blocked', section: 0},
            {label: 'Connected', id: 'wait', section: 1},
            {label: 'Time to first byte', id: 'ttfb', section: 1},
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
        const {timeline} = this.props;
        return [
            <li key="li" onClick={this.toggle}
              className={classnames('parent_title', 'expandable',
              {open: this.state.open})}>
              Proxy port: {timeline.port}, session: {timeline.session}
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
                        <Timing_row
                          title={p.label}
                          id={p.id}
                          left={p.left}
                          key={p.id}
                          right={p.right}
                          time={this.props.timeline[p.id]}
                        />
                      )}
                    </Timing_header>
                  )}
                </tbody>
              </table>
            </ol>,
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

const Enable_https = withRouter(props=>{
    const click = ()=>{
        props.history.push({
            pathname: `/proxy/${props.port}`,
            state: {field: 'ssl'},
        });
    };
    return <div className="footer_link">
      <a className="devtools_link"
        role="link"
        tabIndex="0"
        target="_blank"
        rel="noopener noreferrer"
        onClick={click}
        style={{display: 'inline', cursor: 'pointer'}}
      >
        Enable HTTPS logging
      </a> to view this timeline
    </div>;
});

const is_json_str = str=>{
    let resp;
    try { resp = JSON.parse(str); }
    catch(e){ return false; }
    return resp;
};

E.Pane_preview = class Pane_preview extends Pure_component {
    render(){
        const content_type = this.props.req.details.content_type;
        const text = this.props.req.response.content.text;
        const port = this.props.req.details.port;
        let json;
        if (content_type=='unknown')
            return <Encrypted_response_data port={port}/>;
        if (content_type=='xhr' && (json = is_json_str(text)))
            return <JSON_viewer json={json}/>;
        if (content_type=='img')
            return <Img_viewer img={this.props.req.request.url}/>;
        if (content_type=='html')
            return <Codemirror_wrapper req={this.props.req}/>;
        return <div className="pane_preview"></div>;
    }
};
E.Pane_preview.width = 63;
E.Pane_preview.id = 'preview';

const Img_viewer = ({img})=>
    <div className="img_viewer">
      <div className="image">
        <img src={img}/>
      </div>
    </div>;

const has_children = o=>!!o && typeof o=='object' && Object.keys(o).length;

const JSON_viewer = ({json})=>
    <div className="json_viewer">
      <ol className="tree_root">
        <Pair open val={json}/>
      </ol>
    </div>;

const Children = ({val, expanded})=>{
    if (has_children(val) && expanded)
    {
        return <ol className="tree_children">
          {Object.entries(val).map(e=>
            <Pair key={e[0]} label={e[0]} val={e[1]}/>
          )}
        </ol>;
    }
    return null;
};

class Pair extends React.PureComponent {
    state = {expanded: this.props.open};
    toggle = ()=>{ this.setState(prev=>({expanded: !prev.expanded})); };
    render(){
        const {label, val} = this.props;
        return [
            <Tree_item
              expanded={this.state.expanded}
              label={label}
              val={val}
              toggle={this.toggle}
              key="tree_item"/>,
            <Children val={val} expanded={this.state.expanded} key="val"/>,
        ];
    }
}

const Tree_item = ({label, val, expanded, toggle})=>{
    const classes = classnames('tree_item', {
        parent: has_children(val),
        expanded,
    });
    return <li className={classes} onClick={toggle}>
          {label ? [
            <span key="name" className="name">{label}</span>,
            <span key="separator" className="separator">: </span>
          ] : null}
          <Value val={val} expanded={expanded}/>
        </li>;
};

const Value = ({val})=>{
    if (typeof val=='object')
        return <Value_object val={val}/>;
    else if (typeof val=='number')
        return <span className="value number">{val}</span>;
    else if (typeof val=='boolean')
        return <span className="value boolean">{val.toString()}</span>;
    else if (typeof val=='string')
        return <span className="value string">"{val}"</span>;
    else if (typeof val=='undefined')
        return <span className="value undefined">"{val}"</span>;
    else if (typeof val=='function')
        return null;
};

const Value_object = ({val})=>{
    if (val===null)
        return <span className="value null">null</span>;
    if (Array.isArray(val))
    {
        if (!val.length)
            return <span className="value array empty">[]</span>;
        return <span className="value array long">[,...]</span>;
    }
    if (!Object.keys(val).length)
        return <span className="value object empty">{'{}'}</span>;
    return <span className="value object">{JSON.stringify(val)}</span>;
};

const with_resizable_cols = Table=>{
    class Resizable extends React.PureComponent {
        constructor(props){
            super(props);
            this.state = {};
            this.cols = zutil.clone_deep(this.props.table_cols);
            this.min_width = 22;
            this.moving_col = null;
            this.style = {
                position: 'relative',
                display: 'flex',
                flex: 'auto',
                width: '100%',
            };
        }
        componentDidMount(){
            this.resize_columns();
            window.document.addEventListener('mousemove', this.on_mouse_move);
            window.document.addEventListener('mouseup', this.on_mouse_up);
        }
        componentWillUnmount(){
            window.document.removeEventListener('mousemove',
                this.on_mouse_move);
            window.document.removeEventListener('mouseup', this.on_mouse_up);
        }
        set_ref = ref=>{ this.ref = ref; };
        resize_columns = ()=>{
            const total_width = this.ref.offsetWidth;
            const resizable_cols = this.cols.filter(c=>!c.hidden && !c.fixed);
            const total_fixed = this.cols.reduce((acc, c)=>
                acc+(!c.hidden && c.fixed || 0), 0);
            const width = (total_width-total_fixed)/resizable_cols.length;
            const next_cols = this.cols.reduce((acc, c, idx)=>{
                const w = !c.fixed && width||!c.hidden && c.fixed || 0;
                return {
                    cols: [...acc.cols, {
                        ...c,
                        width: w,
                        offset: acc.offset,
                        border: acc.border,
                    }],
                    offset: acc.offset+w,
                    border: !!w,
                };
            }, {cols: [], offset: 0, border: true});
            this.setState({cols: next_cols.cols});
        };
        start_moving = (e, idx)=>{
            if (e.nativeEvent.which!=1)
                return;
            this.start_offset = e.pageX;
            this.start_width = this.state.cols[idx].width;
            this.start_width_last = this.state.cols.slice(-1)[0].width;
            this.moving_col = idx;
            this.setState({moving: true});
        };
        on_mouse_move = e=>{
            if (this.moving_col===null)
                return;
            this.setState(prev=>{
                let offset = e.pageX-this.start_offset;
                if (this.start_width_last-offset<this.min_width)
                    offset = this.start_width_last-this.min_width;
                if (this.start_width+offset<this.min_width)
                    offset = this.min_width-this.start_width;
                let total_width = 0;
                const next_cols = prev.cols.map((c, idx)=>{
                    if (idx<this.moving_col)
                    {
                        total_width = total_width+c.width;
                        return c;
                    }
                    else if (idx==this.moving_col)
                    {
                        const width = this.start_width+offset;
                        total_width = total_width+width;
                        return {...c, width, offset: total_width-width};
                    }
                    else if (idx==this.state.cols.length-1)
                    {
                        const width = this.start_width_last-offset;
                        return {...c, width, offset: total_width};
                    }
                    total_width = total_width+c.width;
                    return {...c, offset: total_width-c.width};
                });
                return {cols: next_cols};
            });
        };
        on_mouse_up = ()=>{
            this.moving_col = null;
            this.setState({moving: false});
        };
        render(){
            const style = Object.assign({}, this.style, this.props.style||{});
            return <div
              style={style}
              ref={this.set_ref}
              className={classnames({moving: this.state.moving})}
            >
              <Table {...this.props}
                cols={this.state.cols}
                resize_columns={this.resize_columns}
              />
              <Grid_resizers show={!this.props.cur_preview}
                start_moving={this.start_moving}
                cols={this.state.cols}
              />
            </div>;
        }
    }
    return Resizable;
};

const Grid_resizers = ({cols, start_moving, show})=>{
    if (!show||!cols)
        return null;
    return <div>
      {cols.slice(0, -1).map((c, idx)=>
        !c.fixed &&
          <div key={c.title||idx} style={{left: c.width+c.offset-2}}
            onMouseDown={e=>start_moving(e, idx)}
            className="data_grid_resizer"/>
      )}
    </div>;
};

const Search_box = ({val, on_change})=>
    <div className="search_box">
      <input value={val}
        onChange={on_change}
        type="text"
        placeholder="Filter"
      />
    </div>;

const Toolbar_row = ({children})=>
    <div className="toolbar">
      {children}
    </div>;

const Toolbar_container = ({children})=>
    <div className="toolbar_container">
      {children}
    </div>;

const Sort_icon = ({show, dir})=>{
    if (!show)
        return null;
    const classes = classnames('small_icon_mask', {
        sort_asc: dir==-1,
        sort_desc: dir==1,
    });
    return <div className="sort_icon"><span className={classes}/></div>;
};

const Devider = ()=><div className="devider"/>;

class Har_viewer extends Pure_component {
    moving_width = false;
    min_width = 50;
    state = {
        cur_preview: null,
        tables_width: 200,
    };
    componentDidMount(){
        window.document.addEventListener('mousemove', this.on_mouse_move);
        window.document.addEventListener('mouseup', this.on_mouse_up);
    }
    willUnmount(){
        window.document.removeEventListener('mousemove', this.on_mouse_move);
        window.document.removeEventListener('mouseup', this.on_mouse_up);
    }
    open_preview = req=>this.setState({cur_preview: req});
    close_preview = ()=>this.setState({cur_preview: null});
    start_moving_width = e=>{
        if (e.nativeEvent.which!=1)
            return;
        this.moving_width = true;
        $(this.main_panel).addClass('moving');
        this.start_offset = e.pageX;
        this.start_width = this.state.tables_width;
    };
    on_resize_width = e=>{
        const offset = e.pageX-this.start_offset;
        let new_width = this.start_width+offset;
        if (new_width<this.min_width)
            new_width = this.min_width;
        const max_width = this.main_panel.offsetWidth-this.min_width;
        if (new_width>max_width)
            new_width = max_width;
        this.setState({tables_width: new_width});
    };
    on_mouse_move = e=>{
        if (this.moving_width)
            this.on_resize_width(e);
    };
    on_mouse_up = ()=>{
        this.moving_width = false;
        $(this.main_panel).removeClass('moving');
    };
    set_main_panel_ref = ref=>{ this.main_panel = ref; };
    main_panel_moving = ()=>{ $(this.main_panel).addClass('moving'); };
    main_panel_stopped_moving = ()=>{
        $(this.main_panel).removeClass('moving'); };
    undock = ()=>{
        if (this.props.dock_mode)
            return;
        const url = '/dock_logs';
        const opts = 'directories=0,titlebar=0,toolbar=0,location=0,'
        +'status=0,menubar=0,scrollbars=0,resizable=0,height=500,'
        +'width=800';
        const har_window = window.open(url, 'har_window', opts);
        if (window.focus)
            har_window.focus();
    };
    clear = ()=>{
        this.props.clear_logs(()=>{
            this.close_preview();
            setdb.emit_path('head.har_viewer.reset_reqs');
        });
    };
    render(){
        if (!this.props.proxies)
            return null;
        const width = `calc(100% - ${this.state.tables_width}px`;
        const preview_style = {maxWidth: width, minWidth: width};
        return <div id="har_viewer" className="har_viewer chrome">
          <div className="main_panel vbox" ref={this.set_main_panel_ref}>
            {this.props.toolbar &&
              <Toolbar
                undock={this.undock}
                clear={this.clear}
                dock_mode={this.props.dock_mode}
                filters={this.props.filters}
                set_filter={this.props.set_filter}
                type_filter={this.props.type_filter}
                set_type_filter={this.props.set_type_filter}
                on_change_search={this.props.on_change_search}
                search_val={this.props.search}
                disable_logs={this.props.disable_logs}
              />
            }
            <div className="split_widget vbox flex_auto">
              <Tables_container
                Cell_value={this.props.Cell_value}
                table_cols={this.props.table_cols}
                main_panel_moving={this.main_panel_moving}
                main_panel_stopped_moving=
                  {this.main_panel_stopped_moving}
                main_panel={this.main_panel}
                open_preview={this.open_preview}
                width={this.state.tables_width}
                cur_preview={this.state.cur_preview}
                set_sort={this.props.set_sort}
                sorted={this.props.sorted}
                reqs={this.props.reqs}
                handle_viewpoint_enter={this.props.handle_viewpoint_enter}
              />
              <Preview
                panes={this.props.panes}
                cur_preview={this.state.cur_preview}
                style={preview_style}
                close={this.close_preview}
              />
              <Tables_resizer show={!!this.state.cur_preview}
                start_moving={this.start_moving_width}
                offset={this.state.tables_width}
              />
            </div>
          </div>
        </div>;
    }
}
E.Har_viewer = Har_viewer;

class Toolbar extends Pure_component {
    state = {filters_visible: false};
    toggle_filters = ()=>
        this.setState({filters_visible: !this.state.filters_visible});
    render(){
        return <Toolbar_container>
          <Toolbar_row>
            <Toolbar_button id="clear"
              tooltip="Clear"
              on_click={this.props.clear}
            />
            {!this.props.dock_mode &&
              <Toolbar_button id="docker"
                on_click={this.props.undock}
                tooltip="Undock into separate window"
              />
            }
            <Toolbar_button id="filters"
              tooltip="Show/hide filters"
              on_click={this.toggle_filters}
              active={this.state.filters_visible}
            />
            <Toolbar_button id="download"
              tooltip="Export as HAR file"
              href="/api/logs_har"
            />
            <Toolbar_button id="close_btn"
              tooltip="Disable"
              placement="left"
              on_click={this.props.disable_logs}
            />
          </Toolbar_row>
          {this.state.filters_visible &&
            <Toolbar_row>
              <Search_box
                val={this.props.search_val}
                on_change={this.props.on_change_search}
              />
              <Type_filters
                filter={this.props.type_filter}
                set={this.props.set_type_filter}
              />
              <Devider/>
              <Filters
                set_filter={this.props.set_filter}
                filters={this.props.filters}
              />
            </Toolbar_row>
          }
        </Toolbar_container>;
    }
}

class Filters extends Pure_component {
    state = {};
    componentDidMount(){
        this.setdb_on('head.logs_suggestions', suggestions=>{
            suggestions && this.setState({suggestions});
        });
    }
    render(){
        if (!this.state.suggestions)
            return null;
        const filters = [
            {
                name: 'port',
                default_value: 'All proxy ports',
            },
            {
                name: 'status_code',
                default_value: 'All status codes',
            },
            {
                name: 'protocol',
                default_value: 'All protocols',
            },
        ];
        return <div className="filters">
          {filters.map(f=>
            <Filter key={f.name}
              vals={this.state.suggestions[f.name+'s']}
              val={this.props.filters[f.name]}
              set={this.props.set_filter.bind(null, f.name)}
              default_value={f.default_value}
            />
          )}
        </div>;
    }
}

const Filter = ({vals, val, set, default_value, format_text})=>
   <div className="custom_filter">
     <select value={val} onChange={set}>
       <option value="">{default_value}</option>
       {vals.map(p=>
         <option key={p} value={p}>
           {format_text ? format_text(p) : p}
         </option>
       )}
     </select>
     <span className="arrow"/>
   </div>;
E.Filter = Filter;

const type_filters = ['XHR', 'HTML', 'JS', 'CSS', 'Img', 'Media', 'Font',
    'Other'];
const Type_filters = ({filter, set})=>
    <div className="filters">
      <Type_filter name="All" on_click={set.bind(null, 'All')} cur={filter}/>
      <Devider/>
      {type_filters.map(f=>
        <Type_filter
          on_click={set.bind(null, f)}
          key={f}
          name={f}
          cur={filter}
        />
      )}
    </div>;

const Type_filter = ({name, cur, on_click})=>
    <div className={classnames('filter', {active: cur==name})}
      onClick={on_click}>
      {name}
    </div>;

const Tables_resizer = ({show, offset, start_moving})=>{
    if (!show)
        return null;
    return <div className="data_grid_resizer"
      style={{left: offset-2}}
      onMouseDown={start_moving}
    />;
};

const Tables_container = with_resizable_cols(
class Tables_container extends Pure_component {
    constructor(props){
        super(props);
        this.state = {focused: false};
    }
    componentDidUpdate(prev_props){
        if (prev_props.cur_preview!=this.props.cur_preview)
            this.props.resize_columns();
    }
    componentDidMount(){
        window.addEventListener('resize', this.props.resize_columns);
    }
    willUnmount(){
        window.removeEventListener('resize', this.props.resize_columns);
    }
    on_focus = ()=>this.setState({focused: true});
    on_blur = ()=>this.setState({focused: false});
    on_mouse_up = ()=>{
        this.moving_col = null;
        this.props.main_panel_stopped_moving();
    };
    render(){
        const style = {};
        if (this.props.cur_preview)
        {
            style.flex = `0 0 ${this.props.width}px`;
            style.width = this.props.width;
            style.maxWidth = this.props.width;
        }
        return <div className="tables_container vbox"
          tabIndex="-1"
          style={style}
          onFocus={this.on_focus}
          onBlur={this.on_blur}>
          <div className="reqs_container">
            <Header_container
              cols={this.props.cols}
              reqs={this.props.reqs}
              set_sort={this.props.set_sort}
              sorted={this.props.sorted}
              only_name={!!this.props.cur_preview}/>
            <Data_container
              Cell_value={this.props.Cell_value}
              cols={this.props.cols}
              reqs={this.props.reqs}
              handle_viewpoint_enter={this.props.handle_viewpoint_enter}
              focused={this.state.focused}
              cur_preview={this.props.cur_preview}
              open_preview={this.props.open_preview}/>
          </div>
        </div>;
    }
});

class Header_container extends Pure_component {
    click = col=>{
        this.props.set_sort(col.sort_by);
    };
    render(){
        let {cols, only_name, sorted} = this.props;
        if (!cols)
            return null;
        if (only_name)
            cols = [cols[1]];
        return <div className="header_container">
          <table className="chrome_table">
            <colgroup>
              {cols.map((c, idx)=>
                <col key={c.title}
                  style={{width: only_name||idx==cols.length-1 ?
                    'auto' : c.width}}
                />
              )}
            </colgroup>
            <tbody>
              <tr>
                {cols.map(c=>
                  <th key={c.title} onClick={()=>this.click(c)}
                    style={{textAlign: only_name ? 'left' : null}}>
                    <div>{c.title}</div>
                    <Sort_icon show={c.sort_by==sorted.field}
                      dir={sorted.dir}/>
                  </th>
                )}
              </tr>
            </tbody>
          </table>
        </div>;
    }
}

class Data_container extends Pure_component {
    componentDidMount(){
        this.setdb_on('head.har_viewer.dc_top', ()=>{
            if (this.dc.current)
                this.dc.current.scrollTop = 0;
        });
    }
    dc = React.createRef();
    render(){
        let {cols, open_preview, cur_preview, focused, reqs} = this.props;
        const preview_mode = !!cur_preview;
        cols = (cols||[]).map((c, idx)=>{
            if (!preview_mode)
                return c;
            if (preview_mode && idx==1)
                return {...c, width: 'auto'};
            return {...c, width: 0};
        });
        return <div ref={this.dc} className="data_container">
          <table className="chrome_table">
            <colgroup>
              {cols.map((c, idx)=>
                <col key={c.title}
                  style={{width: !preview_mode && idx==cols.length-1 ?
                    'auto': c.width}}
                />
              )}
            </colgroup>
            <Data_rows
              Cell_value={this.props.Cell_value}
              reqs={reqs}
              cols={cols}
              open_preview={open_preview}
              cur_preview={cur_preview}
              focused={focused}
            />
          </table>
          <Waypoint key={reqs.length}
            scrollableAncestor={this.dc.current}
            bottomOffset="-50px"
            onEnter={this.props.handle_viewpoint_enter}
          />
        </div>;
    }
}

class Data_rows extends React.Component {
    shouldComponentUpdate(next_props){
        return next_props.reqs!=this.props.reqs ||
            next_props.cur_preview!=this.props.cur_preview ||
            next_props.focused!=this.props.focused;
    }
    render(){
        return <tbody>
          {this.props.reqs.map(r=>
            <Data_row
              Cell_value={this.props.Cell_value}
              cols={this.props.cols}
              key={r.uuid}
              open_preview={this.props.open_preview}
              cur_preview={this.props.cur_preview}
              focused={this.props.focused}
              req={r}
            />
          )}
          <tr className="filler">
            {this.props.cols.map(c=><td key={c.title}/>)}
          </tr>
        </tbody>;
    }
}

class Data_row extends React.Component {
    shouldComponentUpdate(next_props){
        const selected = zutil.get(this.props.cur_preview, 'uuid')==
            this.props.req.uuid;
        const will_selected = zutil.get(next_props.cur_preview, 'uuid')==
            next_props.req.uuid;
        const selection_changed = selected!=will_selected;
        const focused_changed = this.props.focused!=next_props.focused;
        const pending_changed = this.props.req.pending!=next_props.req.pending;
        return selection_changed || focused_changed && selected ||
            pending_changed;
    }
    cell_clicked = ()=>{
        this.props.open_preview(this.props.req);
    };
    render(){
        const {cur_preview, cols, focused, req} = this.props;
        const selected = zutil.get(cur_preview, 'uuid')==req.uuid;
        const classes = classnames({
            selected,
            focused: selected && focused,
            error: !req.details.success && !req.pending,
            pending: !!req.pending,
        });
        return <tr className={classes}>
          {cols.map((c, idx)=>
            <td key={c.title} onClick={this.cell_clicked}>
              <this.props.Cell_value col={c.title} req={req}/>
            </td>
          )}
        </tr>;
    }
}

return E;

});
