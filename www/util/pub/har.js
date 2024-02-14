// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
define(['react', 'jquery', 'classnames', '/www/util/pub/pure_component.js',
    '/util/util.js', '/util/setdb.js', '/www/util/pub/tooltip.js'],
    function(React, $, classnames, Pure_component, zutil,
    setdb, Tooltip)
{

const E = {};

// XXX krzysztof: temporarily copied from chrome_widgets
const Toolbar_button = ({id, tooltip, active, href, placement, ...props})=>
    <a className={classnames('toolbar_item toolbar_button', id, {active})}
      onClick={props.on_click||(()=>null)} href={href}
    >
      <Tooltip title={tooltip}>
        <span className={classnames(id, 't_button', 'chrome_icon')}/>
      </Tooltip>
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

const Pane_info = ({children})=>
    <div className="empty_view">
      <div className="block">{children}</div>
    </div>;
E.Pane_info = Pane_info;

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

const Img_viewer = ({img})=>
    <div className="img_viewer">
      <div className="image">
        <img src={img}/>
      </div>
    </div>;
E.Img_viewer = Img_viewer;

const has_children = o=>!!o && typeof o=='object' && Object.keys(o).length;

const JSON_viewer = ({json})=>
    <div className="json_viewer">
      <ol className="tree_root">
        <Pair open val={json}/>
      </ol>
    </div>;
E.JSON_viewer = JSON_viewer;

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
                Waypoint={this.props.Waypoint}
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
              only_name={!!this.props.cur_preview}
            />
            <Data_container
              Cell_value={this.props.Cell_value}
              cols={this.props.cols}
              reqs={this.props.reqs}
              handle_viewpoint_enter={this.props.handle_viewpoint_enter}
              focused={this.state.focused}
              cur_preview={this.props.cur_preview}
              open_preview={this.props.open_preview}
              Waypoint={this.props.Waypoint}
            />
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
        const Waypoint = this.props.Waypoint;
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
          {Waypoint &&
            <Waypoint
              key={reqs.length}
              scrollableAncestor={this.dc.current}
              bottomOffset="-50px"
              onEnter={this.props.handle_viewpoint_enter}
            />
          }
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
