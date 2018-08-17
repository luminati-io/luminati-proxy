// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import {validators, Config} from './common.js';
import {withContext} from 'recompose';
import PropTypes from 'prop-types';
const provider = provide=>withContext({provide: PropTypes.object},
    ()=>({provide}));

export default provider({tab_id: 'rotation'})(props=>{
    const {form, proxy} = props;
    return <div>
          <Config type="text" id="ip"/>
          <Config type="text" id="vip"/>
          <Config type="select" id="pool_type" data={proxy.pool_type.values}/>
          <Config type="number" id="keep_alive" min="0" sufix="seconds"/>
          <Config type="text" id="whitelist_ips"
            validator={validators.ips_list}/>
          <Config type="double_number" id="max_requests"/>
          <Config type="double_number" id="session_duration" sufix="seconds"/>
          <Config type="yes_no" id="sticky_ip"/>
          <Config type="yes_no" id="session_random" disabled={form.sticky_ip}/>
          {!form.session_random && !form.sticky_ip &&
            <Config type="text" id="session"/>}
          <Config type="text" id="seed"/>
        </div>;
});
