// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import {Config} from './common.js';
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
          <Config type="select_number" id="keep_alive" sufix="seconds"
            data={[0, 45]}/>
          <Config type="double_number" id="max_requests"/>
          <Config type="double_number" id="session_duration" sufix="seconds"/>
          <Config type="yes_no" id="sticky_ip"/>
          <Config type="yes_no" id="session_random" disabled={form.sticky_ip}/>
          {!form.session_random && !form.sticky_ip &&
            <Config type="text" id="session"/>}
          <Config type="text" id="seed"/>
        </div>;
});
