// LICENSE_CODE ZON
'use strict'; /*jslint react:true*/
define(['react', '/util/etask.js', '/util/setdb.js'], (React, etask, setdb)=>{

const LONG_CB_MS = 50;

// XXX krzysztof: copied from android/who/app/components, removed local
// dependency: zerr and event
// XXX arik: need test
class Pure_component extends React.PureComponent {
    constructor(props){
        super(props);
        this.listeners = {};
    }
    componentWillUnmount(){
        let t0 = Date.now();
        if (this.sp)
        {
            this.sp.return();
            delete this.sp;
        }
        for (let l of Object.values(this.listeners))
            setdb.off(l);
        if (this.willUnmount)
            this.willUnmount();
        let t1 = Date.now();
        if (t1-t0 > LONG_CB_MS)
        {
            console.warn('long cb componentWillUnmount %s took %sms',
                this.displayName, t1-t0);
        }
    }
    setdb_on(path, cb){ this.listeners[path] = setdb.on(path, cb); }
    etask(task){
        if (!this.sp)
            this.sp = etask('Component', function*(){ yield this.wait(); });
        this.sp.spawn(task);
    }
    // XXX arik WIP
    setState(updater, cb){
        if (0) // XXX arik: debug feature
        {
            console.log('setState %s %s', this.displayName||'Component',
                Object.keys(updater));
        }
        let t0 = Date.now();
        super.setState(updater, ()=>{
            let t2 = Date.now();
            if (cb)
                cb.apply(this, arguments);
            let t3 = Date.now();
            if (t3-t2 > LONG_CB_MS)
            {
                console.warn('long cb setState %s cb %s took %sms',
                    this.displayName, cb && cb.name, t3-t2);
            }
            if (t3-t0 > LONG_CB_MS)
            {
                console.warn('long cb setState-done %s cb %s took %sms',
                    this.displayName, cb && cb.name, t3-t0);
            }
        });
        let t1 = Date.now();
        if (t1-t0 > LONG_CB_MS)
        {
            console.warn('long cb setState %s took %sms', this.displayName,
                t1-t0);
        }
    }
}

return Pure_component;

});
