// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import {Config} from './common.js';
import {withContext} from 'recompose';
import PropTypes from 'prop-types';
const provider = provide=>withContext({provide: PropTypes.object},
    ()=>({provide}));

const pool_type_opt = [
    {key: 'Default (Sequential)', value: ''},
    {key: 'Sequential', value: 'sequential'},
    {key: 'Round-robin', value: 'round-robin'},
    {key: 'Long Availability', value: 'long_availability'},
];

export default provider({tab_id: 'rotation'})(props=>{
    const {form} = props;
    return <div>
          <Config type="text" id="ip"/>
          <Config type="text" id="vip"/>
          <Config type="select" id="pool_type" data={pool_type_opt}/>
          <Config type="select_number" id="keep_alive" sufix="seconds"
            data={[0, 45]}/>
          <Config type="select_number" id="max_requests"/>
          <Config type="select_number" id="session_duration" sufix="seconds"/>
          <Config type="yes_no" id="sticky_ip"/>
          <Config type="yes_no" id="session_random" disabled={form.sticky_ip}/>
          {!form.session_random && !form.sticky_ip &&
            <Config type="text" id="session"/>}
          <Config type="text" id="seed"/>
        </div>;
});
