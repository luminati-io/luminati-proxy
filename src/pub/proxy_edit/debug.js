// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true, es6:true*/
import React from 'react';
import {Config} from './common.js';
import {withContext} from 'recompose';
import PropTypes from 'prop-types';
const provider = provide=>withContext({provide: PropTypes.object},
    ()=>({provide}));

export default provider({tab_id: 'debug'})(props=>
    <div>
      <Config type="select" id="log" data={props.proxy.log.values}/>
      <Config type="select" id="debug" data={props.proxy.debug.values}/>
    </div>);
