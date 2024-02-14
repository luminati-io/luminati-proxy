// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import {Tab} from 'uikit';
import classnames from 'classnames';
import '../css/tab_group.less';

const Tab_group = props=>{
    const {on_click, tabs, selected, variant='main', wide} = props;
    const cn = classnames({wide});
    return <Tab.Group onClick={on_click} variant={variant} className={cn}>
        {tabs.map((tab, i)=>
            <Tab {...tab} key={tab.id+i} selected={selected==tab.id} />)}
    </Tab.Group>;
};
Tab_group.displayName = 'Tab_group';

export default Tab_group;
