// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import classnames from 'classnames';
import Tooltip from './common/tooltip.js';
import {Checkbox} from './common.js';
import './css/chrome_widgets.less';
import {T} from './common/i18n.js';
import zutil from '../../util/util.js';

export const Toolbar_button = ({id, tooltip, active, href, placement,
    ...props})=>
    <Tooltip title={tooltip} placement={placement||'bottom'}>
      <a className={classnames('toolbar_item toolbar_button', id, {active})}
        onClick={props.on_click||(()=>null)} href={href}>
        <span className={classnames(id, 't_button', 'chrome_icon')}/>
        {props.children}
      </a>
    </Tooltip>;

export const Devider = ()=><div className="devider"/>;

export const with_resizable_cols = (cols, Table)=>{
    class Resizable extends Pure_component {
        state = {};
        cols = zutil.clone_deep(cols);
        min_width = 22;
        moving_col = null;
        style = {position: 'relative', display: 'flex', flex: 'auto',
            width: '100%'};
        componentDidMount(){
            this.resize_columns();
            window.document.addEventListener('mousemove', this.on_mouse_move);
            window.document.addEventListener('mouseup', this.on_mouse_up);
        }
        willUnmount(){
            window.document.removeEventListener('mousemove',
                this.on_mouse_move);
            window.document.removeEventListener('mouseup', this.on_mouse_up);
        }
        set_ref = ref=>{ this.ref = ref; };
        show_column = idx=>{
            this.cols[idx].hidden = false;
            this.resize_columns();
        };
        hide_column = idx=>{
            this.cols[idx].hidden = true;
            this.resize_columns();
        };
        resize_columns = ()=>{
            const total_width = this.ref.offsetWidth;
            const resizable_cols = this.cols.filter(c=>!c.hidden&&!c.fixed);
            const total_fixed = this.cols.reduce((acc, c)=>
                acc+(!c.hidden&&c.fixed||0), 0);
            const width = (total_width-total_fixed)/resizable_cols.length;
            const next_cols = this.cols.reduce((acc, c, idx)=>{
                const w = !c.fixed&&width||!c.hidden&&c.fixed||0;
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
            return <div style={style} ref={this.set_ref}
                  className={classnames({moving: this.state.moving})}>
                  <Table {...this.props} cols={this.state.cols}
                    resize_columns={this.resize_columns}
                    show_column={this.show_column}
                    hide_column={this.hide_column}/>
                  <Grid_resizers show={!this.props.cur_preview}
                    start_moving={this.start_moving}
                    cols={this.state.cols}/>
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

export const Sort_icon = ({show, dir})=>{
    if (!show)
        return null;
    const classes = classnames('small_icon_mask', {sort_asc: dir==-1,
        sort_desc: dir==1});
    return <div className="sort_icon"><span className={classes}/></div>;
};


import {AutoSizer, Table, Column} from 'react-virtualized';
export class Infinite_chrome_table extends Pure_component {
    state = {};
    cell_renderer = function Cell_renderer(props){
        if (props.rowData=='filler')
            return <div className="chrome_td"></div>;
        return <span key={props.rowData}>{props.rowData}</span>;
    };
    select_renderer = function Select_renderer(props){
        if (props.rowData=='filler')
            return <div className="chrome_td"></div>;
        return <Checkbox
          checked={this.props.selected_list.includes(props.rowData)}
          on_change={()=>null}/>;
    };
    toggle_all = ()=>{
        if (this.props.selected_all)
            this.props.unselect_all();
        else
            this.props.select_all();
    };
    render(){
        const rows = this.props.rows||[];
        const {class_name, toolbar} = this.props;
        return <div className="chrome">
            <div className="main_panel vbox">
              <Toolbar_container>
                <Toolbar_row>
                  <div className="title_wrapper">{this.props.title}</div>
                </Toolbar_row>
                {toolbar && <Toolbar_row>{toolbar}</Toolbar_row>}
              </Toolbar_container>
              <React.Fragment>
                <div className={classnames('chrome_table vbox', class_name)}>
                  <div className="tables_container header_container hack">
                    <div className="chrome_table">
                      <AutoSizer>
                        {({height, width})=>
                          <Table width={width}
                            height={height}
                            onRowClick={this.props.toggle}
                            onHeaderClick={({dataKey})=>dataKey=='select' &&
                              this.toggle_all()}
                            gridClassName="chrome_grid"
                            headerHeight={27}
                            headerClassName="chrome_th"
                            rowClassName="chrome_tr"
                            rowHeight={22}
                            rowCount={rows.length+1}
                            rowGetter={({index})=>rows[index]||'filler'}>
                            <Column key="select"
                              cellRenderer={this.select_renderer.bind(this)}
                              label={
                                <Checkbox checked={this.props.selected_all}
                                  on_change={()=>null}/>
                              }
                              dataKey="select"
                              className="chrome_td"
                              flexGrow={0}
                              flexShrink={1}
                              width={20}/>
                            {this.props.cols.map(col=>
                              <Column key={col.id}
                                cellRenderer={this.cell_renderer}
                                label={col.title}
                                className="chrome_td"
                                dataKey={col.id}
                                flexGrow={1}
                                width={100}/>
                            )}
                          </Table>
                        }
                      </AutoSizer>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            </div>
          </div>;
    }
}

export class Chrome_table extends Pure_component {
    render(){
        const {selectable, cols, title, children, class_name,
            selected_all, toggle_all} = this.props;
        const classes = classnames('chrome', 'chrome_table', class_name);
        return <div className={classes}>
              <div className="main_panel vbox">
                <Toolbar_container>
                  <Toolbar_row>
                    <div className="title_wrapper">{title}</div>
                  </Toolbar_row>
                </Toolbar_container>
                <div className="tables_container vbox">
                  <Header_container selectable={selectable}
                    selected_all={selected_all} toggle_all={toggle_all}
                    cols={cols}/>
                  <Data_container selectable={selectable} cols={cols}>
                    {children}
                  </Data_container>
                </div>
              </div>
            </div>;
    }
}

const Data_container = ({cols=[], children, selectable})=>{
    return <div className="data_container">
          <table className="chrome_table">
            <colgroup>
              {selectable &&
                <col key="select_all" style={{width: 20}}/>
              }
              {cols.map((c, idx)=>
                <col key={idx} style={{width: c.width}}/>
              )}
            </colgroup>
            <tbody>
              {children}
              <tr className="filler">
                {selectable && <td key="select_filler"/>}
                {cols.map(c=><td key={c.id}></td>)}
              </tr>
            </tbody>
          </table>
        </div>;
};

const Header_container = ({cols, selectable, selected_all, toggle_all})=>
    <div className="header_container">
      <table className="chrome_table">
        <colgroup>
          {selectable && <col key="select_all" style={{width: 20}}/>}
          {(cols||[]).map((c, idx)=><col key={idx} style={{width: c.width}}/>)}
        </colgroup>
        <tbody>
          <tr>
            {selectable &&
              <th key="select_all" onClick={toggle_all}>
                <Checkbox checked={selected_all} readonly/>
              </th>
            }
            {(cols||[]).map((c, idx)=><th key={idx}><T>{c.title}</T></th>)}
          </tr>
        </tbody>
      </table>
    </div>;

export const Toolbar_container = ({children})=>
    <div className="toolbar_container">
      {children}
    </div>;

export const Toolbar_row = ({children})=>
    <div className="toolbar">
      {children}
    </div>;

export const Search_box = ({val, on_change})=>
    <div className="search_box">
      <input value={val}
        onChange={on_change}
        type="text"
        placeholder="Filter"/>
    </div>;
