// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import classnames from 'classnames';
import Tooltip from './common/tooltip.js';
import {Checkbox} from './common.js';
import './css/chrome_widgets.less';
import {T} from './common/i18n.js';

export const Toolbar_button = ({id, tooltip, active, href, placement,
    ...props})=>
    <Tooltip title={tooltip} placement={placement||'bottom'}>
      <a className={classnames('toolbar_item toolbar_button', id, {active})}
        onClick={props.on_click||(()=>null)} href={href}>
        <span className={classnames(id, 't_button', 'chrome_icon')}/>
        {props.children}
      </a>
    </Tooltip>;

import {AutoSizer, Table, Column} from 'react-virtualized';
export class Infinite_chrome_table extends Pure_component {
    state = {};
    cell_renderer = function Cell_renderer(props){
        if (props.rowData=='filler')
            return <div className="chrome_td"></div>;
        return <span key={props.rowData.ip}>{props.cellData}</span>;
    };
    select_renderer = function Select_renderer(props){
        if (props.rowData=='filler')
            return <div className="chrome_td"></div>;
        return <Checkbox
          className="checkbox_single"
          checked={this.props.selected_list.includes(props.rowData.ip)}
          on_change={()=>null}
        />;
    };
    toggle_all = ()=>{
        if (this.props.selected_all)
            this.props.unselect_all();
        else
            this.props.select_all();
    };
    cell_data_getter = ({rowData, dataKey})=>rowData[dataKey];
    header_row_renderer = function Header_renderer(props){
        let {className} = props;
        if (props.style.paddingRight)
            className += ' chrome_tr_with_padding';
        return <div role="row" className={className} style={props.style}>
          {props.columns}
        </div>;
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
                        <Table
                          width={width}
                          height={height}
                          onRowClick={this.props.toggle}
                          onHeaderClick={({dataKey})=>dataKey=='select' &&
                            this.toggle_all()}
                          gridClassName="chrome_grid"
                          headerHeight={27}
                          headerClassName="chrome_th"
                          headerRowRenderer={this.header_row_renderer}
                          rowClassName="chrome_tr"
                          rowHeight={22}
                          rowCount={rows.length+1}
                          rowGetter={({index})=>rows[index]||'filler'}
                        >
                          <Column key="select"
                            cellRenderer={this.select_renderer.bind(this)}
                            label={
                              <Checkbox
                                className="checkbox_single"
                                checked={this.props.selected_all}
                                on_change={()=>null}
                              />
                            }
                            dataKey="select"
                            className="chrome_td"
                            flexGrow={0}
                            flexShrink={1}
                            width={40}
                          />
                          {this.props.cols.map(col=>
                            <Column
                              key={col.id}
                              cellDataGetter={this.cell_data_getter}
                              cellRenderer={this.cell_renderer}
                              label={col.title}
                              className="chrome_td"
                              dataKey={col.id}
                              flexGrow={1}
                              width={100}
                            />
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
                selected_all={selected_all}
                toggle_all={toggle_all}
                cols={cols}
              />
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
        placeholder="Filter"
      />
    </div>;
