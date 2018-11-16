// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import {Config} from './common.js';
import {withContext} from 'recompose';
import PropTypes from 'prop-types';
const provider = provide=>withContext({provide: PropTypes.object},
    ()=>({provide}));

const debug_opt = [
    {key: `Default (full)`, value: ''},
    {key: 'none', value: 'none'},
    {key: 'full', value: 'full'},
];

export default provider({tab_id: 'debug'})(props=>
    <div>
      <Config type="select" id="log" data={props.proxy.log.values}/>
      <Config type="select" id="debug" data={debug_opt}/>
    </div>);
