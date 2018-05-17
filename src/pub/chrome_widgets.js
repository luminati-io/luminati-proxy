// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import Pure_component from '../../www/util/pub/pure_component.js';
import * as Common from './common.js';
import classnames from 'classnames';

export const Toolbar_button = ({id, tooltip, on_click})=>(
    <Tooltip title={tooltip} placement={'bottom'}>
      <div className={classnames('toolbar_item toolbar_button', id)}
        onClick={on_click}>
        <span className={id}/>
      </div>
    </Tooltip>
);

export const Tooltip = props=>
    <Common.Tooltip className="har_tooltip" {...props}/>;

export const Devider = ()=><div className="devider"/>;

export const with_resizable_cols = (cols, Table)=>{
    class Resizable extends Pure_component {
        min_width = 22;
        moving_col = null;
        style = {position: 'relative', display: 'flex', flex: 'auto'};
        state = {};
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
        resize_columns = ()=>{
            const total_width = this.ref.offsetWidth;
            const width = total_width/cols.length;
            const next_cols = cols.map((c, idx)=>({...c, width,
                offset: width*idx}));
            this.setState({cols: next_cols});
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
            return (
                <div style={this.style} ref={this.set_ref}
                  className={classnames({moving: this.state.moving})}>
                  <Table {...this.props} cols={this.state.cols}
                    resize_columns={this.resize_columns}/>
                  <Grid_resizers show start_moving={this.start_moving}
                    cols={this.state.cols}/>
                </div>
            );
        }
    }
    return Resizable;
};

const Grid_resizers = ({cols, start_moving, show})=>{
    if (!show||!cols)
        return null;
    return (
        <div>
          {cols.slice(0, -1).map((c, idx)=>(
            <div key={c.title||idx} style={{left: c.width+c.offset-2}}
              onMouseDown={e=>start_moving(e, idx)}
              className="data_grid_resizer"/>
          ))}
        </div>
    );
};

export const Sort_icon = ({show, dir})=>{
    if (!show)
        return null;
    const classes = classnames('small_icon_mask', {sort_asc: dir==-1,
        sort_desc: dir==1});
    return <div className="sort_icon"><span className={classes}/></div>;
};
