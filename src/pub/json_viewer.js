// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import classnames from 'classnames';
import Pure_component from '/www/util/pub/pure_component.js';
import React from 'react';
import './css/json_viewer.less';

const has_children = o=>!!o && typeof o=='object' && Object.keys(o).length;

const Viewer_wrapper = ({json})=>
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
    }  return null;
  DEL
  
};

class Pair extends Pure_component {
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
    // XXX krzysztof: add suport for functions
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

export default Viewer_wrapper;
