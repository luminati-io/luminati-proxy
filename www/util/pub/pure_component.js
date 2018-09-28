// LICENSE_CODE ZON
'use strict'; /*jslint node:true, react:true*/
var define;
var is_node = typeof module=='object' && module.exports;
if (is_node)
    define = require('../../../util/require_node.js').define(module, '..');
else
    define = self.define;

define(['react', '/util/etask.js', '/util/setdb.js'], (React, etask, setdb)=>{

const LONG_CB_MS = 100;

// XXX krzysztof: copied from android/who/app/components, removed local
// dependency: zerr and event
// XXX arik: need test
class Pure_component extends React.PureComponent {
    constructor(props){
        super(props);
        this.listeners = {};
        this.comp_name = this.constructor.name;
    }
    componentWillUnmount(){
        let t0 = Date.now();
        if (this.sp)
        {
            this.sp.return();
            delete this.sp;
        }
        // XXX michaelg: 'let of' requires shim with babel+react+ie11
        // requires further investigation, leave as is till 01-Feb-2018
        /*for (let l of Object.values(this.listeners))
            setdb.off(l);*/
        Object.values(this.listeners).forEach(l=>{setdb.off(l);});
        if (this.willUnmount)
            this.willUnmount();
        let t1 = Date.now();
        if (this.debug && t1-t0 > LONG_CB_MS)
        {
            console.warn('long cb componentWillUnmount %s took %sms',
                this.comp_name, t1-t0);
        }
    }
    setdb_on(path, cb, opt){ this.listeners[path] = setdb.on(path, cb, opt); }
    etask(sp){
        if (!this.sp)
            this.sp = etask('Component', function*(){ yield this.wait(); });
        if (sp.constructor.name!='Etask')
            sp = etask(sp);
        this.sp.spawn(sp);
        return sp;
    }
    setState(updater, cb){
        let t0, t1, t2, t3;
        if (this.debug)
        {
            console.log('setState %s %s', this.comp_name,
                Object.keys(updater).join(', '));
            t0 = Date.now();
        }
        super.setState(updater, ()=>{
            t2 = Date.now();
            if (cb)
                cb.apply(this, arguments);
            t3 = Date.now();
            if (this.debug && t3-t2 > LONG_CB_MS)
            {
                console.warn('long cb setState %s cb %s took %sms',
                    this.comp_name, cb && cb.name, t3-t2);
            }
            if (this.debug && t3-t0 > LONG_CB_MS)
            {
                console.warn('long cb setState-done %s cb %s took %sms',
                    this.comp_name, cb && cb.name, t3-t0);
            }
        });
        t1 = Date.now();
        if (this.debug && t1-t0 > LONG_CB_MS)
        {
            console.warn('long cb setState %s took %sms', this.comp_name,
                t1-t0);
        }
    }
}

return Pure_component;

});
