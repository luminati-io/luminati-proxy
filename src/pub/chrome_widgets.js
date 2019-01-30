// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '/www/util/pub/pure_component.js';
import * as Common from './common.js';
import classnames from 'classnames';
import _ from 'lodash';

export const Toolbar_button = ({id, tooltip, on_click, active, href})=>
    <Tooltip title={tooltip} placement={'bottom'}>
      <a className={classnames('toolbar_item toolbar_button', id, {active})}
        onClick={on_click||(()=>null)} href={href}>
        <span className={id}/>
      </a>
    </Tooltip>;

export const Tooltip = props=>
    <Common.Tooltip className="har_tooltip" {...props}/>;

export const Devider = ()=><div className="devider"/>;

export const with_resizable_cols = (cols, Table)=>{
    class Resizable extends Pure_component {
        state = {};
        cols = _.cloneDeep(cols);
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
            return <div style={this.style} ref={this.set_ref}
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

export class Chrome_table extends Pure_component {
    state = {};
    componentDidMount(){
        const _this = this;
        this.etask(function*(){
            this.on('uncaught', e=>console.error(e));
            const data = yield _this.props.fetch_data();
            _this.setState({data});
        });
    }
    render(){
        const {cols, title, children} = this.props;
        return <div className="chrome chrome_table">
              <div className="main_panel vbox">
                <div className="toolbar_container">
                  <div className="toolbar">
                    <div className="title_wrapper">{title}</div>
                  </div>
                </div>
                  <div className="tables_container vbox">
                    <Header_container cols={cols}/>
                    <Data_container cols={cols} data={this.state.data}>
                      {children}
                    </Data_container>
                  </div>
              </div>
            </div>;
    }
}

const Data_container = ({cols=[], data=[], children})=>{
    return <div className="data_container">
          <table>
            <colgroup>
              {cols.map((c, idx)=>
                <col key={idx} style={{width: c.width}}/>
              )}
            </colgroup>
            <tbody>
              {data.map(children)}
              <tr className="filler">
                {cols.map(c=><td key={c.id}></td>)}
              </tr>
            </tbody>
          </table>
        </div>;
};

const Header_container = ({cols})=>
    <div className="header_container">
      <table>
        <colgroup>
          {(cols||[]).map((c, idx)=><col key={idx} style={{width: c.width}}/>)}
        </colgroup>
        <tbody>
          <tr>
            {(cols||[]).map((c, idx)=><th key={idx}>{c.title}</th>)}
          </tr>
        </tbody>
      </table>
    </div>;
