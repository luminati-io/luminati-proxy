// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import classnames from 'classnames';
import Pure_component from '../../www/util/pub/pure_component.js';
import React from 'react';

const has_children = o=>typeof o=='object'&&Object.keys(o).length;

const Viewer_wrapper = ({json})=>(
    <div className="json_viewer">
      <ol className="tree_root">
        <Pair open val={json}/>
      </ol>
    </div>
);

const Children = ({val, expanded})=>{
    if (has_children(val)&&expanded)
    {
        return (
            <ol className="children">
              {Object.entries(val).map(e=>(
                <Pair key={e[0]} label={e[0]} val={e[1]}/>
              ))}
            </ol>
        );
    }
    return null;
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
    return (
        <li className={classes} onClick={toggle}>
          {label ? [
            <span key="name" className="name">{label}</span>,
            <span key="separator" className="separator">: </span>
          ] : null}
          <Value val={val} expanded={expanded}/>
        </li>
    );
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

const get_inline_preview = (val)=>{
    if (Array.isArray(val))
    {
        if (this.json.length>3)
            return `Array[${this.json.length}]`;
        return `[${this.json.map(get_preview).join(', ')}]`;
    }
    else
    {
        const keys = this.keys;
        const narrow_keys = keys.slice(0, 3);
        const kvs = narrow_keys.map(key=>
            `${key}:${get_preview(this.type, this.json[key])}`);
        const ellipsis = keys.length>=3 ?  '…' : '';
        return `{${kvs.join(', ')}${ellipsis}}`;
    }
};

const get_value_preview = (type, object, value)=>{
    if (type=='null'||type=='undefined')
        return type;
    if (type=='string'||type=='stringifiable')
        value = '"'+value.replace('"', '\"')+'"';
    if (type=='function')
    {
        // Remove content of the function
        return object.toString()
            .replace(/[\r\n]/g, '').replace(/\{.*\}/, '')+'{…}';
    }
    return value;
};

const get_preview = (type, object)=>{
    let value = '';
    if (typeof object=='object')
    {
        value = get_object_name(object);
        if (Array.isArray(object))
            value += '[' + object.length + ']';
    }
    else
        value = get_value_preview(type, object, object);
    return value;
};

const get_object_name = object=>{
    if (object===undefined)
        return '';
    if (object===null)
        return 'Object';
    if (typeof object=='object' && !object.constructor)
        return 'Object';
};

export default Viewer_wrapper;
